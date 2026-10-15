import type { PoolClient } from 'pg';
export class OperationsRepository {
  async backlog(db: PoolClient) {
    return (
      await db.query<{
        outboxPending: number;
        outboxFailed: number;
        oldestOutboxSeconds: number;
        paymentPending: number;
        reconciliationRequired: number;
      }>(`SELECT
    (SELECT count(*)::int FROM outbox_messages WHERE status IN ('PENDING','PROCESSING')) AS "outboxPending",
    (SELECT count(*)::int FROM outbox_messages WHERE status='FAILED') AS "outboxFailed",
    (SELECT COALESCE(EXTRACT(EPOCH FROM clock_timestamp()-min(created_at)),0)::int FROM outbox_messages WHERE status IN ('PENDING','PROCESSING')) AS "oldestOutboxSeconds",
    (SELECT count(*)::int FROM payments WHERE status='PENDING') AS "paymentPending",
    (SELECT count(*)::int FROM payments WHERE reconciliation_status='REQUIRED') AS "reconciliationRequired"`)
    ).rows[0]!;
  }
}
