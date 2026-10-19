import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { AppError } from '../../../shared/errors/app-error.js';
import type {
  BookingPaymentPort,
  LockedPurchase,
} from '../../payments/application/payment.ports.js';
import { allocationLocks, clearSeats } from '../allocation/allocation.service.js';
import { setBookingStatus } from '../orders/booking-write.repository.js';
import * as repo from '../shared/booking.repository.js';
import { assertSale } from '../shared/booking.policy.js';
import { BookingPaymentRepository } from './booking-payment.repository.js';
export class BookingPaymentAdapter implements BookingPaymentPort {
  constructor(private readonly repository = new BookingPaymentRepository()) {}
  authorize(
    db: PoolClient,
    actor: RequestActor,
    permission: 'booking.create' | 'booking.read_self' = 'booking.create',
  ) {
    return repo.requireBuyer(db, actor, permission);
  }
  async lock(db: PoolClient, id: string, ownerId?: string): Promise<LockedPurchase> {
    const meta = await this.repository.lookup(db, id, ownerId);
    if (!meta) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt vé.');
    const locked = await allocationLocks(
      db,
      await repo.holdRow(db, meta.hold_id, meta.customer_id),
    );
    const details = await this.repository.details(db, id),
      time = await repo.now(db);
    let publicSale = true;
    try {
      assertSale(locked.context, time);
    } catch {
      publicSale = false;
    }
    const items = await this.repository.items(db, id);
    return {
      id,
      customerId: meta.customer_id,
      sessionId: locked.hold.session_id,
      holdId: meta.hold_id,
      status: details.status,
      confirmedPaymentId: details.confirmed_payment_id,
      expiresAt: details.expires_at,
      expired: details.expires_at <= time,
      amount: details.total_minor,
      currency: details.currency,
      items,
      canConfirm:
        details.status === 'AWAITING_PAYMENT' &&
        details.expires_at > time &&
        publicSale &&
        details.customer_active &&
        items.length > 0 &&
        locked.seats.length === items.length &&
        locked.seats.every(
          (s) =>
            s.status === 'HELD' &&
            s.hold_id === meta.hold_id &&
            s.current_booking_id === id &&
            s.hold_expires_at &&
            s.hold_expires_at > time,
        ),
    };
  }
  async validateAttendees(db: PoolClient, purchase: LockedPurchase) {
    const items = await this.repository.items(db, purchase.id);
    return (
      items.length > 0 && items.length === purchase.items.length && items.every((i) => i.eligible)
    );
  }
  confirm(db: PoolClient, purchase: LockedPurchase, paymentId: string) {
    return this.repository.confirm(db, purchase.id, paymentId);
  }
  async terminate(db: PoolClient, purchase: LockedPurchase, status: 'EXPIRED' | 'CANCELLED') {
    if (purchase.status !== 'AWAITING_PAYMENT') return;
    await clearSeats(db, purchase.holdId);
    await setBookingStatus(db, purchase.id, status);
  }
}
