import { PrismaClient } from '@prisma/client';
import { Server } from 'socket.io';
import { EVENTS } from '../socketEvents';

const prisma = new PrismaClient();

export class BookingService {
  private io: Server;

  constructor(io: Server) {
    this.io = io;
  }

  async isTimeSlotAvailable(date: string, startTime: string, endTime: string): Promise<boolean> {
    const existingBookings = await prisma.booking.findMany({
      where: {
        date,
        status: { in: ['pending', 'confirmed'] }
      }
    });

    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);

    for (const booking of existingBookings) {
      const bStartMinutes = this.timeToMinutes(booking.startTime);
      const bEndMinutes = this.timeToMinutes(booking.endTime);

      // Check for 30 minutes buffer rule
      // If our requested start time is before their end time + 30 mins
      // AND our requested end time is after their start time - 30 mins
      // Then it overlaps.
      if (startMinutes < bEndMinutes + 30 && endMinutes > bStartMinutes - 30) {
        return false;
      }
    }

    return true;
  }

  /**
   * Update a booking's status and emit to all clients.
   */
  async updateBookingStatus(bookingId: string, newStatus: string, paymentStatus?: string) {
    const data: any = { status: newStatus };
    if (paymentStatus) data.paymentStatus = paymentStatus;

    const booking = await prisma.booking.update({
      where: { id: bookingId },
      data,
    });

    this.io.emit(EVENTS.BOOKING_STATUS_UPDATED, booking);

    // If confirmed/completed, create accounting record
    if (newStatus === 'confirmed' || newStatus === 'completed') {
      if (booking.totalPrice > 0) {
        const record = await prisma.accountingRecord.create({
          data: {
            source: 'booking',
            amount: booking.totalPrice,
            paymentMethod: booking.paymentMethod || 'card',
            relatedId: booking.id,
          },
        });
        this.io.emit(EVENTS.ACCOUNTING_UPDATED, record);
      }
    }

    return booking;
  }

  private timeToMinutes(timeStr: string): number {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  }
}
