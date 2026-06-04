import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class LoyaltyService {
  /**
   * Get or create a loyalty account by phone number.
   */
  async getAccount(phoneNumber: string, customerName?: string) {
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
  async earnPoints(phoneNumber: string, amountSpent: number) {
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
  async redeemPoints(phoneNumber: string, pointsToRedeem: number) {
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
