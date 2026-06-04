import { Server } from 'socket.io';

/**
 * ═══════════════════════════════════════════════════════════════
 *  NotificationService — Email + SMS + Socket.IO notifications
 * ═══════════════════════════════════════════════════════════════
 *
 *  Graceful fallback: if SMTP/Twilio credentials are not configured,
 *  notifications are logged to console instead of crashing.
 */

interface IngredientAlert {
  id: string;
  nameEn: string;
  nameAr: string;
  currentStock: number;
  minimumStock: number;
  unit: string;
}

export class NotificationService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  /**
   * Send email notification (graceful fallback to console.log).
   */
  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    const smtpHost = process.env.SMTP_HOST;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      console.log(`[NotificationService] EMAIL (no SMTP configured): To=${to} Subject="${subject}"`);
      console.log(`[NotificationService] Body: ${body}`);
      return;
    }

    try {
      // @ts-ignore - nodemailer is optional; only loaded when SMTP credentials are configured
      const nodemailer = await import('nodemailer');
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: smtpUser,
        to,
        subject,
        text: body,
      });
      console.log(`[NotificationService] Email sent to ${to}: ${subject}`);
    } catch (err) {
      console.error('[NotificationService] Email failed:', err);
    }
  }

  /**
   * Send SMS notification (graceful fallback to console.log).
   */
  async sendSMS(to: string, message: string): Promise<void> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      console.log(`[NotificationService] SMS (no Twilio configured): To=${to} Message="${message}"`);
      return;
    }

    try {
      // @ts-ignore - twilio is optional; only loaded when Twilio credentials are configured
      const twilio = await import('twilio');
      const client = (twilio as any).default
        ? (twilio as any).default(accountSid, authToken)
        : (twilio as any)(accountSid, authToken);

      await client.messages.create({
        body: message,
        from: fromNumber,
        to,
      });
      console.log(`[NotificationService] SMS sent to ${to}`);
    } catch (err) {
      console.error('[NotificationService] SMS failed:', err);
    }
  }

  /**
   * Notify admins about low stock via all channels.
   */
  async notifyLowStock(ingredient: IngredientAlert): Promise<void> {
    // Socket.IO
    this.io.emit('inventory:low_stock', ingredient);

    // Email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await this.sendEmail(
        adminEmail,
        `[Retro Spot] Low Stock Alert: ${ingredient.nameEn}`,
        `Low Stock Alert\n\nIngredient: ${ingredient.nameEn} (${ingredient.nameAr})\nCurrent Stock: ${ingredient.currentStock} ${ingredient.unit}\nMinimum Stock: ${ingredient.minimumStock} ${ingredient.unit}\n\nPlease restock soon.\n\n— Retro Spot Inventory System`
      );
    }

    // SMS
    const adminPhone = process.env.ADMIN_PHONE;
    if (adminPhone) {
      await this.sendSMS(
        adminPhone,
        `[Retro Spot] Low Stock Alert: ${ingredient.nameEn} — ${ingredient.currentStock} ${ingredient.unit} remaining`
      );
    }

    // In-app notification
    this.io.emit('notification:new', {
      type: 'low_stock',
      title: 'Low Stock Alert',
      message: `${ingredient.nameEn} is running low (${ingredient.currentStock} ${ingredient.unit} remaining)`,
      data: ingredient,
    });
  }

  /**
   * Notify admins about out-of-stock via all channels.
   */
  async notifyOutOfStock(ingredient: IngredientAlert): Promise<void> {
    // Socket.IO
    this.io.emit('inventory:out_of_stock', ingredient);

    // Email
    const adminEmail = process.env.ADMIN_EMAIL;
    if (adminEmail) {
      await this.sendEmail(
        adminEmail,
        `[Retro Spot] OUT OF STOCK: ${ingredient.nameEn}`,
        `OUT OF STOCK ALERT\n\nIngredient: ${ingredient.nameEn} (${ingredient.nameAr})\nCurrent Stock: 0 ${ingredient.unit}\n\nAffected menu items have been automatically disabled.\n\n— Retro Spot Inventory System`
      );
    }

    // SMS
    const adminPhone = process.env.ADMIN_PHONE;
    if (adminPhone) {
      await this.sendSMS(
        adminPhone,
        `[Retro Spot] OUT OF STOCK: ${ingredient.nameEn} — 0 ${ingredient.unit} remaining. Menu items disabled.`
      );
    }

    // In-app notification
    this.io.emit('notification:new', {
      type: 'low_stock',
      title: 'Out of Stock!',
      message: `${ingredient.nameEn} is completely out of stock. Affected menu items disabled.`,
      data: ingredient,
    });
  }
}
