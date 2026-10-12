import type { PoolClient } from 'pg';
import type { RefundPaymentPort } from '../../refunds/refund.ports.js';
import { PaymentRefundRepository } from './payment-refund.repository.js';
export class PaymentRefundAdapter implements RefundPaymentPort {
  constructor(private readonly repository = new PaymentRefundRepository()) {}
  lock(db: PoolClient, id: string) {
    return this.repository.lock(db, id);
  }
  complete(db: PoolClient, id: string) {
    return this.repository.complete(db, id);
  }
}
