import type { PoolClient } from 'pg';
export class PaymentRefundRepository {
  async lock(db: PoolClient, id: string) {
    return (
      await db.query<{
        id: string;
        status: string;
        amount_minor: string;
        received_minor: string;
        currency: string;
        provider: string;
        reconciliation_status: string;
      }>(
        'SELECT id::text,status,amount_minor::text,received_minor::text,currency,provider,reconciliation_status FROM payments WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
  }
  async complete(db: PoolClient, id: string) {
    await db.query("UPDATE payments SET status='REFUNDED' WHERE id=$1 AND status='SUCCESS'", [id]);
  }
}
