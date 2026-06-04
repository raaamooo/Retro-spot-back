"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const client_1 = require("@prisma/client");
const NotificationService_1 = require("./NotificationService");
const prisma = new client_1.PrismaClient();
/**
 * ═══════════════════════════════════════════════════════════════
 *  InventoryService v2 — Complete rebuild
 * ═══════════════════════════════════════════════════════════════
 */
class InventoryService {
    io;
    notificationService;
    constructor(io, notificationService) {
        this.io = io;
        this.notificationService = notificationService || new NotificationService_1.NotificationService(io);
    }
    // ─── INGREDIENTS ───────────────────────────────────────────
    async getAllIngredients() {
        return prisma.ingredient.findMany({
            include: {
                ingredientSupplier: {
                    include: { supplier: true },
                },
            },
            orderBy: { nameEn: 'asc' },
        });
    }
    async getIngredientById(id) {
        return prisma.ingredient.findUnique({
            where: { id },
            include: {
                ingredientSupplier: { include: { supplier: true } },
                recipes: { include: { menuItem: true } },
            },
        });
    }
    async createIngredient(data) {
        const ingredient = await prisma.ingredient.create({
            data: {
                nameEn: data.nameEn,
                nameAr: data.nameAr,
                unit: data.unit,
                currentStock: data.currentStock || 0,
                minimumStock: data.minimumStock,
                costPerUnit: data.costPerUnit || 0,
                category: data.category || null,
            },
        });
        // Link supplier if provided
        if (data.supplierId) {
            await prisma.ingredientSupplier.create({
                data: { ingredientId: ingredient.id, supplierId: data.supplierId },
            });
        }
        this.io.emit('inventory:stock_updated', { action: 'ingredient_created', ingredient });
        return ingredient;
    }
    async updateIngredient(id, data) {
        const updateData = {};
        if (data.nameEn !== undefined)
            updateData.nameEn = data.nameEn;
        if (data.nameAr !== undefined)
            updateData.nameAr = data.nameAr;
        if (data.unit !== undefined)
            updateData.unit = data.unit;
        if (data.minimumStock !== undefined)
            updateData.minimumStock = data.minimumStock;
        if (data.costPerUnit !== undefined)
            updateData.costPerUnit = data.costPerUnit;
        if (data.category !== undefined)
            updateData.category = data.category;
        const ingredient = await prisma.ingredient.update({
            where: { id },
            data: updateData,
        });
        // Update supplier link
        if (data.supplierId !== undefined) {
            await prisma.ingredientSupplier.deleteMany({ where: { ingredientId: id } });
            if (data.supplierId) {
                await prisma.ingredientSupplier.create({
                    data: { ingredientId: id, supplierId: data.supplierId },
                });
            }
        }
        this.io.emit('inventory:stock_updated', { action: 'ingredient_updated', ingredient });
        return ingredient;
    }
    async deleteIngredient(id) {
        await prisma.ingredient.delete({ where: { id } });
        this.io.emit('inventory:stock_updated', { action: 'ingredient_deleted', ingredientId: id });
        return { success: true };
    }
    // ─── RESTOCK ───────────────────────────────────────────────
    async restockIngredient(ingredientId, quantityAdded, pricePerUnit, supplierId, notes, adminId) {
        const ingredient = await prisma.ingredient.update({
            where: { id: ingredientId },
            data: { currentStock: { increment: quantityAdded } },
        });
        // Log the purchase
        const purchase = await prisma.purchaseHistory.create({
            data: {
                ingredientId,
                supplierId: supplierId || null,
                quantityAdded,
                pricePerUnit,
                totalCost: quantityAdded * pricePerUnit,
                notes: notes || null,
                adminId: adminId || null,
            },
            include: { ingredient: true, supplier: true },
        });
        this.io.emit('inventory:restock_logged', purchase);
        this.io.emit('inventory:stock_updated', { action: 'restocked', ingredient });
        // Resolve any active alerts for this ingredient
        await prisma.stockAlert.updateMany({
            where: { ingredientId, isResolved: false },
            data: { isResolved: true, resolvedAt: new Date() },
        });
        // Re-enable menu items if all their recipe ingredients are now in stock
        await this.reenableMenuItemsUsingIngredient(ingredientId);
        return { ingredient, purchase };
    }
    // ─── DEDUCTIONS ────────────────────────────────────────────
    async manualDeduction(ingredientId, quantityDeducted, reason, adminId) {
        const ingredient = await prisma.ingredient.update({
            where: { id: ingredientId },
            data: { currentStock: { decrement: quantityDeducted } },
        });
        await prisma.stockDeduction.create({
            data: {
                ingredientId,
                quantityDeducted,
                reason,
                adminId: adminId || null,
            },
        });
        this.io.emit('inventory:stock_updated', { action: 'deducted', ingredient });
        // Check alerts
        await this.checkAndEmitAlerts(ingredient);
        return ingredient;
    }
    /**
     * Auto-deduction: deplete inventory for all items in an order.
     * Called automatically when an order is placed.
     */
    async depleteForOrder(orderId) {
        try {
            const order = await prisma.order.findUnique({
                where: { id: orderId },
                include: {
                    items: {
                        include: {
                            menuItem: {
                                include: { recipes: true },
                            },
                        },
                    },
                },
            });
            if (!order)
                return;
            for (const orderItem of order.items) {
                for (const recipe of orderItem.menuItem.recipes) {
                    const totalUsed = recipe.quantityRequired * orderItem.quantity;
                    const ingredient = await prisma.ingredient.update({
                        where: { id: recipe.ingredientId },
                        data: { currentStock: { decrement: totalUsed } },
                    });
                    // Log the deduction
                    await prisma.stockDeduction.create({
                        data: {
                            ingredientId: recipe.ingredientId,
                            quantityDeducted: totalUsed,
                            reason: 'order',
                            orderId: orderId,
                        },
                    });
                    // Check alerts
                    await this.checkAndEmitAlerts(ingredient);
                }
            }
            this.io.emit('inventory:stock_updated', { action: 'order_depleted', orderId });
        }
        catch (error) {
            console.error('[InventoryService:depleteForOrder] ERROR:', error);
        }
    }
    // ─── ALERTS ────────────────────────────────────────────────
    async checkAndEmitAlerts(ingredient) {
        if (ingredient.currentStock <= 0) {
            // Out of stock
            const existingAlert = await prisma.stockAlert.findFirst({
                where: { ingredientId: ingredient.id, alertType: 'out_of_stock', isResolved: false },
            });
            if (!existingAlert) {
                await prisma.stockAlert.create({
                    data: { ingredientId: ingredient.id, alertType: 'out_of_stock' },
                });
            }
            // Auto-disable affected menu items
            await this.disableMenuItemsUsingIngredient(ingredient.id);
            // Notify all channels
            await this.notificationService.notifyOutOfStock(ingredient);
        }
        else if (ingredient.currentStock <= ingredient.minimumStock) {
            // Low stock
            const existingAlert = await prisma.stockAlert.findFirst({
                where: { ingredientId: ingredient.id, alertType: 'low_stock', isResolved: false },
            });
            if (!existingAlert) {
                await prisma.stockAlert.create({
                    data: { ingredientId: ingredient.id, alertType: 'low_stock' },
                });
            }
            await this.notificationService.notifyLowStock(ingredient);
        }
    }
    async getAlerts(resolved) {
        const where = {};
        if (resolved !== undefined)
            where.isResolved = resolved;
        return prisma.stockAlert.findMany({
            where,
            include: { ingredient: true },
            orderBy: { triggeredAt: 'desc' },
        });
    }
    async resolveAlert(alertId) {
        return prisma.stockAlert.update({
            where: { id: alertId },
            data: { isResolved: true, resolvedAt: new Date() },
            include: { ingredient: true },
        });
    }
    // ─── MENU ITEM AVAILABILITY ────────────────────────────────
    async disableMenuItemsUsingIngredient(ingredientId) {
        const recipes = await prisma.recipe.findMany({
            where: { ingredientId },
            select: { menuItemId: true },
        });
        const menuItemIds = recipes.map(r => r.menuItemId);
        if (menuItemIds.length > 0) {
            await prisma.menuItem.updateMany({
                where: { id: { in: menuItemIds } },
                data: { available: false },
            });
            // Notify each disabled menu item
            for (const id of menuItemIds) {
                this.io.emit('menu:item_unavailable', { menuItemId: id });
            }
            // Also emit full availability update
            const allItems = await prisma.menuItem.findMany({ select: { id: true, available: true } });
            this.io.emit('menu:availability', allItems);
        }
    }
    async reenableMenuItemsUsingIngredient(ingredientId) {
        const recipes = await prisma.recipe.findMany({
            where: { ingredientId },
            select: { menuItemId: true },
        });
        for (const recipe of recipes) {
            const allRecipes = await prisma.recipe.findMany({
                where: { menuItemId: recipe.menuItemId },
                include: { ingredient: true },
            });
            const allInStock = allRecipes.every(r => r.ingredient.currentStock > 0);
            if (allInStock) {
                await prisma.menuItem.update({
                    where: { id: recipe.menuItemId },
                    data: { available: true },
                });
                this.io.emit('menu:item_available', { menuItemId: recipe.menuItemId });
            }
        }
        const allItems = await prisma.menuItem.findMany({ select: { id: true, available: true } });
        this.io.emit('menu:availability', allItems);
    }
    // ─── RECIPES ───────────────────────────────────────────────
    async getRecipe(menuItemId) {
        return prisma.recipe.findMany({
            where: { menuItemId },
            include: { ingredient: true },
        });
    }
    async setRecipe(menuItemId, lines) {
        // Delete existing recipe lines
        await prisma.recipe.deleteMany({ where: { menuItemId } });
        // Create new ones
        if (lines.length > 0) {
            await prisma.recipe.createMany({
                data: lines.map(l => ({
                    menuItemId,
                    ingredientId: l.ingredientId,
                    quantityRequired: l.quantityRequired,
                })),
            });
        }
        // Update menu item availability based on recipe ingredients
        const allRecipes = await prisma.recipe.findMany({
            where: { menuItemId },
            include: { ingredient: true },
        });
        const allInStock = allRecipes.length === 0 || allRecipes.every(r => r.ingredient.currentStock > 0);
        await prisma.menuItem.update({ where: { id: menuItemId }, data: { available: allInStock } });
        const allItems = await prisma.menuItem.findMany({ select: { id: true, available: true } });
        this.io.emit('menu:availability', allItems);
        return { success: true, available: allInStock };
    }
    async deleteRecipe(menuItemId) {
        await prisma.recipe.deleteMany({ where: { menuItemId } });
        await prisma.menuItem.update({ where: { id: menuItemId }, data: { available: true } });
        return { success: true };
    }
    // ─── SUPPLIERS ─────────────────────────────────────────────
    async getAllSuppliers() {
        return prisma.supplier.findMany({
            include: {
                ingredientSuppliers: {
                    include: { ingredient: true },
                },
            },
            orderBy: { name: 'asc' },
        });
    }
    async createSupplier(data) {
        return prisma.supplier.create({ data });
    }
    async updateSupplier(id, data) {
        return prisma.supplier.update({ where: { id }, data });
    }
    async deleteSupplier(id) {
        // Unlink ingredients first
        await prisma.ingredientSupplier.deleteMany({ where: { supplierId: id } });
        await prisma.supplier.delete({ where: { id } });
        return { success: true };
    }
    // ─── PURCHASE HISTORY ──────────────────────────────────────
    async getPurchaseHistory(filters) {
        const where = {};
        if (filters?.ingredientId)
            where.ingredientId = filters.ingredientId;
        if (filters?.supplierId)
            where.supplierId = filters.supplierId;
        if (filters?.startDate || filters?.endDate) {
            where.purchasedAt = {};
            if (filters.startDate)
                where.purchasedAt.gte = new Date(filters.startDate);
            if (filters.endDate)
                where.purchasedAt.lte = new Date(filters.endDate);
        }
        return prisma.purchaseHistory.findMany({
            where,
            include: { ingredient: true, supplier: true },
            orderBy: { purchasedAt: 'desc' },
        });
    }
    async getPurchaseSummary(filters) {
        const where = {};
        if (filters?.startDate || filters?.endDate) {
            where.purchasedAt = {};
            if (filters.startDate)
                where.purchasedAt.gte = new Date(filters.startDate);
            if (filters.endDate)
                where.purchasedAt.lte = new Date(filters.endDate);
        }
        const purchases = await prisma.purchaseHistory.findMany({
            where,
            include: { ingredient: true, supplier: true },
        });
        const totalSpent = purchases.reduce((sum, p) => sum + p.totalCost, 0);
        // Group by ingredient
        const byIngredient = {};
        for (const p of purchases) {
            if (!byIngredient[p.ingredientId]) {
                byIngredient[p.ingredientId] = { name: p.ingredient.nameEn, total: 0, count: 0 };
            }
            byIngredient[p.ingredientId].total += p.totalCost;
            byIngredient[p.ingredientId].count++;
        }
        // Group by supplier
        const bySupplier = {};
        for (const p of purchases) {
            if (p.supplier) {
                if (!bySupplier[p.supplierId]) {
                    bySupplier[p.supplierId] = { name: p.supplier.name, total: 0 };
                }
                bySupplier[p.supplierId].total += p.totalCost;
            }
        }
        // Most restocked ingredient
        const mostRestocked = Object.entries(byIngredient).sort((a, b) => b[1].count - a[1].count)[0];
        return {
            totalSpent: Math.round(totalSpent * 100) / 100,
            byIngredient,
            bySupplier,
            mostRestocked: mostRestocked ? { name: mostRestocked[1].name, count: mostRestocked[1].count } : null,
            totalPurchases: purchases.length,
        };
    }
    // ─── DASHBOARD ─────────────────────────────────────────────
    async getDashboard() {
        const ingredients = await prisma.ingredient.findMany();
        const totalIngredients = ingredients.length;
        const lowStockCount = ingredients.filter(i => i.currentStock > 0 && i.currentStock <= i.minimumStock).length;
        const outOfStockCount = ingredients.filter(i => i.currentStock <= 0).length;
        const totalValue = ingredients.reduce((sum, i) => sum + (i.currentStock * i.costPerUnit), 0);
        // Recent activity: last 10 deductions + last 10 purchases
        const recentDeductions = await prisma.stockDeduction.findMany({
            include: { ingredient: true },
            orderBy: { deductedAt: 'desc' },
            take: 10,
        });
        const recentPurchases = await prisma.purchaseHistory.findMany({
            include: { ingredient: true, supplier: true },
            orderBy: { purchasedAt: 'desc' },
            take: 10,
        });
        // Today's deduction cost
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todaysDeductions = await prisma.stockDeduction.findMany({
            where: { deductedAt: { gte: startOfDay } },
            include: { ingredient: true },
        });
        const todayDeductionCost = todaysDeductions.reduce((sum, d) => sum + (d.quantityDeducted * (d.ingredient?.costPerUnit || 0)), 0);
        // Unresolved alerts count
        const unresolvedAlerts = await prisma.stockAlert.count({ where: { isResolved: false } });
        return {
            totalIngredients,
            lowStockCount,
            outOfStockCount,
            totalValue: Math.round(totalValue * 100) / 100,
            todayDeductionCost: Math.round(todayDeductionCost * 100) / 100,
            unresolvedAlerts,
            recentDeductions,
            recentPurchases,
        };
    }
}
exports.InventoryService = InventoryService;
