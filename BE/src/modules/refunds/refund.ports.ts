import type { PoolClient } from 'pg';
import type { LockedPurchase, PurchaseReader } from '../payments/application/payment.ports.js';
export interface RefundBookingPort extends PurchaseReader {
  prepare(db: PoolClient, customerId: string, sessionId: string): Promise<void>;
  tickets(db: PoolClient, purchase: LockedPurchase): Promise<{ id: string; status: string }[]>;
  revoke(db: PoolClient, bookingId: string): Promise<void>;
  complete(db: PoolClient, bookingId: string): Promise<void>;
}
export interface RefundPaymentPort {
  closeUnpaid(db: PoolClient, bookingId: string): Promise<void>;
  lock(
    db: PoolClient,
    id: string,
  ): Promise<
    | {
        id: string;
        status: string;
        amount_minor: string;
        received_minor: string;
        currency: string;
        provider: string;
        reconciliation_status: string;
      }
    | undefined
  >;
  complete(db: PoolClient, id: string): Promise<void>;
}
