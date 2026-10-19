import type { PoolClient } from 'pg';
import type { LockedPurchase } from '../../payments/application/payment.ports.js';
export interface EventCancellationBookings {
  cancelHold(db: PoolClient, holdId: string, eventId: string): Promise<LockedPurchase | null>;
}
export interface EventCancellationRefunds {
  prepareCancellation(
    db: PoolClient,
    purchase: LockedPurchase,
    actorId: string,
    reason: string,
  ): Promise<void>;
}
