"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = apiRoutes;
const express_1 = require("express");
const OrderService_1 = require("../services/OrderService");
const InventoryService_1 = require("../services/InventoryService");
const NotificationService_1 = require("../services/NotificationService");
const BookingService_1 = require("../services/BookingService");
const ConfigService_1 = require("../services/ConfigService");
const qr_1 = require("../utils/qr");
const pdf_1 = require("../utils/pdf");
const socketEvents_1 = require("../socketEvents");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
function apiRoutes(io, prisma) {
    const router = (0, express_1.Router)();
    const notificationService = new NotificationService_1.NotificationService(io);
    const configService = new ConfigService_1.ConfigService(io);
    const inventoryService = new InventoryService_1.InventoryService(io, notificationService);
    const orderService = new OrderService_1.OrderService(io, inventoryService, configService);
    const bookingService = new BookingService_1.BookingService(io);
    // Seed default config values on startup
    configService.seedDefaults().catch(err => console.error('[ConfigService] Failed to seed defaults:', err));
    // Configure Multer for local storage
    const storage = multer_1.default.diskStorage({
        destination: (req, file, cb) => cb(null, 'public/uploads/'),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + '-' + uniqueSuffix + path_1.default.extname(file.originalname));
        },
    });
    const upload = (0, multer_1.default)({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB cap
    // ═══════════════════════════════════════════════════════════
    //  MENU & CATEGORIES
    // ═══════════════════════════════════════════════════════════
    router.get('/menu', async (req, res) => {
        try {
            const categories = await prisma.menuCategory.findMany({
                include: { items: { where: { active: true }, orderBy: { nameEn: 'asc' } } },
                where: { active: true },
                orderBy: { sortOrder: 'asc' },
            });
            res.json(categories);
        }
        catch (err) {
            console.error('/menu error:', err);
            res.status(500).json({ error: 'Failed to fetch menu' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  INVENTORY v2 — Ingredients, Recipes, Suppliers, Purchases, Alerts
    // ═══════════════════════════════════════════════════════════
    // ── Ingredients ──
    router.get('/inventory/ingredients', async (req, res) => {
        try {
            const ingredients = await inventoryService.getAllIngredients();
            res.json(ingredients);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch ingredients' });
        }
    });
    router.post('/inventory/ingredients', async (req, res) => {
        try {
            const { nameEn, nameAr, unit, currentStock, minimumStock, costPerUnit, category, supplierId } = req.body;
            if (!nameEn || !nameAr || !unit) {
                return res.status(400).json({ error: 'nameEn, nameAr, and unit are required' });
            }
            const ingredient = await inventoryService.createIngredient({
                nameEn, nameAr, unit,
                currentStock: Number(currentStock) || 0,
                minimumStock: Number(minimumStock) || 10,
                costPerUnit: Number(costPerUnit) || 0,
                category: category || null,
                supplierId: supplierId || undefined,
            });
            res.json(ingredient);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to create ingredient' });
        }
    });
    router.put('/inventory/ingredients/:id', async (req, res) => {
        try {
            const ingredient = await inventoryService.updateIngredient(req.params.id, req.body);
            res.json(ingredient);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update ingredient' });
        }
    });
    router.delete('/inventory/ingredients/:id', async (req, res) => {
        try {
            const result = await inventoryService.deleteIngredient(req.params.id);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete ingredient' });
        }
    });
    router.post('/inventory/ingredients/:id/restock', async (req, res) => {
        try {
            const { quantityAdded, pricePerUnit, supplierId, notes, adminId } = req.body;
            if (!quantityAdded || !pricePerUnit) {
                return res.status(400).json({ error: 'quantityAdded and pricePerUnit are required' });
            }
            const result = await inventoryService.restockIngredient(req.params.id, Number(quantityAdded), Number(pricePerUnit), supplierId || undefined, notes || undefined, adminId || undefined);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to restock ingredient' });
        }
    });
    // ── Recipes ──
    router.get('/inventory/recipes/:menuItemId', async (req, res) => {
        try {
            const recipes = await inventoryService.getRecipe(req.params.menuItemId);
            res.json(recipes);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch recipe' });
        }
    });
    router.post('/inventory/recipes', async (req, res) => {
        try {
            const { menuItemId, lines } = req.body;
            if (!menuItemId || !Array.isArray(lines)) {
                return res.status(400).json({ error: 'menuItemId and lines array are required' });
            }
            const result = await inventoryService.setRecipe(menuItemId, lines);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update recipe' });
        }
    });
    router.delete('/inventory/recipes/:menuItemId', async (req, res) => {
        try {
            const result = await inventoryService.deleteRecipe(req.params.menuItemId);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete recipe' });
        }
    });
    // ── Suppliers ──
    router.get('/inventory/suppliers', async (req, res) => {
        try {
            const suppliers = await inventoryService.getAllSuppliers();
            res.json(suppliers);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch suppliers' });
        }
    });
    router.post('/inventory/suppliers', async (req, res) => {
        try {
            const { name } = req.body;
            if (!name)
                return res.status(400).json({ error: 'name is required' });
            const supplier = await inventoryService.createSupplier(req.body);
            res.json(supplier);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to create supplier' });
        }
    });
    router.put('/inventory/suppliers/:id', async (req, res) => {
        try {
            const supplier = await inventoryService.updateSupplier(req.params.id, req.body);
            res.json(supplier);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update supplier' });
        }
    });
    router.delete('/inventory/suppliers/:id', async (req, res) => {
        try {
            const result = await inventoryService.deleteSupplier(req.params.id);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete supplier' });
        }
    });
    // ── Purchase History ──
    router.get('/inventory/purchases', async (req, res) => {
        try {
            const purchases = await inventoryService.getPurchaseHistory({
                ingredientId: req.query.ingredientId,
                supplierId: req.query.supplierId,
                startDate: req.query.startDate,
                endDate: req.query.endDate,
            });
            res.json(purchases);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch purchase history' });
        }
    });
    router.get('/inventory/purchases/summary', async (req, res) => {
        try {
            const summary = await inventoryService.getPurchaseSummary({
                startDate: req.query.startDate,
                endDate: req.query.endDate,
            });
            res.json(summary);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch purchase summary' });
        }
    });
    // ── Stock Deduction ──
    router.post('/inventory/deduct', async (req, res) => {
        try {
            const { ingredientId, quantityDeducted, reason, adminId } = req.body;
            if (!ingredientId || !quantityDeducted || !reason) {
                return res.status(400).json({ error: 'ingredientId, quantityDeducted, and reason are required' });
            }
            const result = await inventoryService.manualDeduction(ingredientId, Number(quantityDeducted), reason, adminId);
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to deduct stock' });
        }
    });
    // ── Alerts ──
    router.get('/inventory/alerts', async (req, res) => {
        try {
            const resolved = req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined;
            const alerts = await inventoryService.getAlerts(resolved);
            res.json(alerts);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch alerts' });
        }
    });
    router.patch('/inventory/alerts/:id/resolve', async (req, res) => {
        try {
            const alert = await inventoryService.resolveAlert(req.params.id);
            res.json(alert);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to resolve alert' });
        }
    });
    // ── Dashboard ──
    router.get('/inventory/dashboard', async (req, res) => {
        try {
            const dashboard = await inventoryService.getDashboard();
            res.json(dashboard);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch inventory dashboard' });
        }
    });
    /**
     * PATCH /api/menu-items/:id
     * Toggle availability or active state.
     */
    router.patch('/menu-items/:id', async (req, res) => {
        try {
            const { available, active } = req.body;
            const data = {};
            if (available !== undefined)
                data.available = available;
            if (active !== undefined)
                data.active = active;
            const item = await prisma.menuItem.update({ where: { id: req.params.id }, data });
            const allItems = await prisma.menuItem.findMany({ select: { id: true, available: true } });
            io.emit(socketEvents_1.EVENTS.MENU_AVAILABILITY, allItems);
            res.json(item);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update menu item' });
        }
    });
    /**
     * GET /api/menu-items
     * Flat list of all menu items with category (for inventory management).
     */
    router.get('/menu-items', async (req, res) => {
        try {
            const items = await prisma.menuItem.findMany({
                include: { category: { select: { nameEn: true, nameAr: true } } },
                orderBy: [{ category: { sortOrder: 'asc' } }, { nameEn: 'asc' }],
            });
            res.json(items);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch menu items' });
        }
    });
    /**
     * POST /api/menu-categories
     */
    router.post('/menu-categories', async (req, res) => {
        try {
            const { nameEn, nameAr, sortOrder } = req.body;
            if (!nameEn || !nameAr)
                return res.status(400).json({ error: 'nameEn and nameAr are required' });
            const category = await prisma.menuCategory.create({
                data: { nameEn, nameAr, sortOrder: sortOrder ?? 0 },
            });
            res.json(category);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to create category' });
        }
    });
    /**
     * DELETE /api/menu-categories/:id
     * Refuses to delete if category still has menu items.
     */
    router.delete('/menu-categories/:id', async (req, res) => {
        try {
            const itemCount = await prisma.menuItem.count({ where: { categoryId: req.params.id } });
            if (itemCount > 0) {
                return res.status(409).json({
                    error: `Cannot delete: category still has ${itemCount} item(s). Remove them first.`,
                });
            }
            await prisma.menuCategory.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete category' });
        }
    });
    /**
     * POST /api/menu-items
     */
    router.post('/menu-items', upload.single('image'), async (req, res) => {
        try {
            const { categoryId, nameEn, nameAr, descriptionEn, descriptionAr, price, tags } = req.body;
            if (!categoryId || !nameEn || !nameAr || !price) {
                return res.status(400).json({ error: 'categoryId, nameEn, nameAr and price are required' });
            }
            const item = await prisma.menuItem.create({
                data: {
                    categoryId,
                    nameEn,
                    nameAr,
                    descriptionEn: descriptionEn || null,
                    descriptionAr: descriptionAr || null,
                    price: parseFloat(price),
                    tags: tags || null,
                    imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
                    available: true,
                    active: true,
                },
                include: { category: { select: { nameEn: true, nameAr: true } } },
            });
            res.json(item);
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to create menu item' });
        }
    });
    /**
     * DELETE /api/menu-items/:id
     */
    router.delete('/menu-items/:id', async (req, res) => {
        try {
            // Delete recipes first to avoid FK constraint errors
            await prisma.recipe.deleteMany({ where: { menuItemId: req.params.id } });
            await prisma.menuItem.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete menu item' });
        }
    });
    /**
     * PATCH /api/menu-items/:id/details
     */
    router.patch('/menu-items/:id/details', upload.single('image'), async (req, res) => {
        try {
            const { nameEn, nameAr, descriptionEn, descriptionAr, price, tags, categoryId } = req.body;
            const data = {};
            if (nameEn !== undefined)
                data.nameEn = nameEn;
            if (nameAr !== undefined)
                data.nameAr = nameAr;
            if (descriptionEn !== undefined)
                data.descriptionEn = descriptionEn;
            if (descriptionAr !== undefined)
                data.descriptionAr = descriptionAr;
            if (price !== undefined)
                data.price = parseFloat(price);
            if (tags !== undefined)
                data.tags = tags;
            if (categoryId !== undefined)
                data.categoryId = categoryId;
            if (req.file)
                data.imageUrl = `/uploads/${req.file.filename}`;
            const item = await prisma.menuItem.update({
                where: { id: req.params.id },
                data,
                include: { category: { select: { nameEn: true, nameAr: true } } },
            });
            res.json(item);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update menu item details' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  RECIPES
    // ═══════════════════════════════════════════════════════════
    // (Old recipe routes removed — now under /inventory/recipes/:menuItemId)
    // ═══════════════════════════════════════════════════════════
    //  LOCATIONS
    // ═══════════════════════════════════════════════════════════
    router.get('/locations', async (req, res) => {
        try {
            const locations = await prisma.location.findMany({ where: { active: true } });
            res.json(locations);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch locations' });
        }
    });
    router.post('/locations', async (req, res) => {
        try {
            const { name, type } = req.body;
            if (!name || !type)
                return res.status(400).json({ error: 'name and type are required' });
            const location = await prisma.location.create({ data: { name, type } });
            res.json(location);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to create location' });
        }
    });
    router.delete('/locations/:id', async (req, res) => {
        try {
            await prisma.location.update({ where: { id: req.params.id }, data: { active: false } });
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete location' });
        }
    });
    router.get('/locations/:id/qr', async (req, res) => {
        try {
            const baseUrl = req.query.baseUrl || process.env.FRONTEND_URL || 'http://localhost:3000';
            const qrDataUrl = await (0, qr_1.generateLocationQR)(req.params.id, baseUrl);
            res.json({ qrCodeUrl: qrDataUrl });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to generate QR' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  ORDERS
    // ═══════════════════════════════════════════════════════════
    router.post('/orders', async (req, res) => {
        try {
            const order = await orderService.placeOrder(req.body);
            res.json(order);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to place order' });
        }
    });
    router.patch('/orders/:id/status', async (req, res) => {
        try {
            const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
            res.json(order);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update order status' });
        }
    });
    router.patch('/orders/:id/archive', async (req, res) => {
        try {
            const order = await orderService.archiveOrder(req.params.id, req.body.archived !== false);
            res.json(order);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to archive order' });
        }
    });
    router.patch('/orders/:id', async (req, res) => {
        try {
            const order = await orderService.updateOrder(req.params.id, req.body);
            res.json(order);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update order' });
        }
    });
    router.get('/orders', async (req, res) => {
        try {
            const where = {};
            if (req.query.status)
                where.status = req.query.status;
            if (req.query.locationId)
                where.locationId = req.query.locationId;
            // Default to archived: false unless explicitly requested otherwise
            if (req.query.archived === 'true') {
                where.archived = true;
            }
            else if (req.query.archived === 'all') {
                // Don't add archived to where clause
            }
            else {
                where.archived = false;
            }
            const orders = await prisma.order.findMany({
                where,
                include: {
                    items: { include: { menuItem: true } },
                    location: true,
                },
                orderBy: { createdAt: 'desc' },
                take: 200, // cap to avoid massive payloads
            });
            res.json(orders);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch orders' });
        }
    });
    /**
     * GET /api/orders/snapshot
     * Get daily sales snapshot for the cashier shift.
     */
    router.get('/orders/snapshot', async (req, res) => {
        try {
            const startOfDay = new Date();
            startOfDay.setHours(0, 0, 0, 0);
            const orders = await prisma.order.findMany({
                where: {
                    createdAt: { gte: startOfDay },
                },
                include: {
                    items: true,
                },
            });
            const snapshot = {
                grossSales: 0,
                netSales: 0,
                cashSales: 0,
                visaSales: 0,
                totalTips: 0,
                totalVoids: 0,
                completedOrders: 0,
                pendingOrders: 0,
            };
            orders.forEach(order => {
                if (order.status === 'completed') {
                    snapshot.completedOrders++;
                    snapshot.grossSales += order.total + (order.refundAmount || 0); // Total before refund
                    snapshot.netSales += order.total;
                    snapshot.totalTips += order.tipAmount || 0;
                    if (order.paymentMethod === 'cash')
                        snapshot.cashSales += order.total;
                    if (order.paymentMethod === 'visa')
                        snapshot.visaSales += order.total;
                    if (order.paymentMethod === 'split') {
                        // Best effort approximation if split amounts are not structured
                        snapshot.cashSales += order.total / 2;
                        snapshot.visaSales += order.total / 2;
                    }
                }
                else if (order.status !== 'cancelled' && !order.archived) {
                    snapshot.pendingOrders++;
                }
                // Count voids
                order.items.forEach(item => {
                    if (item.voided) {
                        snapshot.totalVoids += item.itemPriceAtTime * item.quantity;
                    }
                });
            });
            res.json(snapshot);
        }
        catch (err) {
            console.error('/api/orders/snapshot error:', err);
            res.status(500).json({ error: 'Failed to fetch shift snapshot' });
        }
    });
    /**
     * PATCH /api/order-items/:id/status
     * Update individual order item status (ordered → preparing → ready → served).
     */
    router.patch('/order-items/:id/status', async (req, res) => {
        try {
            const item = await orderService.updateItemStatus(req.params.id, req.body.status);
            res.json(item);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update item status' });
        }
    });
    /**
     * POST /api/orders/:id/void-item
     * Void a specific item in an order.
     */
    router.post('/orders/:id/void-item', async (req, res) => {
        try {
            const { itemId, reason, staffName } = req.body;
            if (!itemId || !reason)
                return res.status(400).json({ error: 'itemId and reason are required' });
            const result = await orderService.voidItem(req.params.id, itemId, reason, staffName || 'Staff');
            res.json(result);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to void item' });
        }
    });
    /**
     * POST /api/orders/:id/refund
     * Process a partial or full refund.
     */
    router.post('/orders/:id/refund', async (req, res) => {
        try {
            const { amount, reason } = req.body;
            if (!amount || !reason)
                return res.status(400).json({ error: 'amount and reason are required' });
            const order = await orderService.refundOrder(req.params.id, parseFloat(amount), reason);
            res.json(order);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to process refund' });
        }
    });
    /**
     * PATCH /api/orders/:id/rush
     * Flag an order as rush priority.
     */
    router.patch('/orders/:id/rush', async (req, res) => {
        try {
            const order = await orderService.setRushPriority(req.params.id);
            res.json(order);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to set rush priority' });
        }
    });
    router.delete('/orders/:id', async (req, res) => {
        try {
            await prisma.orderItem.deleteMany({ where: { orderId: req.params.id } });
            await prisma.order.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete order' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  RECEIPT GENERATION
    // ═══════════════════════════════════════════════════════════
    router.post('/receipts/generate', async (req, res) => {
        try {
            const { orders, tableId } = req.body;
            const pdfUrl = await (0, pdf_1.generateReceiptPDF)(orders, tableId);
            res.json({ pdfUrl });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to generate receipt' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  WAITER CALLS
    // ═══════════════════════════════════════════════════════════
    router.post('/waitercalls', async (req, res) => {
        try {
            const { locationId, type } = req.body;
            const call = await prisma.waiterCall.create({
                data: { locationId, type: type || 'waiter' },
                include: { location: true },
            });
            io.emit(socketEvents_1.EVENTS.WAITER_CALL_NEW, call);
            res.json(call);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to create waiter call' });
        }
    });
    router.get('/waitercalls', async (req, res) => {
        try {
            const calls = await prisma.waiterCall.findMany({
                where: { status: 'active' },
                include: { location: true },
                orderBy: { createdAt: 'desc' },
            });
            res.json(calls);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch waiter calls' });
        }
    });
    router.patch('/waitercalls/:id/resolve', async (req, res) => {
        try {
            const call = await prisma.waiterCall.update({
                where: { id: req.params.id },
                data: { status: 'resolved', resolvedAt: new Date() },
                include: { location: true },
            });
            io.emit(socketEvents_1.EVENTS.WAITER_CALL_RESOLVED, call);
            res.json(call);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to resolve waiter call' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  BOOKINGS
    // ═══════════════════════════════════════════════════════════
    router.post('/bookings', upload.single('screenshot'), async (req, res) => {
        try {
            const { date, startTime, endTime, peopleCount, totalPrice } = req.body;
            const isAvailable = await bookingService.isTimeSlotAvailable(date, startTime, endTime);
            if (!isAvailable) {
                return res.status(400).json({ error: 'Time slot overlaps with existing booking' });
            }
            const bookingData = {
                ...req.body,
                peopleCount: parseInt(peopleCount) || 1,
                totalPrice: parseFloat(totalPrice) || 0,
                transactionScreenshotUrl: req.file ? `/uploads/${req.file.filename}` : null,
            };
            delete bookingData.screenshot;
            const booking = await prisma.booking.create({ data: bookingData });
            io.emit(socketEvents_1.EVENTS.BOOKING_NEW, booking);
            let pdfUrl = null;
            try {
                pdfUrl = await (0, pdf_1.generateBookingPDF)(booking);
            }
            catch { /* non-critical */ }
            res.json({ booking, pdfUrl });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to create booking' });
        }
    });
    router.get('/bookings', async (req, res) => {
        try {
            const bookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } });
            res.json(bookings);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch bookings' });
        }
    });
    router.patch('/bookings/:id/status', async (req, res) => {
        try {
            const booking = await bookingService.updateBookingStatus(req.params.id, req.body.status, req.body.paymentStatus);
            res.json(booking);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update booking status' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  ARTS & BIDS
    // ═══════════════════════════════════════════════════════════
    router.get('/arts', async (req, res) => {
        try {
            const arts = await prisma.art.findMany({
                include: { bids: { orderBy: { bidAmount: 'desc' } } },
                orderBy: { createdAt: 'desc' },
            });
            res.json(arts);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch arts' });
        }
    });
    router.post('/arts/:id/bids', upload.single('screenshot'), async (req, res) => {
        try {
            const bidData = {
                ...req.body,
                bidAmount: parseFloat(req.body.bidAmount) || 0,
                artId: req.params.id,
                transactionScreenshotUrl: req.file ? `/uploads/${req.file.filename}` : null,
            };
            delete bidData.screenshot;
            const bid = await prisma.artBid.create({ data: bidData, include: { art: true } });
            io.emit(socketEvents_1.EVENTS.BID_NEW, bid);
            let pdfUrl = null;
            try {
                pdfUrl = await (0, pdf_1.generateArtBidPDF)(bid);
            }
            catch { /* non-critical */ }
            res.json({ bid, pdfUrl });
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Bid failed' });
        }
    });
    router.post('/arts', upload.single('photo'), async (req, res) => {
        try {
            const artData = {
                ...req.body,
                price: parseFloat(req.body.price) || 0,
                imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
            };
            delete artData.photo;
            const art = await prisma.art.create({ data: artData });
            io.emit(socketEvents_1.EVENTS.ART_STATUS_UPDATED, art);
            res.json(art);
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to submit art' });
        }
    });
    router.patch('/arts/:id/status', async (req, res) => {
        try {
            const art = await prisma.art.update({
                where: { id: req.params.id },
                data: { status: req.body.status },
                include: { bids: { orderBy: { bidAmount: 'desc' } } },
            });
            io.emit(socketEvents_1.EVENTS.ART_STATUS_UPDATED, art);
            if (req.body.status === 'sold') {
                const amount = art.bids.length > 0 ? art.bids[0].bidAmount : art.price;
                const record = await prisma.accountingRecord.create({
                    data: {
                        source: 'art',
                        amount,
                        paymentMethod: art.bids.length > 0 ? (art.bids[0].paymentMethod || 'card') : 'card',
                        relatedId: art.id,
                    },
                });
                io.emit(socketEvents_1.EVENTS.ACCOUNTING_UPDATED, record);
            }
            res.json(art);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update art status' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  NEWS
    // ═══════════════════════════════════════════════════════════
    router.get('/news', async (req, res) => {
        try {
            const news = await prisma.news.findMany({ orderBy: { id: 'desc' } });
            res.json(news);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch news' });
        }
    });
    router.post('/news', upload.single('image'), async (req, res) => {
        try {
            const { titleEn, titleAr, descriptionEn, descriptionAr, type, startDate, endDate } = req.body;
            if (!titleEn || !titleAr || !type) {
                return res.status(400).json({ error: 'titleEn, titleAr and type are required' });
            }
            const newsItem = await prisma.news.create({
                data: {
                    titleEn, titleAr, descriptionEn, descriptionAr, type,
                    startDate: startDate ? new Date(startDate) : null,
                    endDate: endDate ? new Date(endDate) : null,
                    imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
                },
            });
            res.json(newsItem);
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to create news item' });
        }
    });
    router.delete('/news/:id', async (req, res) => {
        try {
            await prisma.news.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete news item' });
        }
    });
    router.patch('/news/:id/status', async (req, res) => {
        try {
            const news = await prisma.news.update({
                where: { id: req.params.id },
                data: { active: req.body.active },
            });
            res.json(news);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update news status' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  ACCOUNTING (read + internal writes only)
    // ═══════════════════════════════════════════════════════════
    router.get('/accounting', async (req, res) => {
        try {
            const records = await prisma.accountingRecord.findMany({ orderBy: { createdAt: 'desc' } });
            res.json(records);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch accounting records' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  WORKERS
    // ═══════════════════════════════════════════════════════════
    router.get('/workers', async (req, res) => {
        try {
            const workers = await prisma.user.findMany({
                select: { id: true, name: true, role: true, phone: true, email: true, active: true, createdAt: true },
                orderBy: { name: 'asc' },
            });
            res.json(workers);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch workers' });
        }
    });
    router.post('/workers', async (req, res) => {
        try {
            const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
            const { name, role, phone, email, password } = req.body;
            if (!name || !role || !password)
                return res.status(400).json({ error: 'name, role and password are required' });
            const passwordHash = await bcrypt.hash(password, 10);
            const worker = await prisma.user.create({
                data: { name, role, phone: phone || null, email: email || null, passwordHash },
                select: { id: true, name: true, role: true, phone: true, email: true, active: true, createdAt: true },
            });
            res.json(worker);
        }
        catch (err) {
            res.status(500).json({ error: err.message || 'Failed to create worker' });
        }
    });
    router.patch('/workers/:id', async (req, res) => {
        try {
            const { name, role, phone, email, active, password } = req.body;
            const data = {};
            if (name !== undefined)
                data.name = name;
            if (role !== undefined)
                data.role = role;
            if (phone !== undefined)
                data.phone = phone;
            if (email !== undefined)
                data.email = email;
            if (active !== undefined)
                data.active = active;
            if (password) {
                const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
                data.passwordHash = await bcrypt.hash(password, 10);
            }
            const worker = await prisma.user.update({
                where: { id: req.params.id },
                data,
                select: { id: true, name: true, role: true, phone: true, email: true, active: true, createdAt: true },
            });
            res.json(worker);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update worker' });
        }
    });
    router.delete('/workers/:id', async (req, res) => {
        try {
            await prisma.user.delete({ where: { id: req.params.id } });
            res.json({ success: true });
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to delete worker' });
        }
    });
    // (Old supplier routes removed — now under /inventory/suppliers)
    // ═══════════════════════════════════════════════════════════
    //  SYSTEM CONFIGURATION
    // ═══════════════════════════════════════════════════════════
    router.get('/config', async (req, res) => {
        try {
            const configs = await configService.getAllConfigs();
            res.json(configs);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch config' });
        }
    });
    router.post('/config', async (req, res) => {
        try {
            const { key, value } = req.body;
            if (!key || value === undefined)
                return res.status(400).json({ error: 'key and value are required' });
            const config = await configService.setConfig(key, String(value));
            res.json(config);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to update config' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  SHIFT LOGS
    // ═══════════════════════════════════════════════════════════
    router.get('/shifts', async (req, res) => {
        try {
            const shifts = await prisma.shiftLog.findMany({
                include: { user: { select: { name: true, role: true } } },
                orderBy: { startTime: 'desc' },
                take: 50,
            });
            res.json(shifts);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch shifts' });
        }
    });
    router.post('/shifts/start', async (req, res) => {
        try {
            const { userId } = req.body;
            if (!userId)
                return res.status(400).json({ error: 'userId is required' });
            const shift = await prisma.shiftLog.create({
                data: { userId },
                include: { user: { select: { name: true, role: true } } },
            });
            io.emit(socketEvents_1.EVENTS.SHIFT_STARTED, shift);
            res.json(shift);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to start shift' });
        }
    });
    router.patch('/shifts/:id/end', async (req, res) => {
        try {
            const { countedCash, notes } = req.body;
            // Calculate shift stats
            const shift = await prisma.shiftLog.findUnique({ where: { id: req.params.id } });
            if (!shift)
                return res.status(404).json({ error: 'Shift not found' });
            const ordersInShift = await prisma.order.findMany({
                where: {
                    status: 'completed',
                    createdAt: { gte: shift.startTime },
                },
            });
            const totalRevenue = ordersInShift.reduce((sum, o) => sum + o.total, 0);
            const totalTips = ordersInShift.reduce((sum, o) => sum + o.tipAmount, 0);
            const cashOrders = ordersInShift.filter(o => o.paymentMethod === 'cash');
            const expectedCash = cashOrders.reduce((sum, o) => sum + o.total, 0);
            const counted = parseFloat(countedCash) || 0;
            const updatedShift = await prisma.shiftLog.update({
                where: { id: req.params.id },
                data: {
                    endTime: new Date(),
                    expectedCash,
                    countedCash: counted,
                    discrepancy: counted - expectedCash,
                    totalRevenue,
                    totalOrders: ordersInShift.length,
                    totalTips,
                    notes: notes || null,
                },
                include: { user: { select: { name: true, role: true } } },
            });
            io.emit(socketEvents_1.EVENTS.SHIFT_ENDED, updatedShift);
            res.json(updatedShift);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to end shift' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  ANALYTICS
    // ═══════════════════════════════════════════════════════════
    router.get('/analytics/sales', async (req, res) => {
        try {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setHours(0, 0, 0, 0));
            const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
            const data = await orderService.getSalesBreakdown(startDate, endDate);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch sales analytics' });
        }
    });
    router.get('/analytics/waste', async (req, res) => {
        try {
            const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(new Date().setHours(0, 0, 0, 0));
            const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
            const data = await orderService.getWasteReport(startDate, endDate);
            res.json(data);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch waste report' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  AUTH (Staff Login)
    // ═══════════════════════════════════════════════════════════
    router.post('/auth/login', async (req, res) => {
        try {
            const bcrypt = await Promise.resolve().then(() => __importStar(require('bcryptjs')));
            const { email, password } = req.body;
            if (!email || !password)
                return res.status(400).json({ error: 'email and password are required' });
            const user = await prisma.user.findUnique({ where: { email } });
            if (!user || !user.active)
                return res.status(401).json({ error: 'Invalid credentials' });
            const valid = await bcrypt.compare(password, user.passwordHash);
            if (!valid)
                return res.status(401).json({ error: 'Invalid credentials' });
            // Return user info (no JWT — session managed client-side for simplicity)
            res.json({
                id: user.id,
                name: user.name,
                role: user.role,
                email: user.email,
                phone: user.phone,
            });
        }
        catch (err) {
            res.status(500).json({ error: 'Login failed' });
        }
    });
    /**
     * POST /api/auth/verify-pin
     * Verify a manager's 4-digit PIN for override actions.
     */
    router.post('/auth/verify-pin', async (req, res) => {
        try {
            const { userId, pin } = req.body;
            if (!userId || !pin)
                return res.status(400).json({ error: 'userId and pin are required' });
            const user = await prisma.user.findUnique({ where: { id: userId } });
            if (!user || user.role !== 'manager')
                return res.status(403).json({ error: 'Not authorized' });
            if (user.pin !== pin)
                return res.status(401).json({ error: 'Invalid PIN' });
            res.json({ valid: true });
        }
        catch (err) {
            res.status(500).json({ error: 'PIN verification failed' });
        }
    });
    // ═══════════════════════════════════════════════════════════
    //  LOYALTY
    // ═══════════════════════════════════════════════════════════
    router.get('/loyalty/:phone', async (req, res) => {
        try {
            let account = await prisma.loyaltyAccount.findUnique({
                where: { phoneNumber: req.params.phone },
            });
            if (!account) {
                account = await prisma.loyaltyAccount.create({
                    data: { phoneNumber: req.params.phone },
                });
            }
            res.json(account);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to fetch loyalty account' });
        }
    });
    router.post('/loyalty/:phone/earn', async (req, res) => {
        try {
            const { points, customerName } = req.body;
            const account = await prisma.loyaltyAccount.upsert({
                where: { phoneNumber: req.params.phone },
                update: {
                    pointsBalance: { increment: points },
                    totalEarned: { increment: points },
                    customerName: customerName || undefined,
                },
                create: {
                    phoneNumber: req.params.phone,
                    pointsBalance: points,
                    totalEarned: points,
                    customerName: customerName || null,
                },
            });
            res.json(account);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to add loyalty points' });
        }
    });
    router.post('/loyalty/:phone/redeem', async (req, res) => {
        try {
            const { points } = req.body;
            const account = await prisma.loyaltyAccount.findUnique({
                where: { phoneNumber: req.params.phone },
            });
            if (!account || account.pointsBalance < points) {
                return res.status(400).json({ error: 'Insufficient points' });
            }
            const updated = await prisma.loyaltyAccount.update({
                where: { phoneNumber: req.params.phone },
                data: {
                    pointsBalance: { decrement: points },
                    totalRedeemed: { increment: points },
                },
            });
            res.json(updated);
        }
        catch (err) {
            res.status(500).json({ error: 'Failed to redeem loyalty points' });
        }
    });
    return router;
}
