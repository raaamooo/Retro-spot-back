import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { InventoryService } from './InventoryService';
import { EVENTS } from '../socketEvents';

const prisma = new PrismaClient();

export class OrderService {
  private io: Server;
  private inventoryService: InventoryService;

  constructor(io: Server, inventoryService: InventoryService) {
    this.io = io;
    this.inventoryService = inventoryService;
  }

  async placeOrder(data: any) {
    try {
      // Allow locationId to be either the ID or the Name of the table
      let location = await prisma.location.findFirst({
        where: {
          OR: [
            { id: data.locationId },
            { name: data.locationId }
          ]
        }
      });

      if (!location) {
        throw new Error(`Location not found for identifier: ${data.locationId}`);
      }

      const order = await prisma.order.create({
        data: {
          locationId: location.id,
          customerName: data.customerName,
          notes: data.notes,
          paymentMethod: data.paymentMethod,
          tipAmount: data.tipAmount || 0,
          subtotal: data.subtotal,
          total: data.total,
          status: 'barista', // immediately goes to barista
          items: {
            create: data.items.map((item: any) => ({
              menuItemId: item.menuItemId,
              quantity: item.quantity,
              additions: item.additions,
              itemPriceAtTime: item.itemPriceAtTime,
              notes: item.notes
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
}
