"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyService = void 0;
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
class LoyaltyService {
    /**
     * Get or create a loyalty account by phone number.
     */
    async getAccount(phoneNumber, customerName) {
        let account = await prisma.loyaltyAccount.findUnique({
            where: { phoneNumber }
        });
        if (!account) {
            account = await prisma.loyaltyAccount.create({
                data: {
                    phoneNumber,
                    customerName: customerName || null,
                    pointsBalance: 0,
                }
            });
        }
        return account;
    }
    /**
     * Earn points based on order total. (e.g., 100 EGP = 1 point)
     */
    async earnPoints(phoneNumber, amountSpent) {
        // 1 point for every 100 EGP
        const pointsToEarn = Math.floor(amountSpent / 100);
        if (pointsToEarn <= 0) {
            return await this.getAccount(phoneNumber);
        }
        return prisma.loyaltyAccount.update({
            where: { phoneNumber },
            data: {
                pointsBalance: { increment: pointsToEarn },
                totalEarned: { increment: pointsToEarn }
            }
        });
    }
    /**
     * Redeem points. (e.g., 1 point = 1 EGP discount)
     */
    async redeemPoints(phoneNumber, pointsToRedeem) {
        const account = await this.getAccount(phoneNumber);
        if (account.pointsBalance < pointsToRedeem) {
            throw new Error('Insufficient points balance');
        }
        return prisma.loyaltyAccount.update({
            where: { phoneNumber },
            data: {
                pointsBalance: { decrement: pointsToRedeem },
                totalRedeemed: { increment: pointsToRedeem }
            }
        });
    }
}
exports.LoyaltyService = LoyaltyService;
