import type { PoolClient } from 'pg';
import type { StatisticsQuery } from './operations.schema.js';

export interface SystemStatistics {
  users: Record<string, number>;
  organizations: Record<string, number>;
  events: Record<string, number>;
  bookings: Record<string, number>;
  tickets: Record<string, number>;
  money: {
    currency: string;
    grossTicketSalesMinor: string;
    receivedMinor: string;
    refundedMinor: string;
    pendingRefundMinor: string;
    netReceivedMinor: string;
    reconciliationReceivedMinor: string;
  }[];
}

const createdRange = (alias: string) =>
  `($1::timestamptz IS NULL OR ${alias}.created_at >= $1) AND ($2::timestamptz IS NULL OR ${alias}.created_at < $2)`;

export class OperationsRepository {
  async adminRole(db: PoolClient, userId: string) {
    return !!(
      await db.query(
        "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code='ADMIN' FOR SHARE OF ur",
        [userId],
      )
    ).rowCount;
  }

  async statistics(db: PoolClient, q: StatisticsQuery) {
    // Aggregate each lifecycle separately: joining items/attempts/refunds would multiply money.
    return (
      await db.query<SystemStatistics>(
        `WITH cohort AS (SELECT b.id,b.status,b.total_minor,b.currency FROM bookings b WHERE ${createdRange('b')}),
        payment_scope AS (SELECT p.id,p.currency,p.received_minor,p.reconciliation_status FROM payments p JOIN cohort b ON b.id=p.booking_id),
        refund_scope AS (SELECT r.status,r.amount_minor,p.currency FROM refunds r JOIN payment_scope p ON p.id=r.payment_id),
        currencies AS (SELECT DISTINCT currency FROM cohort),
        money_rows AS (SELECT c.currency,
          COALESCE((SELECT sum(b.total_minor) FROM cohort b WHERE b.currency=c.currency AND b.status IN ('CONFIRMED','REFUNDED')),0)::text AS "grossTicketSalesMinor",
          COALESCE((SELECT sum(p.received_minor) FROM payment_scope p WHERE p.currency=c.currency),0)::text AS "receivedMinor",
          COALESCE((SELECT sum(r.amount_minor) FROM refund_scope r WHERE r.currency=c.currency AND r.status='SUCCESS'),0)::text AS "refundedMinor",
          COALESCE((SELECT sum(r.amount_minor) FROM refund_scope r WHERE r.currency=c.currency AND r.status IN ('REQUESTED','PROCESSING','FAILED')),0)::text AS "pendingRefundMinor",
          (COALESCE((SELECT sum(p.received_minor) FROM payment_scope p WHERE p.currency=c.currency),0)-COALESCE((SELECT sum(r.amount_minor) FROM refund_scope r WHERE r.currency=c.currency AND r.status='SUCCESS'),0))::text AS "netReceivedMinor",
          COALESCE((SELECT sum(p.received_minor) FROM payment_scope p WHERE p.currency=c.currency AND p.reconciliation_status='REQUIRED'),0)::text AS "reconciliationReceivedMinor"
          FROM currencies c)
        SELECT
          (SELECT jsonb_build_object('total',count(*)::int,'active',count(*) FILTER(WHERE u.status='ACTIVE')::int,'blocked',count(*) FILTER(WHERE u.status='BLOCKED')::int) FROM users u WHERE ${createdRange('u')}) AS users,
          (SELECT jsonb_build_object('total',count(*)::int,'pendingReview',count(*) FILTER(WHERE o.status='PENDING_REVIEW')::int,'approved',count(*) FILTER(WHERE o.status='APPROVED')::int,'rejected',count(*) FILTER(WHERE o.status='REJECTED')::int,'suspended',count(*) FILTER(WHERE o.status='SUSPENDED')::int) FROM organizations o WHERE ${createdRange('o')}) AS organizations,
          (SELECT jsonb_build_object('total',count(*)::int,'draft',count(*) FILTER(WHERE e.status='DRAFT')::int,'pendingReview',count(*) FILTER(WHERE e.status='PENDING_REVIEW')::int,'rejected',count(*) FILTER(WHERE e.status='REJECTED')::int,'published',count(*) FILTER(WHERE e.status='PUBLISHED')::int,'cancelled',count(*) FILTER(WHERE e.status='CANCELLED')::int,'archived',count(*) FILTER(WHERE e.status='ARCHIVED')::int,'blocked',count(*) FILTER(WHERE e.status='BLOCKED')::int) FROM events e WHERE ${createdRange('e')}) AS events,
          (SELECT jsonb_build_object('total',count(*)::int,'awaitingPayment',count(*) FILTER(WHERE b.status='AWAITING_PAYMENT')::int,'confirmed',count(*) FILTER(WHERE b.status='CONFIRMED')::int,'refunded',count(*) FILTER(WHERE b.status='REFUNDED')::int,'cancelled',count(*) FILTER(WHERE b.status='CANCELLED')::int,'expired',count(*) FILTER(WHERE b.status='EXPIRED')::int) FROM cohort b) AS bookings,
          (SELECT jsonb_build_object('total',count(*)::int,'valid',count(*) FILTER(WHERE t.status='VALID')::int,'used',count(*) FILTER(WHERE t.status='USED')::int,'refunded',count(*) FILTER(WHERE t.status='REFUNDED')::int,'cancelled',count(*) FILTER(WHERE t.status='CANCELLED')::int,'expired',count(*) FILTER(WHERE t.status='EXPIRED')::int) FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN cohort b ON b.id=bi.booking_id) AS tickets,
          COALESCE((SELECT jsonb_agg(m ORDER BY m.currency) FROM money_rows m),'[]'::jsonb) AS money`,
        [q.from ?? null, q.to ?? null],
      )
    ).rows[0]!;
  }

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
