"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuditService = void 0;
const client_1 = require("@prisma/client");
const socketEvents_1 = require("../socketEvents");
const prisma = new client_1.PrismaClient();
class AuditService {
    io;
    constructor(io) {
        this.io = io;
    }
    /**
     * Log an inventory stock change.
     */
    async logStockChange(ingredientId, previousQty, newQty, reason, staffName, details) {
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
        this.io.emit(socketEvents_1.EVENTS.STOCK_CHANGE_LOGGED, log);
        return log;
    }
    /**
     * Get stock change logs, optionally filtered by ingredient.
     */
    async getStockChangeLogs(ingredientId, limit = 100) {
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
    async getLogsByDateRange(startDate, endDate) {
        return prisma.stockChangeLog.findMany({
            where: {
                createdAt: { gte: startDate, lte: endDate },
            },
            include: { ingredient: { select: { nameEn: true, unit: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
}
exports.AuditService = AuditService;
