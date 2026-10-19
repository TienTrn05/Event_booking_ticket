import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { ProductInput } from './merchandise.schema.js';
export type Product = {
  id: string;
  public_id: string;
  event_id: string;
  organization_id: string;
  status: string;
  version: number;
  name: string;
  description: string;
  image_url: string | null;
  requires_ticket: boolean;
  shipping_fee_minor: string;
  review_reason: string | null;
};
export type Sku = {
  id: string;
  product_id: string;
  code: string;
  name: string;
  price_minor: string;
  stock_total: number;
  sold_quantity: number;
  version: number;
  active: boolean;
  product_name: string;
  product_status: string;
  requires_ticket: boolean;
  shipping_fee_minor: string;
  event_id: string;
};
export type Order = {
  id: string;
  customer_id: string;
  event_id: string;
  organization_id: string;
  status: string;
  fulfillment_status: string;
  total_minor: string;
  shipping_fee_minor: string;
  currency: string;
  recipient_ciphertext: Buffer;
  expires_at: Date;
  confirmed_payment_id: string | null;
  version: number;
  tracking_reference: string | null;
  fulfillment_note: string | null;
  shipped_at: Date | null;
  delivered_at: Date | null;
};
export type OrderItem = {
  id: string;
  sku_id: string;
  product_id: string;
  quantity: number;
  price_minor: string;
  product_name_snapshot: string;
  sku_name_snapshot: string;
  requires_ticket_snapshot: boolean;
};
const productFields =
  'id::text,public_id,event_id::text,organization_id::text,status,version,name,description,image_url,requires_ticket,shipping_fee_minor::text,review_reason';
const orderFields =
  'id::text,customer_id::text,event_id::text,organization_id::text,status,fulfillment_status,total_minor::text,shipping_fee_minor::text,currency,recipient_ciphertext,expires_at,confirmed_payment_id::text,version,tracking_reference,fulfillment_note,shipped_at,delivered_at';
export class MerchandiseRepository {
  async orderPayments(db: PoolClient, id: string) {
    return (
      await db.query(
        `SELECT p.id::text,p.status,p.amount_minor::text AS "amountMinor",p.received_minor::text AS "receivedMinor",p.reconciliation_status AS "reconciliationStatus",p.reconciliation_reason AS "reconciliationReason" FROM payments p WHERE p.merchandise_order_id=$1 ORDER BY p.id`,
        [id],
      )
    ).rows;
  }
  async overview(db: PoolClient, orgId: string | null, from?: string, to?: string) {
    return (
      await db.query<{ orders: Record<string, number>; money: Record<string, string>[] }>(
        `WITH cohort AS(SELECT id,status,total_minor,currency FROM merchandise_orders WHERE ($1::bigint IS NULL OR organization_id=$1) AND ($2::timestamptz IS NULL OR created_at>=$2) AND ($3::timestamptz IS NULL OR created_at<$3)),payments_scope AS(SELECT p.* FROM payments p JOIN cohort o ON o.id=p.merchandise_order_id),refunds_scope AS(SELECT r.* FROM refunds r JOIN payments_scope p ON p.id=r.payment_id),totals AS(SELECT 'VND' AS currency,COALESCE((SELECT sum(total_minor) FROM cohort WHERE status IN ('CONFIRMED','REFUNDED')),0)::text AS "grossSalesMinor",COALESCE((SELECT sum(received_minor) FROM payments_scope),0)::text AS "receivedMinor",COALESCE((SELECT sum(amount_minor) FROM refunds_scope WHERE status='SUCCESS'),0)::text AS "refundedMinor",COALESCE((SELECT sum(amount_minor) FROM refunds_scope WHERE status IN ('REQUESTED','PROCESSING','FAILED')),0)::text AS "pendingRefundMinor",COALESCE((SELECT sum(received_minor) FROM payments_scope WHERE reconciliation_status='REQUIRED'),0)::text AS "reconciliationReceivedMinor") SELECT (SELECT jsonb_build_object('total',count(*)::int,'confirmed',count(*) FILTER(WHERE status='CONFIRMED')::int,'refunded',count(*) FILTER(WHERE status='REFUNDED')::int,'awaitingPayment',count(*) FILTER(WHERE status='AWAITING_PAYMENT')::int,'expired',count(*) FILTER(WHERE status='EXPIRED')::int,'cancelled',count(*) FILTER(WHERE status='CANCELLED')::int) FROM cohort) AS orders,(SELECT jsonb_agg(to_jsonb(t)||jsonb_build_object('netReceivedMinor',(t."receivedMinor"::bigint-t."refundedMinor"::bigint)::text)) FROM totals t) AS money`,
        [orgId, from ?? null, to ?? null],
      )
    ).rows[0]!;
  }
  async lockUsers(db: PoolClient, ids: string[]) {
    await db.query('SELECT id FROM users WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [ids]);
  }
  async updateStock(db: PoolClient, id: string, total: number) {
    await db.query('UPDATE merchandise_skus SET stock_total=$2,version=version+1 WHERE id=$1', [
      id,
      total,
    ]);
  }
  async activeBuyer(db: PoolClient, id: string) {
    return !!(await db.query("SELECT id FROM users WHERE id=$1 AND status='ACTIVE'", [id]))
      .rowCount;
  }
  async publicProduct(db: PoolClient, publicId: string) {
    return (
      await db.query<{ id: string; event_id: string }>(
        "SELECT p.id::text,p.event_id::text FROM merchandise_products p JOIN events e ON e.id=p.event_id JOIN organizations o ON o.id=p.organization_id WHERE p.public_id=$1 AND p.status='PUBLISHED' AND e.status='PUBLISHED' AND e.published_at<=clock_timestamp() AND o.status='APPROVED'",
        [publicId],
      )
    ).rows[0];
  }
  async event(db: PoolClient, id: string, lock = false) {
    const first = (
      await db.query<{ organization_id: string }>(
        'SELECT organization_id::text FROM events WHERE id=$1',
        [id],
      )
    ).rows[0];
    if (!first) return;
    if (lock) {
      await db.query('SELECT id FROM organizations WHERE id=$1 FOR SHARE', [first.organization_id]);
      await db.query('SELECT id FROM events WHERE id=$1 FOR SHARE', [id]);
    }
    return (
      await db.query<{
        id: string;
        organization_id: string;
        status: string;
        organization_status: string;
        public_now: boolean;
      }>(
        `SELECT e.id::text,e.organization_id::text,e.status,o.status AS organization_status,(e.published_at<=clock_timestamp()) AS public_now FROM events e JOIN organizations o ON o.id=e.organization_id WHERE e.id=$1`,
        [id],
      )
    ).rows[0];
  }
  async now(db: PoolClient) {
    return (await db.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now;
  }
  async product(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<Product>(
        `SELECT ${productFields} FROM merchandise_products WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async productSkus(db: PoolClient, id: string) {
    return (
      await db.query<{
        id: string;
        code: string;
        name: string;
        price_minor: string;
        stock_total: number;
        sold_quantity: number;
        version: number;
        active: boolean;
      }>(
        'SELECT id::text,code,name,price_minor::text,stock_total,sold_quantity,version,active FROM merchandise_skus WHERE product_id=$1 ORDER BY id',
        [id],
      )
    ).rows;
  }
  async createProduct(db: PoolClient, eventId: string, orgId: string, p: ProductInput) {
    return (
      await db.query<{ id: string }>(
        `INSERT INTO merchandise_products(public_id,event_id,organization_id,name,description,price_minor,currency,requires_ticket,shipping_fee_minor) VALUES($1,$2,$3,$4,$5,$6,'VND',$7,$8) RETURNING id::text`,
        [
          'merch-' + randomUUID(),
          eventId,
          orgId,
          p.name,
          p.description,
          p.skus[0]!.priceMinor,
          p.requiresTicket,
          p.shippingFeeMinor,
        ],
      )
    ).rows[0]!.id;
  }
  async updateProduct(db: PoolClient, id: string, p: ProductInput) {
    await db.query(
      "UPDATE merchandise_products SET name=$2,description=$3,price_minor=$4,requires_ticket=$5,shipping_fee_minor=$6,status='DRAFT',version=version+1,reviewed_at=NULL,reviewed_by=NULL,review_reason=NULL WHERE id=$1",
      [id, p.name, p.description, p.skus[0]!.priceMinor, p.requiresTicket, p.shippingFeeMinor],
    );
  }
  async saveSkus(db: PoolClient, id: string, p: ProductInput) {
    await db.query(
      'UPDATE merchandise_skus SET active=FALSE,version=version+1 WHERE product_id=$1',
      [id],
    );
    for (const sku of p.skus) {
      await db.query(
        `INSERT INTO merchandise_skus(product_id,code,name,price_minor,stock_total) VALUES($1,$2,$3,$4,$5) ON CONFLICT(product_id,code) DO UPDATE SET name=$3,price_minor=$4,stock_total=$5,active=TRUE,version=merchandise_skus.version+1`,
        [id, sku.code, sku.name, sku.priceMinor, sku.stockTotal],
      );
    }
  }
  async transition(db: PoolClient, id: string, status: string, actorId: string, reason: string) {
    await db.query(
      'UPDATE merchandise_products SET status=$2,version=version+1,reviewed_by=$3,reviewed_at=clock_timestamp(),review_reason=$4 WHERE id=$1',
      [id, status, actorId, reason],
    );
  }
  async listProducts(
    db: PoolClient,
    eventId: string | null,
    orgId: string | null,
    status: string | undefined,
    page: number,
    size: number,
  ) {
    return (
      await db.query<{ items: unknown[]; total: number }>(
        `WITH matches AS(SELECT ${productFields} FROM merchandise_products WHERE ($1::bigint IS NULL OR event_id=$1) AND ($2::bigint IS NULL OR organization_id=$2) AND ($3::text IS NULL OR status=$3)),p AS(SELECT * FROM matches ORDER BY id::bigint DESC LIMIT $4 OFFSET $5) SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint DESC) FROM p),'[]'::jsonb) AS items`,
        [eventId, orgId, status ?? null, size, (page - 1) * size],
      )
    ).rows[0]!;
  }
  async skus(db: PoolClient, ids: string[], lock = false) {
    if (lock)
      await db.query(
        'SELECT id FROM merchandise_skus WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE',
        [ids],
      );
    return (
      await db.query<Sku>(
        `SELECT s.id::text,s.product_id::text,s.code,s.name,s.price_minor::text,s.stock_total,s.sold_quantity,s.version,s.active,p.name AS product_name,p.status AS product_status,p.requires_ticket,p.shipping_fee_minor::text,p.event_id::text FROM merchandise_skus s JOIN merchandise_products p ON p.id=s.product_id WHERE s.id=ANY($1::bigint[]) ORDER BY s.id`,
        [ids],
      )
    ).rows;
  }
  async lockProducts(db: PoolClient, skuIds: string[]) {
    await db.query(
      'SELECT id FROM merchandise_products WHERE id IN(SELECT product_id FROM merchandise_skus WHERE id=ANY($1::bigint[])) ORDER BY id FOR SHARE',
      [skuIds],
    );
  }
  async reserved(db: PoolClient, skuId: string, excludeOrder?: string) {
    return (
      await db.query<{ n: number }>(
        `SELECT COALESCE(sum(i.quantity),0)::int AS n FROM merchandise_order_items i JOIN merchandise_orders o ON o.id=i.order_id WHERE i.sku_id=$1 AND o.status='AWAITING_PAYMENT' AND o.expires_at>clock_timestamp() AND ($2::bigint IS NULL OR o.id<>$2)`,
        [skuId, excludeOrder ?? null],
      )
    ).rows[0]!.n;
  }
  async ticket(db: PoolClient, userId: string, eventId: string) {
    return !!(
      await db.query(
        `SELECT t.id FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN bookings b ON b.id=bi.booking_id WHERE b.customer_id=$1 AND b.event_id=$2 AND t.status IN ('VALID','USED') ORDER BY t.id LIMIT 1 FOR SHARE OF t,b`,
        [userId, eventId],
      )
    ).rowCount;
  }
  async nextOrderId(db: PoolClient) {
    return (
      await db.query<{ id: string }>(
        "SELECT nextval(pg_get_serial_sequence('merchandise_orders','id'))::text AS id",
      )
    ).rows[0]!.id;
  }
  async insertOrder(
    db: PoolClient,
    id: string,
    userId: string,
    eventId: string,
    orgId: string,
    total: string,
    shipping: string,
    encrypted: Buffer,
  ) {
    await db.query(
      `INSERT INTO merchandise_orders(id,customer_id,event_id,organization_id,total_minor,shipping_fee_minor,recipient_ciphertext,expires_at) VALUES($1,$2,$3,$4,$5,$6,$7,clock_timestamp()+interval '5 minutes')`,
      [id, userId, eventId, orgId, total, shipping, encrypted],
    );
  }
  async insertItem(db: PoolClient, id: string, s: Sku, quantity: number) {
    await db.query(
      'INSERT INTO merchandise_order_items(order_id,product_id,sku_id,quantity,price_minor,product_name_snapshot,sku_name_snapshot,requires_ticket_snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
      [id, s.product_id, s.id, quantity, s.price_minor, s.product_name, s.name, s.requires_ticket],
    );
  }
  async order(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<Order>(
        `SELECT ${orderFields} FROM merchandise_orders WHERE id=$1 ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async items(db: PoolClient, id: string) {
    return (
      await db.query<OrderItem>(
        'SELECT id::text,sku_id::text,product_id::text,quantity,price_minor::text,product_name_snapshot,sku_name_snapshot,requires_ticket_snapshot FROM merchandise_order_items WHERE order_id=$1 ORDER BY sku_id',
        [id],
      )
    ).rows;
  }
  async listOrders(
    db: PoolClient,
    kind: 'customer_id' | 'organization_id',
    id: string,
    page: number,
    size: number,
  ) {
    return (
      await db.query<{ items: unknown[]; total: number }>(
        `WITH matches AS(SELECT id::text,event_id::text AS "eventId",status,fulfillment_status AS "fulfillmentStatus",total_minor::text AS "totalMinor",currency,version,created_at AS "createdAt" FROM merchandise_orders WHERE ${kind}=$1),p AS(SELECT * FROM matches ORDER BY id::bigint DESC LIMIT $2 OFFSET $3) SELECT (SELECT count(*)::int FROM matches) AS total,COALESCE((SELECT jsonb_agg(p ORDER BY p.id::bigint DESC) FROM p),'[]'::jsonb) AS items`,
        [id, size, (page - 1) * size],
      )
    ).rows[0]!;
  }
  async confirm(db: PoolClient, id: string, paymentId: string) {
    for (const i of await this.items(db, id))
      await db.query(
        'UPDATE merchandise_skus SET sold_quantity=sold_quantity+$2,version=version+1 WHERE id=$1',
        [i.sku_id, i.quantity],
      );
    await db.query(
      "UPDATE merchandise_orders SET status='CONFIRMED',confirmed_payment_id=$2,confirmed_at=clock_timestamp(),version=version+1,updated_at=clock_timestamp() WHERE id=$1",
      [id, paymentId],
    );
  }
  async cancel(db: PoolClient, id: string, status: string) {
    await db.query(
      "UPDATE merchandise_orders SET status=$2,version=version+1,updated_at=clock_timestamp() WHERE id=$1 AND status='AWAITING_PAYMENT'",
      [id, status],
    );
  }
  async fulfill(db: PoolClient, id: string, status: string, reference: string, note: string) {
    await db.query(
      "UPDATE merchandise_orders SET fulfillment_status=$2::varchar,tracking_reference=$3,fulfillment_note=$4,shipped_at=CASE WHEN $2::varchar='SHIPPED' THEN clock_timestamp() ELSE shipped_at END,delivered_at=CASE WHEN $2::varchar='DELIVERED' THEN clock_timestamp() ELSE delivered_at END,version=version+1,updated_at=clock_timestamp() WHERE id=$1",
      [id, status, reference, note],
    );
  }
  async refundComplete(db: PoolClient, id: string, restock: boolean) {
    if (restock)
      for (const i of await this.items(db, id))
        await db.query(
          'UPDATE merchandise_skus SET sold_quantity=sold_quantity-$2,version=version+1 WHERE id=$1',
          [i.sku_id, i.quantity],
        );
    await db.query(
      "UPDATE merchandise_orders SET status='REFUNDED',version=version+1,updated_at=clock_timestamp() WHERE id=$1",
      [id],
    );
  }
  async expireCandidates(db: PoolClient) {
    return (
      await db.query<{ id: string }>(
        "SELECT id::text FROM merchandise_orders WHERE status='AWAITING_PAYMENT' AND expires_at<=clock_timestamp() ORDER BY id LIMIT 100",
      )
    ).rows;
  }
  async hasRefund(db: PoolClient, id: string) {
    return !!(
      await db.query(
        "SELECT r.id FROM refunds r JOIN payments p ON p.id=r.payment_id WHERE p.merchandise_order_id=$1 AND r.status<>'REJECTED' LIMIT 1",
        [id],
      )
    ).rowCount;
  }
  async report(db: PoolClient, id: string, actorId: string, order: Order) {
    return !!(
      await db.query(
        "SELECT id FROM support_reports WHERE id=$1 AND assigned_admin_id=$2 AND status='IN_REVIEW' AND event_id=$3 AND merchandise_order_id=$4 FOR SHARE",
        [id, actorId, order.event_id, order.id],
      )
    ).rowCount;
  }
  async audit(
    db: PoolClient,
    actorId: string,
    id: string,
    action: string,
    orgId: string,
    requestId: string,
    resource = 'MERCHANDISE_ORDER',
    reportId?: string,
  ) {
    await db.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,organization_id,request_id,support_report_id) VALUES('USER',$1,$2,$3,$4,$5,$6,$7)",
      [actorId, action, resource, id, orgId, requestId, reportId ?? null],
    );
  }
}
