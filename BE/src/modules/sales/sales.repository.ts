import type { PoolClient } from 'pg';
import type {
  OrganizerSalesReader,
  OrderRow,
  TicketRow,
  SalesMoney,
  ReconciliationRow,
} from './sales.ports.js';
import type {
  OrderFilter,
  TicketFilter,
  SalesFilter,
  ReconciliationFilter,
} from './sales.schema.js';
const joins = 'FROM bookings b JOIN events e ON e.id=b.event_id JOIN users u ON u.id=b.customer_id';
const where = (statusColumn: string) =>
  `e.organization_id=$1 AND ($2::bigint IS NULL OR b.event_id=$2) AND ($3::bigint IS NULL OR b.session_id=$3) AND ($4::text IS NULL OR ${statusColumn}=$4) AND ($5::timestamptz IS NULL OR b.created_at>=$5) AND ($6::timestamptz IS NULL OR b.created_at<$6)`;
const parameters = (orgId: string, q: SalesFilter & { status?: string | undefined }) => [
  orgId,
  q.eventId ?? null,
  q.sessionId ?? null,
  q.status ?? null,
  q.from ?? null,
  q.to ?? null,
];
const orderSelect = `b.id::text AS id,b.event_id::text AS "eventId",b.session_id::text AS "sessionId",e.title AS "eventTitle",u.display_name AS "customerName",b.status,b.total_minor::text AS "totalMinor",b.currency,b.created_at AS "createdAt",b.confirmed_at AS "confirmedAt",
 (SELECT count(*)::int FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id WHERE bi.booking_id=b.id) AS "ticketCount",
 (SELECT r.status FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.booking_id=b.id ORDER BY r.id DESC LIMIT 1) AS "refundStatus"`;
const paymentSelect =
  'p.id::text AS id,p.booking_id::text AS "bookingId",b.event_id::text AS "eventId",b.session_id::text AS "sessionId",p.status,p.amount_minor::text AS "amountMinor",p.received_minor::text AS "receivedMinor",p.currency,p.reconciliation_status AS "reconciliationStatus",p.reconciliation_reason AS "reconciliationReason",p.created_at AS "createdAt",p.updated_at AS "updatedAt"';
export class SalesRepository implements OrganizerSalesReader {
  async locate(db: PoolClient, id: string) {
    return (
      await db.query<{ organization_id: string }>(
        'SELECT e.organization_id::text FROM bookings b JOIN events e ON e.id=b.event_id WHERE b.id=$1',
        [id],
      )
    ).rows[0]?.organization_id;
  }
  private async page<T>(
    db: PoolClient,
    select: string,
    q: OrderFilter | TicketFilter | ReconciliationFilter,
    orgId: string,
  ) {
    return (
      await db.query<{ items: T[]; total: number }>(
        `WITH matches AS (${select}),page_rows AS (SELECT * FROM matches ORDER BY "createdAt" DESC,id::bigint DESC LIMIT $7 OFFSET $8)
 SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(r ORDER BY r."createdAt" DESC,r.id::bigint DESC) FROM page_rows r),'[]'::jsonb) AS items`,
        [...parameters(orgId, q), q.pageSize, (q.page - 1) * q.pageSize],
      )
    ).rows[0]!;
  }
  orders(db: PoolClient, orgId: string, q: OrderFilter) {
    return this.page<OrderRow>(
      db,
      `SELECT ${orderSelect} ${joins} WHERE ${where('b.status')}`,
      q,
      orgId,
    );
  }
  async order(db: PoolClient, orgId: string, id: string) {
    const order = (
      await db.query<OrderRow>(
        `SELECT ${orderSelect} ${joins} WHERE e.organization_id=$1 AND b.id=$2`,
        [orgId, id],
      )
    ).rows[0];
    if (!order) return;
    const items = (
      await db.query<{
        id: string;
        seatLabel: string;
        attendeeName: string;
        priceMinor: string;
        currency: string;
        ticketTypeName: string;
      }>(
        'SELECT id::text,seat_label_snapshot AS "seatLabel",attendee_name_snapshot AS "attendeeName",price_minor::text AS "priceMinor",currency,ticket_type_name_snapshot AS "ticketTypeName" FROM booking_items WHERE booking_id=$1 ORDER BY booking_items.id',
        [id],
      )
    ).rows;
    const payments = (
      await db.query<ReconciliationRow>(
        `SELECT ${paymentSelect} FROM payments p JOIN bookings b ON b.id=p.booking_id WHERE b.id=$1 ORDER BY p.id`,
        [id],
      )
    ).rows;
    return { order, items, payments };
  }
  tickets(db: PoolClient, orgId: string, q: TicketFilter) {
    return this.page<TicketRow>(
      db,
      `SELECT t.id::text, b.id::text AS "bookingId",b.event_id::text AS "eventId",b.session_id::text AS "sessionId",e.title AS "eventTitle",t.status,bi.attendee_name_snapshot AS "attendeeName",bi.seat_label_snapshot AS "seatLabel",bi.ticket_type_name_snapshot AS "ticketTypeName",t.created_at AS "createdAt",t.admitted_at AS "admittedAt" ${joins} JOIN booking_items bi ON bi.booking_id=b.id JOIN tickets t ON t.booking_item_id=bi.id WHERE ${where('t.status')}`,
      q,
      orgId,
    );
  }
  reconciliation(db: PoolClient, orgId: string, q: ReconciliationFilter) {
    return this.page<ReconciliationRow>(
      db,
      `SELECT ${paymentSelect} ${joins} JOIN payments p ON p.booking_id=b.id WHERE ${where('p.reconciliation_status')}`,
      q,
      orgId,
    );
  }
  async overview(db: PoolClient, orgId: string, q: SalesFilter) {
    return (
      await db.query<{
        orders: Record<string, number>;
        tickets: Record<string, number>;
        money: SalesMoney[];
      }>(
        `WITH cohort AS (SELECT b.* ${joins} WHERE ${where('b.status')}),
 payments_scope AS (SELECT p.* FROM payments p JOIN cohort b ON b.id=p.booking_id),
 refunds_scope AS (SELECT r.*,p.currency FROM refunds r JOIN payments_scope p ON p.id=r.payment_id),
 currencies AS (SELECT DISTINCT currency FROM cohort),
 money_rows AS (SELECT c.currency,
 COALESCE((SELECT sum(b.total_minor) FROM cohort b WHERE b.currency=c.currency AND b.status IN ('CONFIRMED','REFUNDED')),0)::text AS "grossTicketSalesMinor",
 COALESCE((SELECT sum(p.received_minor) FROM payments_scope p WHERE p.currency=c.currency),0)::text AS "receivedMinor",
 COALESCE((SELECT sum(r.amount_minor) FROM refunds_scope r WHERE r.currency=c.currency AND r.status='SUCCESS'),0)::text AS "refundedMinor",
 COALESCE((SELECT sum(r.amount_minor) FROM refunds_scope r WHERE r.currency=c.currency AND r.status='REQUESTED'),0)::text AS "requestedRefundMinor",
 COALESCE((SELECT sum(r.amount_minor) FROM refunds_scope r WHERE r.currency=c.currency AND r.status='PROCESSING'),0)::text AS "processingRefundMinor",
 COALESCE((SELECT sum(r.amount_minor) FROM refunds_scope r WHERE r.currency=c.currency AND r.status='FAILED'),0)::text AS "failedRefundMinor",
 (COALESCE((SELECT sum(p.received_minor) FROM payments_scope p WHERE p.currency=c.currency),0)-COALESCE((SELECT sum(r.amount_minor) FROM refunds_scope r WHERE r.currency=c.currency AND r.status='SUCCESS'),0))::text AS "netReceivedMinor",
 COALESCE((SELECT sum(p.received_minor) FROM payments_scope p WHERE p.currency=c.currency AND p.reconciliation_status='REQUIRED'),0)::text AS "reconciliationReceivedMinor",
 (SELECT count(*)::int FROM payments_scope p WHERE p.currency=c.currency AND p.reconciliation_status='REQUIRED') AS "reconciliationPaymentCount" FROM currencies c)
 SELECT (SELECT jsonb_build_object('total',count(*)::int,'awaitingPayment',count(*) FILTER(WHERE status='AWAITING_PAYMENT')::int,'confirmed',count(*) FILTER(WHERE status='CONFIRMED')::int,'refunded',count(*) FILTER(WHERE status='REFUNDED')::int,'cancelled',count(*) FILTER(WHERE status='CANCELLED')::int,'expired',count(*) FILTER(WHERE status='EXPIRED')::int) FROM cohort) AS orders,
 (SELECT jsonb_build_object('total',count(*)::int,'valid',count(*) FILTER(WHERE t.status='VALID')::int,'used',count(*) FILTER(WHERE t.status='USED')::int,'cancelled',count(*) FILTER(WHERE t.status='CANCELLED')::int,'refunded',count(*) FILTER(WHERE t.status='REFUNDED')::int,'expired',count(*) FILTER(WHERE t.status='EXPIRED')::int) FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN cohort b ON b.id=bi.booking_id) AS tickets,
 COALESCE((SELECT jsonb_agg(m ORDER BY m.currency) FROM money_rows m),'[]'::jsonb) AS money`,
        parameters(orgId, q),
      )
    ).rows[0]!;
  }
}
