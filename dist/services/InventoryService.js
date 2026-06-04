"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const client_1 = require("@prisma/client");
const socketEvents_1 = require("../socketEvents");
const AuditService_1 = require("./AuditService");
const prisma = new client_1.PrismaClient();
class InventoryService {
    io;
    auditService;
    constructor(io, auditService) {
        this.io = io;
        this.auditService = auditService || new AuditService_1.AuditService(io);
    }
    /**
     * Manually update stock for an ingredient (used by inventory worker).
     * Recalculates menu item availability and emits all relevant events.
     */
    async updateStock(ingredientId, newQuantity, reason = 'manual_adjustment', staffName = 'System', details) {
        // Get current value for audit log
        const current = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
        if (!current)
            throw new Error('Ingredient not found');
        const updatedIngredient = await prisma.ingredient.update({
            where: { id: ingredientId },
            data: { quantityAvailable: newQuantity },
        });
        // Log the change
        await this.auditService.logStockChange(ingredientId, current.quantityAvailable, newQuantity, reason, staffName, details);
        // Check low stock threshold
        if (updatedIngredient.quantityAvailable > 0 && updatedIngredient.quantityAvailable <= updatedIngredient.lowStockThreshold) {
            this.io.emit(socketEvents_1.EVENTS.INVENTORY_LOW_STOCK, updatedIngredient);
        }
        // If zero or less, disable affected menu items
        if (updatedIngredient.quantityAvailable <= 0) {
            await this.disableMenuItemsUsingIngredient(updatedIngredient.id);
        }
        else {
            // If restocked, re-enable items that might now be available
            await this.reenableMenuItemsUsingIngredient(updatedIngredient.id);
        }
        // Emit full ingredient list and updated availability
        await this.emitFullUpdate();
        return updatedIngredient;
    }
    /**
     * Batch restock multiple ingredients at once.
     */
    async batchRestock(items, staffName = 'System') {
        const results = [];
        for (const item of items) {
            const current = await prisma.ingredient.findUnique({ where: { id: item.id } });
            if (!current)
                continue;
            const newQty = current.quantityAvailable + item.quantity;
            const updated = await prisma.ingredient.update({
                where: { id: item.id },
                data: { quantityAvailable: newQty },
            });
            await this.auditService.logStockChange(item.id, current.quantityAvailable, newQty, 'restock', staffName, `Batch restock: +${item.quantity} ${current.unit}`);
            // Re-enable menu items if ingredient is now in stock
            if (updated.quantityAvailable > 0) {
                await this.reenableMenuItemsUsingIngredient(updated.id);
            }
            results.push(updated);
        }
        await this.emitFullUpdate();
        return results;
    }
    /**
     * Get inventory health summary.
     */
    async getInventoryHealth() {
        const ingredients = await prisma.ingredient.findMany({ where: { active: true } });
        const now = new Date();
        const oneWeekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const totalSKUs = ingredients.length;
        const belowThreshold = ingredients.filter(i => i.quantityAvailable > 0 && i.quantityAvailable <= i.lowStockThreshold).length;
        const outOfStock = ingredients.filter(i => i.quantityAvailable <= 0).length;
        const expiringThisWeek = ingredients.filter(i => i.expiryDate && new Date(i.expiryDate) >= now && new Date(i.expiryDate) <= oneWeekFromNow).length;
        const estimatedValue = ingredients.reduce((sum, i) => sum + (i.quantityAvailable * i.costPerUnit), 0);
        return {
            totalSKUs,
            belowThreshold,
            outOfStock,
            expiringThisWeek,
            estimatedValue: Math.round(estimatedValue * 100) / 100,
        };
    }
    /**
     * Export inventory data as JSON (frontend will convert to CSV if needed).
     */
    async exportInventory() {
        return prisma.ingredient.findMany({
            where: { active: true },
            include: {
                supplier: { select: { name: true, phone: true, email: true } },
            },
            orderBy: { nameEn: 'asc' },
        });
    }
    /**
     * Deplete inventory for all items in an order.
     * Called automatically after a new order is placed.
     */
    async depleteInventoryForOrder(orderId) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        include: {
                            menuItem: {
                                include: { recipes: true }
                            }
                        }
                    }
                }
            });
            if (!order)
                return;
            for (const orderItem of order.items) {
                for (const recipe of orderItem.menuItem.recipes) {
                    const totalUsed = recipe.quantityUsed * orderItem.quantity;
                    const current = await prisma.ingredient.findUnique({ where: { id: recipe.ingredientId } });
                    // Decrement ingredient
                    const updatedIngredient = await prisma.ingredient.update({
                        where: { id: recipe.ingredientId },
                        data: { quantityAvailable: { decrement: totalUsed } }
                    });
                    // Log the depletion
                    if (current) {
                        await this.auditService.logStockChange(recipe.ingredientId, current.quantityAvailable, updatedIngredient.quantityAvailable, 'sale', 'System', `Order ${orderId.slice(0, 8)}: ${orderItem.quantity}x ${orderItem.menuItem.nameEn}`);
                    }
                    // Check thresholds
                    if (updatedIngredient.quantityAvailable > 0 && updatedIngredient.quantityAvailable <= updatedIngredient.lowStockThreshold) {
                        this.io.emit(socketEvents_1.EVENTS.INVENTORY_LOW_STOCK, updatedIngredient);
                    }
                    // If zero or less, mark affected menu items as unavailable
                    if (updatedIngredient.quantityAvailable <= 0) {
                        await this.disableMenuItemsUsingIngredient(updatedIngredient.id);
                    }
                }
            }
            // Emit full update after all depletions
            await this.emitFullUpdate();
        }
        catch (error) {
            console.error('[InventoryService:depleteInventoryForOrder] ERROR:', error);
            throw error;
        }
    }
    /**
     * Disable all menu items that depend on a depleted ingredient.
     */
    async disableMenuItemsUsingIngredient(ingredientId) {
        const recipes = await prisma.recipe.findMany({
            where: { ingredientId },
            select: { menuItemId: true }
        });
        const menuItemIds = recipes.map(r => r.menuItemId);
        if (menuItemIds.length > 0) {
            await prisma.menuItem.updateMany({
                where: { id: { in: menuItemIds } },
                data: { available: false }
            });
        }
    }
    /**
     * Re-enable menu items when an ingredient is restocked.
     * Only enables if ALL recipe ingredients are now in stock.
     */
    async reenableMenuItemsUsingIngredient(ingredientId) {
        // Find all menu items that use this ingredient
        const recipes = await prisma.recipe.findMany({
            where: { ingredientId },
            select: { menuItemId: true }
        });
        for (const recipe of recipes) {
            // Check if ALL ingredients for this menu item are in stock
            const allRecipes = await prisma.recipe.findMany({
                where: { menuItemId: recipe.menuItemId },
                include: { ingredient: true }
            });
            const allInStock = allRecipes.every(r => r.ingredient.quantityAvailable > 0);
            if (allInStock) {
                await prisma.menuItem.update({
                    where: { id: recipe.menuItemId },
                    data: { available: true }
                });
            }
        }
    }
    /**
     * Emit the full ingredient list and menu availability to all clients.
     */
    async emitFullUpdate() {
        const ingredients = await prisma.ingredient.findMany();
        this.io.emit(socketEvents_1.EVENTS.INVENTORY_UPDATED, ingredients);
        const menuItems = await prisma.menuItem.findMany({
            select: { id: true, available: true }
        });
        this.io.emit(socketEvents_1.EVENTS.MENU_AVAILABILITY, menuItems);
    }
}
exports.InventoryService = InventoryService;
