import type { PoolClient } from 'pg';
import type { RefundBookingPort } from '../../refunds/refund.ports.js';
import type { LockedPurchase } from '../../payments/application/payment.ports.js';
import { BookingPaymentAdapter } from '../payments/booking-payment.adapter.js';
import { BookingRefundRepository } from './booking-refund.repository.js';
import { quota } from '../shared/booking.repository.js';
export class BookingRefundAdapter implements RefundBookingPort {
  prepare(db: PoolClient, customerId: string, sessionId: string) {
    return quota(db, customerId, sessionId);
  }
  constructor(
    private readonly purchase = new BookingPaymentAdapter(),
    private readonly repository = new BookingRefundRepository(),
  ) {}
  lock(db: PoolClient, id: string, ownerId?: string) {
    return this.purchase.lock(db, id, ownerId);
  }
  tickets(db: PoolClient, purchase: LockedPurchase) {
    return this.repository.tickets(db, purchase.id);
  }
  revoke(db: PoolClient, id: string) {
    return this.repository.revoke(db, id);
  }
  complete(db: PoolClient, id: string) {
    return this.repository.complete(db, id);
  }
}
