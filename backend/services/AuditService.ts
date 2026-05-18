import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { EVENTS } from '../socketEvents';

const prisma = new PrismaClient();

export class AuditService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Log an inventory stock change.
   */
  async logStockChange(
    ingredientId: string,
    previousQty: number,
    newQty: number,
    reason: string,
    staffName: string,
    details?: string
  ) {
    const log = await prisma.stockChangeLog.create({
      data: {
        ingredientId,
        previousQty,
        newQty,
        reason,
        staffName,
        details: details || null,
      },
      include: { ingredient: true },
    });

    this.io.emit(EVENTS.STOCK_CHANGE_LOGGED, log);
    return log;
  }

  /**
   * Get stock change logs, optionally filtered by ingredient.
   */
  async getStockChangeLogs(ingredientId?: string, limit: number = 100) {
    const where = ingredientId ? { ingredientId } : {};
    return prisma.stockChangeLog.findMany({
      where,
      include: { ingredient: { select: { nameEn: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get all logs for a specific date range.
   */
  async getLogsByDateRange(startDate: Date, endDate: Date) {
    return prisma.stockChangeLog.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
      include: { ingredient: { select: { nameEn: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
