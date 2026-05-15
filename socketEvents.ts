/**
 * ═══════════════════════════════════════════════════════════════
 *  RETRO SPOT — Socket.IO Event Registry & Server Handlers
 * ═══════════════════════════════════════════════════════════════
 *
 *  This file is the SINGLE SOURCE OF TRUTH for all realtime
 *  event names used across the Retro Spot platform.
 *
 *  NAMING CONVENTION:
 *    <DOMAIN>:<ACTION>
 *
 *  All events are emitted SERVER → CLIENT only.
 *  Client mutations go through REST API endpoints, which
 *  trigger the appropriate socket emissions on the server side.
 *
 * ═══════════════════════════════════════════════════════════════
 */

import { Server, Socket } from 'socket.io';
import { PrismaClient } from '@prisma/client';

// ─── EVENT NAME CONSTANTS ──────────────────────────────────────

export const EVENTS = {
  // ── Orders ──
  /** Emitted when a new order is placed via the menu page. */
  ORDER_NEW: 'order:new',
  /** Emitted when any order's status changes (placed→barista→waiter→cashier→completed). */
  ORDER_STATUS_UPDATED: 'order:status_updated',

  // ── Waiter Calls ──
  /** Emitted when a customer taps "Call Waiter" from the menu page. */
  WAITER_CALL_NEW: 'waiter_call:new',
  /** Emitted when a waiter resolves/handles a call. */
  WAITER_CALL_RESOLVED: 'waiter_call:resolved',

  // ── Inventory ──
  /** Emitted when ingredient stock levels change (full ingredient list). */
  INVENTORY_UPDATED: 'inventory:updated',
  /** Emitted when a specific ingredient drops below its low-stock threshold. */
  INVENTORY_LOW_STOCK: 'inventory:low_stock',
  /** Emitted when menu item availability changes due to inventory. */
  MENU_AVAILABILITY: 'menu:availability',

  // ── Bookings ──
  /** Emitted when a customer submits a new booking. */
  BOOKING_NEW: 'booking:new',
  /** Emitted when organizer updates a booking's status. */
  BOOKING_STATUS_UPDATED: 'booking:status_updated',

  // ── Arts & Bids ──
  /** Emitted when a customer places a new bid on an art piece. */
  BID_NEW: 'bid:new',
  /** Emitted when organizer updates an art piece's status (approved, sold, etc.). */
  ART_STATUS_UPDATED: 'art:status_updated',

  // ── Accounting ──
  /** Emitted when a new accounting record is created. */
  ACCOUNTING_UPDATED: 'accounting:updated',
} as const;

// Type helper for event names
export type EventName = (typeof EVENTS)[keyof typeof EVENTS];


// ─── SERVER-SIDE SOCKET CONNECTION HANDLER ─────────────────────

/**
 * Registers the Socket.IO connection handler.
 * Called once from server.ts at startup.
 *
 * Client-to-server events handled here are convenience shortcuts
 * for admin dashboards that need quick status updates.
 * Primary mutations should still go through REST API.
 */
export function registerSocketHandlers(io: Server, prisma: PrismaClient) {
  io.on('connection', (socket: Socket) => {
    console.log(`[Socket] Client connected: ${socket.id}`);

    // ── Client requests: Update order status (admin convenience) ──
    socket.on('update_order_status', async (data: { id: string; status: string }) => {
      try {
        const order = await prisma.order.update({
          where: { id: data.id },
          data: { status: data.status },
          include: {
            items: { include: { menuItem: true } },
            location: true,
          },
        });

        io.emit(EVENTS.ORDER_STATUS_UPDATED, order);

        // If completed, create accounting record
        if (data.status === 'completed') {
          const record = await prisma.accountingRecord.create({
            data: {
              source: 'menu',
              amount: order.total,
              paymentMethod: order.paymentMethod || 'cash',
              relatedId: order.id,
            },
          });
          io.emit(EVENTS.ACCOUNTING_UPDATED, record);
        }
      } catch (err) {
        console.error('[Socket] Failed to update order status:', err);
      }
    });

    // ── Client requests: Resolve waiter call ──
    socket.on('resolve_waiter_call', async (data: { id: string }) => {
      try {
        const call = await prisma.waiterCall.update({
          where: { id: data.id },
          data: { status: 'resolved', resolvedAt: new Date() },
          include: { location: true },
        });
        io.emit(EVENTS.WAITER_CALL_RESOLVED, call);
      } catch (err) {
        console.error('[Socket] Failed to resolve waiter call:', err);
      }
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
}