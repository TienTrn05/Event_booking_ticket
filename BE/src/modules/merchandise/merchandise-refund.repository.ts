import type { PoolClient } from 'pg';
export class MerchandiseRefundRepository {
  async target(db: PoolClient, id: string, byRefund = false) {
    return (
      await db.query<{ order_id: string; payment_id: string }>(
        `SELECT p.merchandise_order_id::text AS order_id,p.id::text AS payment_id FROM payments p ${byRefund ? 'JOIN refunds r ON r.payment_id=p.id' : ''} WHERE ${byRefund ? 'r.id' : 'p.id'}=$1 AND p.merchandise_order_id IS NOT NULL`,
        [id],
      )
    ).rows[0];
  }
  async refunds(db: PoolClient, id: string) {
    return (
      await db.query(
        'SELECT r.id::text,r.type,r.status,r.amount_minor::text,r.reason,r.version,r.decision_reason,r.provider_reference,r.evidence_note,r.transferred_at,r.created_at FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.merchandise_order_id=$1 ORDER BY r.id',
        [id],
      )
    ).rows;
  }
  async reconcile(db: PoolClient, id: string) {
    await db.query(
      "UPDATE payments SET status='REFUNDED',reconciliation_status='RESOLVED' WHERE id=$1",
      [id],
    );
  }
}
