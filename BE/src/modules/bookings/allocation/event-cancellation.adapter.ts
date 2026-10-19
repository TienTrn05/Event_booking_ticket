import type { PoolClient } from 'pg';
import { AppError } from '../../../shared/errors/app-error.js';
import type { EventCancellationBookings } from '../../events/operations/event-operations.ports.js';
import { BookingPaymentAdapter } from '../payments/booking-payment.adapter.js';
import { allocationLocks, clearSeats } from './allocation.service.js';
import { holdRow } from '../shared/booking.repository.js';
import { setHoldStatus } from './allocation.repository.js';
export class EventCancellationAdapter implements EventCancellationBookings {
  constructor(private readonly purchase = new BookingPaymentAdapter()) {}
  async cancelHold(db: PoolClient, holdId: string, eventId: string) {
    const locked = await allocationLocks(db, await holdRow(db, holdId));
    if (locked.context.event_id !== eventId || locked.context.event_status !== 'CANCELLED')
      throw new AppError(409, 'EVENT_STATE_CONFLICT', 'Sự kiện chưa hủy.');
    if (locked.hold.status === 'ACTIVE') {
      await clearSeats(db, holdId);
      await setHoldStatus(db, holdId, 'RELEASED');
    }
    if (!locked.booking) return null;
    const purchase = await this.purchase.lock(db, locked.booking.id);
    if (purchase.status === 'AWAITING_PAYMENT')
      await this.purchase.terminate(db, purchase, 'CANCELLED');
    return purchase;
  }
}
