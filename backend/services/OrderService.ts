import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { InventoryService } from './InventoryService';
import { ConfigService } from './ConfigService';
import { EVENTS } from '../socketEvents';

const prisma = new PrismaClient();

export class OrderService {
  private io: Server;
  private inventoryService: InventoryService;
  private configService: ConfigService;

  constructor(io: Server, inventoryService: InventoryService, configService?: ConfigService) {
    this.io = io;
    this.inventoryService = inventoryService;
    this.configService = configService || new ConfigService(io);
  }

  async placeOrder(data: any) {
    try {
      const resolvedOrderType = data.orderType || data.type || 'dine_in';

      // Allow locationId to be either the ID or the Name of the table
      let location = null;
      if (data.locationId) {
        location = await prisma.location.findFirst({
          where: {
            OR: [
              { id: data.locationId },
              { name: data.locationId }
            ]
          }
        });
      }

      // Safeguard / Fallback for Takeaway orders
      if (!location && resolvedOrderType === 'takeaway') {
        location = await prisma.location.findFirst({
          where: {
            OR: [
              { type: 'takeaway' },
              { name: { equals: 'Takeaway', mode: 'insensitive' } }
            ]
          }
        });
      }

      // Final ultimate fallback to avoid failing the order placement
      if (!location) {
        location = await prisma.location.findFirst({ where: { active: true } });
      }

      if (!location) {
        throw new Error(`Location not found and no active fallback locations exist.`);
      }

      // Calculate tax and service charge from config
      const taxRate = await this.configService.getNumber('taxRate');
      const serviceChargeRate = await this.configService.getNumber('serviceChargeRate');

      const itemSubtotal = data.subtotal || 0;
      const discountAmount = data.discountAmount || 0;
      const afterDiscount = itemSubtotal - discountAmount;
      const taxAmount = data.taxAmount !== undefined ? data.taxAmount : Math.round(afterDiscount * taxRate) / 100;
      const serviceCharge = data.serviceCharge !== undefined ? data.serviceCharge : Math.round(afterDiscount * serviceChargeRate) / 100;
      const tipAmount = data.tipAmount || 0;
      const total = data.total || (afterDiscount + taxAmount + serviceCharge + tipAmount);

      const order = await prisma.order.create({
        data: {
          locationId: location.id,
          customerName: data.customerName,
          notes: data.notes,
          paymentMethod: data.paymentMethod,
          tipAmount,
          subtotal: itemSubtotal,
          taxAmount,
          discountAmount,
          serviceCharge,
          total,
          orderType: resolvedOrderType,
          priority: data.priority || 'normal',
          assignedWaiterId: data.assignedWaiterId || null,
          splitPayments: data.splitPayments ? JSON.stringify(data.splitPayments) : null,
          status: 'barista', // immediately goes to barista
          items: {
            create: data.items.map((item: any) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              additions: item.additions,
              itemPriceAtTime: item.itemPriceAtTime,
              notes: item.notes,
              status: 'ordered',
            }))
          }
        },
        include: {
          items: { include: { menuItem: true } },
          location: true
        }
      });

      // Auto-deplete inventory
      await this.inventoryService.depleteInventoryForOrder(order.id);

      // Notify all clients (barista page, manager page, etc.)
      this.io.emit(EVENTS.ORDER_NEW, order);
      return order;
    } catch (error) {
      console.error('[OrderService:placeOrder] ERROR:', error);
      throw error;
    }
  }

  async updateOrderStatus(orderId: string, newStatus: string) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { status: newStatus },
      include: {
        items: { include: { menuItem: true } },
        location: true
      }
    });

    // Emit unified status update event
    this.io.emit(EVENTS.ORDER_STATUS_UPDATED, order);

    // If completed, create accounting record
    if (newStatus === 'completed') {
      const record = await prisma.accountingRecord.create({
        data: {
          source: 'menu',
          amount: order.total,
          paymentMethod: order.paymentMethod || 'cash',
          relatedId: order.id,
        },
      });
      this.io.emit(EVENTS.ACCOUNTING_UPDATED, record);
    }
    return order;
  }

  async archiveOrder(orderId: string, archived: boolean = true) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { archived },
      include: {
        items: { include: { menuItem: true } },
        location: true
      }
    });

    this.io.emit(EVENTS.ORDER_STATUS_UPDATED, order);
    return order;
  }

  async updateOrder(orderId: string, data: any) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        customerName: data.customerName !== undefined ? data.customerName : undefined,
        notes: data.notes !== undefined ? data.notes : undefined,
        paymentMethod: data.paymentMethod !== undefined ? data.paymentMethod : undefined,
        tipAmount: data.tipAmount !== undefined ? data.tipAmount : undefined,
        subtotal: data.subtotal !== undefined ? data.subtotal : undefined,
        taxAmount: data.taxAmount !== undefined ? data.taxAmount : undefined,
        discountAmount: data.discountAmount !== undefined ? data.discountAmount : undefined,
        serviceCharge: data.serviceCharge !== undefined ? data.serviceCharge : undefined,
        total: data.total !== undefined ? data.total : undefined,
        orderType: data.orderType !== undefined ? data.orderType : (data.type !== undefined ? data.type : undefined),
        priority: data.priority !== undefined ? data.priority : undefined,
        splitPayments: data.splitPayments !== undefined ? JSON.stringify(data.splitPayments) : undefined,
        items: data.items ? {
          deleteMany: {},
          create: data.items.map((item: any) => ({
            menuItemId: item.menuItemId,
            quantity: item.quantity,
            additions: item.additions,
            itemPriceAtTime: item.itemPriceAtTime,
            notes: item.notes,
            status: item.status || 'ordered',
          }))
        } : undefined
      },
      include: {
        items: { include: { menuItem: true } },
        location: true
      }
    });

    this.io.emit(EVENTS.ORDER_STATUS_UPDATED, order);
    return order;
  }

  /**
   * Update an individual order item's status (ordered → preparing → ready → served).
   */
  async updateItemStatus(orderItemId: string, newStatus: string) {
    const item = await prisma.orderItem.update({
      where: { id: orderItemId },
      data: { status: newStatus },
      include: { menuItem: true, order: { include: { location: true } } },
    });

    this.io.emit(EVENTS.ORDER_ITEM_STATUS_UPDATED, item);
    return item;
  }

  /**
   * Void a specific item in an order.
   */
  async voidItem(orderId: string, itemId: string, reason: string, staffName: string) {
    const item = await prisma.orderItem.update({
      where: { id: itemId },
      data: { voided: true, voidReason: reason },
      include: { menuItem: true },
    });

    // Recalculate order totals excluding voided items
    const order = await this.recalculateOrderTotals(orderId);

    this.io.emit(EVENTS.ORDER_STATUS_UPDATED, order);
    return { item, order };
  }

  /**
   * Process a refund (partial or full).
   */
  async refundOrder(orderId: string, amount: number, reason: string) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: {
        refundAmount: amount,
        refundReason: reason,
      },
      include: {
        items: { include: { menuItem: true } },
        location: true,
      },
    });

    // Create a negative accounting record for the refund
    await prisma.accountingRecord.create({
      data: {
        source: 'menu',
        amount: -amount,
        paymentMethod: order.paymentMethod || 'cash',
        relatedId: order.id,
      },
    });

    this.io.emit(EVENTS.ORDER_STATUS_UPDATED, order);
    return order;
  }

  /**
   * Flag an order as rush priority.
   */
  async setRushPriority(orderId: string) {
    const order = await prisma.order.update({
      where: { id: orderId },
      data: { priority: 'rush' },
      include: {
        items: { include: { menuItem: true } },
        location: true,
      },
    });

    this.io.emit(EVENTS.ORDER_RUSH_FLAGGED, order);
    return order;
  }

  /**
   * Recalculate order totals (used after voiding items).
   */
  private async recalculateOrderTotals(orderId: string) {
    const items = await prisma.orderItem.findMany({
      where: { orderId, voided: false },
    });

    const subtotal = items.reduce((sum, item) => sum + item.itemPriceAtTime * item.quantity, 0);

    const currentOrder = await prisma.order.findUnique({ where: { id: orderId } });
    if (!currentOrder) throw new Error('Order not found');

    const taxRate = await this.configService.getNumber('taxRate');
    const serviceChargeRate = await this.configService.getNumber('serviceChargeRate');
    const discountAmount = currentOrder.discountAmount || 0;
    const afterDiscount = subtotal - discountAmount;
    const taxAmount = Math.round(afterDiscount * taxRate) / 100;
    const serviceCharge = Math.round(afterDiscount * serviceChargeRate) / 100;
    const total = afterDiscount + taxAmount + serviceCharge + (currentOrder.tipAmount || 0);

    return prisma.order.update({
      where: { id: orderId },
      data: { subtotal, taxAmount, serviceCharge, total },
      include: {
        items: { include: { menuItem: true } },
        location: true,
      },
    });
  }

  /**
   * Get analytics data — sales breakdown by category.
   */
  async getSalesBreakdown(startDate: Date, endDate: Date) {
    const orders = await prisma.order.findMany({
      where: {
        status: 'completed',
        createdAt: { gte: startDate, lte: endDate },
      },
      include: {
        items: {
          where: { voided: false },
          include: {
            menuItem: {
              include: { category: { select: { nameEn: true } } },
            },
          },
        },
      },
    });

    const categoryTotals: Record<string, number> = {};
    const hourlyRevenue: Record<number, number> = {};

    for (const order of orders) {
      const hour = new Date(order.createdAt).getHours();
      hourlyRevenue[hour] = (hourlyRevenue[hour] || 0) + order.total;

      for (const item of order.items) {
        const cat = item.menuItem.category?.nameEn || 'Uncategorized';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + item.itemPriceAtTime * item.quantity;
      }
    }

    return {
      totalRevenue: orders.reduce((sum, o) => sum + o.total, 0),
      totalOrders: orders.length,
      averageTicket: orders.length > 0 ? orders.reduce((sum, o) => sum + o.total, 0) / orders.length : 0,
      categoryBreakdown: categoryTotals,
      hourlyRevenue,
    };
  }

  /**
   * Get waste/loss report — voided items, refunds.
   */
  async getWasteReport(startDate: Date, endDate: Date) {
    const voidedItems = await prisma.orderItem.findMany({
      where: {
        voided: true,
        order: { createdAt: { gte: startDate, lte: endDate } },
      },
      include: { menuItem: true, order: { select: { createdAt: true, location: true } } },
    });

    const refundedOrders = await prisma.order.findMany({
      where: {
        refundAmount: { gt: 0 },
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { location: true },
    });

    const voidCost = voidedItems.reduce((sum, item) => sum + item.itemPriceAtTime * item.quantity, 0);
    const refundCost = refundedOrders.reduce((sum, o) => sum + o.refundAmount, 0);

    return {
      voidedItems,
      refundedOrders,
      totalVoidCost: voidCost,
      totalRefundCost: refundCost,
      totalLoss: voidCost + refundCost,
    };
  }
}
