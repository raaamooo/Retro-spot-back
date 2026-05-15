import { Router } from 'express';
import { Server } from 'socket.io';
import { PrismaClient } from '@prisma/client';
import { OrderService } from '../services/OrderService';
import { InventoryService } from '../services/InventoryService';
import { BookingService } from '../services/BookingService';
import { generateLocationQR } from '../utils/qr';
import { generateReceiptPDF, generateBookingPDF, generateArtBidPDF } from '../utils/pdf';
import { EVENTS } from '../socketEvents';

import multer from 'multer';
import path from 'path';

export default function apiRoutes(io: Server, prisma: PrismaClient) {
  const router = Router();
  const inventoryService = new InventoryService(io);
  const orderService = new OrderService(io, inventoryService);
  const bookingService = new BookingService(io);

  // Configure Multer for local storage
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'public/uploads/'),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
  });
  const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5 MB cap

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
    } catch (err) {
      console.error('/menu error:', err);
      res.status(500).json({ error: 'Failed to fetch menu' });
    }
  });

  router.get('/ingredients', async (req, res) => {
    try {
      const ingredients = await prisma.ingredient.findMany({ orderBy: { nameEn: 'asc' } });
      res.json(ingredients);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch ingredients' });
    }
  });

  /**
   * PATCH /api/ingredients/:id
   * Manual stock adjustment by inventory worker.
   */
  router.patch('/ingredients/:id', async (req, res) => {
    try {
      const { quantityAvailable } = req.body;
      if (quantityAvailable === undefined || isNaN(Number(quantityAvailable))) {
        return res.status(400).json({ error: 'quantityAvailable must be a number' });
      }
      const ingredient = await inventoryService.updateStock(req.params.id, Number(quantityAvailable));
      res.json(ingredient);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update ingredient' });
    }
  });

  /**
   * PATCH /api/menu-items/:id
   * Toggle availability or active state.
   */
  router.patch('/menu-items/:id', async (req, res) => {
    try {
      const { available, active } = req.body;
      const data: any = {};
      if (available !== undefined) data.available = available;
      if (active !== undefined) data.active = active;

      const item = await prisma.menuItem.update({ where: { id: req.params.id }, data });

      const allItems = await prisma.menuItem.findMany({ select: { id: true, available: true } });
      io.emit(EVENTS.MENU_AVAILABILITY, allItems);

      res.json(item);
    } catch (err) {
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
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch menu items' });
    }
  });

  /**
   * POST /api/menu-categories
   */
  router.post('/menu-categories', async (req, res) => {
    try {
      const { nameEn, nameAr, sortOrder } = req.body;
      if (!nameEn || !nameAr) return res.status(400).json({ error: 'nameEn and nameAr are required' });
      const category = await prisma.menuCategory.create({
        data: { nameEn, nameAr, sortOrder: sortOrder ?? 0 },
      });
      res.json(category);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err: any) {
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
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete menu item' });
    }
  });

  /**
   * PATCH /api/menu-items/:id/details
   */
  router.patch('/menu-items/:id/details', upload.single('image'), async (req, res) => {
    try {
      const { nameEn, nameAr, descriptionEn, descriptionAr, price, tags, categoryId } = req.body;
      const data: any = {};
      if (nameEn !== undefined) data.nameEn = nameEn;
      if (nameAr !== undefined) data.nameAr = nameAr;
      if (descriptionEn !== undefined) data.descriptionEn = descriptionEn;
      if (descriptionAr !== undefined) data.descriptionAr = descriptionAr;
      if (price !== undefined) data.price = parseFloat(price);
      if (tags !== undefined) data.tags = tags;
      if (categoryId !== undefined) data.categoryId = categoryId;
      if (req.file) data.imageUrl = `/uploads/${req.file.filename}`;
      const item = await prisma.menuItem.update({
        where: { id: req.params.id as string },
        data,
        include: { category: { select: { nameEn: true, nameAr: true } } },
      });
      res.json(item);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update menu item details' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  RECIPES
  // ═══════════════════════════════════════════════════════════

  router.get('/menu-items/:id/recipes', async (req, res) => {
    try {
      const recipes = await prisma.recipe.findMany({
        where: { menuItemId: req.params.id },
        include: { ingredient: true },
      });
      res.json(recipes);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch recipes' });
    }
  });

  router.put('/menu-items/:id/recipes', async (req, res) => {
    try {
      const menuItemId = req.params.id;
      const lines: { ingredientId: string; quantityUsed: number }[] = req.body;

      await prisma.recipe.deleteMany({ where: { menuItemId } });
      if (lines.length > 0) {
        await prisma.recipe.createMany({
          data: lines.map(l => ({ menuItemId, ingredientId: l.ingredientId, quantityUsed: l.quantityUsed })),
        });
      }

      const allRecipes = await prisma.recipe.findMany({
        where: { menuItemId },
        include: { ingredient: true },
      });
      const allInStock = allRecipes.length === 0 || allRecipes.every(r => r.ingredient.quantityAvailable > 0);
      await prisma.menuItem.update({ where: { id: menuItemId }, data: { available: allInStock } });

      const allItems = await prisma.menuItem.findMany({ select: { id: true, available: true } });
      io.emit(EVENTS.MENU_AVAILABILITY, allItems);

      res.json({ success: true, available: allInStock });
    } catch (err) {
      res.status(500).json({ error: 'Failed to update recipes' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  LOCATIONS
  // ═══════════════════════════════════════════════════════════

  router.get('/locations', async (req, res) => {
    try {
      const locations = await prisma.location.findMany({ where: { active: true } });
      res.json(locations);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  });

  router.post('/locations', async (req, res) => {
    try {
      const { name, type } = req.body;
      if (!name || !type) return res.status(400).json({ error: 'name and type are required' });
      const location = await prisma.location.create({ data: { name, type } });
      res.json(location);
    } catch (err) {
      res.status(500).json({ error: 'Failed to create location' });
    }
  });

  router.delete('/locations/:id', async (req, res) => {
    try {
      await prisma.location.update({ where: { id: req.params.id }, data: { active: false } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete location' });
    }
  });

  router.get('/locations/:id/qr', async (req, res) => {
    try {
      const baseUrl = (req.query.baseUrl as string) || process.env.FRONTEND_URL || 'http://localhost:3000';
      const qrDataUrl = await generateLocationQR(req.params.id, baseUrl);
      res.json({ qrCodeUrl: qrDataUrl });
    } catch (err) {
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
    } catch (err) {
      res.status(500).json({ error: 'Failed to place order' });
    }
  });

  router.patch('/orders/:id/status', async (req, res) => {
    try {
      const order = await orderService.updateOrderStatus(req.params.id, req.body.status);
      res.json(order);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update order status' });
    }
  });

  router.get('/orders', async (req, res) => {
    try {
      const where: any = {};
      if (req.query.status) where.status = req.query.status as string;

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
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch orders' });
    }
  });

  router.delete('/orders/:id', async (req, res) => {
    try {
      await prisma.orderItem.deleteMany({ where: { orderId: req.params.id } });
      await prisma.order.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete order' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  RECEIPT GENERATION
  // ═══════════════════════════════════════════════════════════

  router.post('/receipts/generate', async (req, res) => {
    try {
      const { orders, tableId } = req.body;
      const pdfUrl = await generateReceiptPDF(orders, tableId);
      res.json({ pdfUrl });
    } catch (err) {
      res.status(500).json({ error: 'Failed to generate receipt' });
    }
  });

  // ═══════════════════════════════════════════════════════════
  //  WAITER CALLS
  // ═══════════════════════════════════════════════════════════

  router.post('/waitercalls', async (req, res) => {
    try {
      const call = await prisma.waiterCall.create({
        data: { locationId: req.body.locationId },
        include: { location: true },
      });
      io.emit(EVENTS.WAITER_CALL_NEW, call);
      res.json(call);
    } catch (err) {
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
    } catch (err) {
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
      io.emit(EVENTS.WAITER_CALL_RESOLVED, call);
      res.json(call);
    } catch (err) {
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

      const bookingData: any = {
        ...req.body,
        peopleCount: parseInt(peopleCount) || 1,
        totalPrice: parseFloat(totalPrice) || 0,
        transactionScreenshotUrl: req.file ? `/uploads/${req.file.filename}` : null,
      };
      delete bookingData.screenshot;

      const booking = await prisma.booking.create({ data: bookingData });
      io.emit(EVENTS.BOOKING_NEW, booking);

      let pdfUrl = null;
      try { pdfUrl = await generateBookingPDF(booking); } catch { /* non-critical */ }
      res.json({ booking, pdfUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create booking' });
    }
  });

  router.get('/bookings', async (req, res) => {
    try {
      const bookings = await prisma.booking.findMany({ orderBy: { createdAt: 'desc' } });
      res.json(bookings);
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch bookings' });
    }
  });

  router.patch('/bookings/:id/status', async (req, res) => {
    try {
      const booking = await bookingService.updateBookingStatus(
        req.params.id, req.body.status, req.body.paymentStatus,
      );
      res.json(booking);
    } catch (err) {
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
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch arts' });
    }
  });

  router.post('/arts/:id/bids', upload.single('screenshot'), async (req, res) => {
    try {
      const bidData: any = {
        ...req.body,
        bidAmount: parseFloat(req.body.bidAmount) || 0,
        artId: req.params.id,
        transactionScreenshotUrl: req.file ? `/uploads/${req.file.filename}` : null,
      };
      delete bidData.screenshot;

      const bid = await prisma.artBid.create({ data: bidData, include: { art: true } });
      io.emit(EVENTS.BID_NEW, bid);

      let pdfUrl = null;
      try { pdfUrl = await generateArtBidPDF(bid); } catch { /* non-critical */ }
      res.json({ bid, pdfUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Bid failed' });
    }
  });

  router.post('/arts', upload.single('photo'), async (req, res) => {
    try {
      const artData: any = {
        ...req.body,
        price: parseFloat(req.body.price) || 0,
        imageUrl: req.file ? `/uploads/${req.file.filename}` : null,
      };
      delete artData.photo;

      const art = await prisma.art.create({ data: artData });
      io.emit(EVENTS.ART_STATUS_UPDATED, art);
      res.json(art);
    } catch (err: any) {
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
      io.emit(EVENTS.ART_STATUS_UPDATED, art);

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
        io.emit(EVENTS.ACCOUNTING_UPDATED, record);
      }

      res.json(art);
    } catch (err) {
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
    } catch (err) {
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
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create news item' });
    }
  });

  router.delete('/news/:id', async (req, res) => {
    try {
      await prisma.news.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
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
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch workers' });
    }
  });

  router.post('/workers', async (req, res) => {
    try {
      const bcrypt = await import('bcryptjs');
      const { name, role, phone, email, password } = req.body;
      if (!name || !role || !password) return res.status(400).json({ error: 'name, role and password are required' });
      const passwordHash = await bcrypt.hash(password, 10);
      const worker = await prisma.user.create({
        data: { name, role, phone: phone || null, email: email || null, passwordHash },
        select: { id: true, name: true, role: true, phone: true, email: true, active: true, createdAt: true },
      });
      res.json(worker);
    } catch (err: any) {
      res.status(500).json({ error: err.message || 'Failed to create worker' });
    }
  });

  router.patch('/workers/:id', async (req, res) => {
    try {
      const { name, role, phone, email, active, password } = req.body;
      const data: any = {};
      if (name !== undefined) data.name = name;
      if (role !== undefined) data.role = role;
      if (phone !== undefined) data.phone = phone;
      if (email !== undefined) data.email = email;
      if (active !== undefined) data.active = active;
      if (password) {
        const bcrypt = await import('bcryptjs');
        data.passwordHash = await bcrypt.hash(password, 10);
      }
      
      const worker = await prisma.user.update({
        where: { id: req.params.id },
        data,
        select: { id: true, name: true, role: true, phone: true, email: true, active: true, createdAt: true },
      });
      res.json(worker);
    } catch (err) {
      res.status(500).json({ error: 'Failed to update worker' });
    }
  });

  router.delete('/workers/:id', async (req, res) => {
    try {
      await prisma.user.delete({ where: { id: req.params.id } });
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: 'Failed to delete worker' });
    }
  });

  return router;
}
