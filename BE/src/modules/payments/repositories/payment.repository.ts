import { randomBytes, createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import type { PaymentRequest, Receipt } from '../application/payment.ports.js';
export type PaymentRow = {
  id: string;
  booking_id: string;
  provider_key: string;
  provider_reference: string | null;
  status: string;
  amount_minor: string;
  received_minor: string;
  currency: string;
  checkout_url: string | null;
  reconciliation_status: string;
  reconciliation_reason: string | null;
};
export type LinkJob = {
  id: string;
  lease_token: Buffer;
  attempts: number;
  expired: boolean;
  payload_minimal: PaymentRequest & { paymentId: string };
};
export class PaymentRepository {
  private readonly select =
    'id::text,booking_id::text,provider_key,provider_reference,status,amount_minor::text,received_minor::text,currency,checkout_url,reconciliation_status,reconciliation_reason';
  async find(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<PaymentRow>(
        `SELECT ${this.select} FROM payments WHERE id=$1 AND provider='PAYOS' ${lock ? 'FOR UPDATE' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async pending(db: PoolClient, bookingId: string) {
    return (
      await db.query<PaymentRow>(
        `SELECT ${this.select} FROM payments WHERE booking_id=$1 AND status='PENDING' ORDER BY id FOR UPDATE`,
        [bookingId],
      )
    ).rows[0];
  }
  async create(db: PoolClient, bookingId: string, amount: string) {
    const orderCode = ((randomBytes(8).readBigUInt64BE() % 9007199254740991n) + 1n).toString();
    return (
      await db.query<PaymentRow>(
        `INSERT INTO payments(booking_id,provider,provider_key,amount_minor,currency)
      VALUES($1,'PAYOS',$3,$2,'VND') RETURNING ${this.select}`,
        [bookingId, amount, orderCode],
      )
    ).rows[0]!;
  }
  async hasReceivedFunds(db: PoolClient, bookingId: string) {
    return !!(
      await db.query('SELECT 1 FROM payments WHERE booking_id=$1 AND received_minor>0 LIMIT 1', [
        bookingId,
      ])
    ).rowCount;
  }
  async enqueue(db: PoolClient, payment: PaymentRow, payload: PaymentRequest) {
    await db.query(
      `INSERT INTO outbox_messages(type,aggregate_type,aggregate_id,aggregate_version,dedupe_key,payload_minimal,available_at)
      VALUES('PAYOS_LINK_CREATE','PAYMENT',$1,0,$2,$3,clock_timestamp())`,
      [
        payment.id,
        'payos-link:' + payment.id,
        JSON.stringify({ ...payload, paymentId: payment.id }),
      ],
    );
  }
  async claimLink(db: PoolClient, paymentId?: string): Promise<LinkJob | undefined> {
    const job = (
      await db.query<{ id: string }>(
        `SELECT id::text FROM outbox_messages WHERE type='PAYOS_LINK_CREATE'
      AND ($1::bigint IS NULL OR aggregate_id=$1) AND available_at<=clock_timestamp()
      AND (status='PENDING' OR (status='PROCESSING' AND lease_until<=clock_timestamp()))
      ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED`,
        [paymentId ?? null],
      )
    ).rows[0];
    if (!job) return;
    return (
      await db.query<LinkJob>(
        `UPDATE outbox_messages SET status='PROCESSING',attempts=attempts+1,
      lease_until=clock_timestamp()+interval '30 seconds',lease_token=$2 WHERE id=$1
      RETURNING id::text,lease_token,attempts,payload_minimal,(payload_minimal->>'expiredAt')::bigint<=EXTRACT(EPOCH FROM clock_timestamp()) AS expired`,
        [job.id, randomBytes(16)],
      )
    ).rows[0];
  }
  async lockJob(db: PoolClient, job: LinkJob) {
    return !!(
      await db.query(
        "SELECT id FROM outbox_messages WHERE id=$1 AND status='PROCESSING' AND lease_token=$2 FOR UPDATE",
        [job.id, job.lease_token],
      )
    ).rowCount;
  }
  async finishJob(db: PoolClient, job: LinkJob, success: boolean) {
    await db.query(
      `UPDATE outbox_messages SET status=$3,lease_until=NULL,lease_token=NULL,
      available_at=clock_timestamp()+interval '15 seconds',last_error_code=$4 WHERE id=$1 AND lease_token=$2`,
      [job.id, job.lease_token, success ? 'DONE' : 'PENDING', success ? null : 'PAYOS_UNAVAILABLE'],
    );
  }
  async saveLink(db: PoolClient, id: string, linkId: string, url: string) {
    await db.query(
      'UPDATE payments SET provider_reference=COALESCE(provider_reference,$2),checkout_url=$3 WHERE id=$1',
      [id, linkId, url],
    );
  }
  async inbox(db: PoolClient, receipt: Receipt) {
    const hash = createHash('sha256').update(JSON.stringify(receipt)).digest();
    const payment = (
      await db.query<{ id: string }>(
        'SELECT id::text FROM payments WHERE provider=$1 AND provider_key=$2',
        ['PAYOS', receipt.orderCode],
      )
    ).rows[0];
    await db.query(
      `INSERT INTO payment_webhooks(provider,provider_event_id,payment_id,payload_hash,normalized_payload,status,last_error_code)
      VALUES('PAYOS',$1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING`,
      [
        receipt.reference,
        payment?.id ?? null,
        hash,
        JSON.stringify(receipt),
        payment ? 'RECEIVED' : 'QUARANTINED',
        payment ? null : 'UNKNOWN_ORDER',
      ],
    );
    const row = (
      await db.query<{ id: string; payload_hash: Buffer; status: string }>(
        "SELECT id::text,payload_hash,status FROM payment_webhooks WHERE provider='PAYOS' AND provider_event_id=$1",
        [receipt.reference],
      )
    ).rows[0]!;
    if (!row.payload_hash.equals(hash))
      await db.query(
        "UPDATE payment_webhooks SET last_error_code='REFERENCE_CONFLICT' WHERE id=$1",
        [row.id],
      );
    return row.payload_hash.equals(hash) && row.status === 'RECEIVED' ? row.id : undefined;
  }
  async lockInbox(db: PoolClient, id: string) {
    return (
      await db.query<{
        id: string;
        payment_id: string | null;
        normalized_payload: Receipt;
        status: string;
      }>(
        'SELECT id::text,payment_id::text,normalized_payload,status FROM payment_webhooks WHERE id=$1 FOR UPDATE',
        [id],
      )
    ).rows[0];
  }
  async markInbox(db: PoolClient, id: string, ok: boolean, error?: string) {
    await db.query(
      "UPDATE payment_webhooks SET status=$2::varchar,processed_at=CASE WHEN $2::varchar='PROCESSED' THEN clock_timestamp() ELSE NULL END,last_error_code=$3,attempts=attempts+1 WHERE id=$1",
      [id, ok ? 'PROCESSED' : 'QUARANTINED', error ?? null],
    );
  }
  async recordFunds(
    db: PoolClient,
    id: string,
    received: string,
    status: string,
    reason: string | null,
    reference: string,
  ) {
    await db.query(
      `UPDATE payments SET received_minor=$2,status=$3,reconciliation_status=$4,reconciliation_reason=$5,
      provider_reference=COALESCE(provider_reference,$6) WHERE id=$1`,
      [id, received, status, reason ? 'REQUIRED' : 'NONE', reason, reference],
    );
  }
  async candidates(db: PoolClient) {
    return (
      await db.query<{
        id: string;
        provider_key: string;
      }>(`UPDATE payments SET last_polled_at=clock_timestamp() WHERE id IN (
      SELECT id FROM payments WHERE provider='PAYOS' AND status IN ('PENDING','FAILED')
      AND created_at>clock_timestamp()-interval '7 days' AND (last_polled_at IS NULL OR last_polled_at<clock_timestamp()-interval '15 seconds')
      ORDER BY last_polled_at NULLS FIRST,id LIMIT 3 FOR UPDATE SKIP LOCKED) RETURNING id::text,provider_key`)
    ).rows;
  }
  async pendingInbox(db: PoolClient) {
    return (
      await db.query<{ id: string }>(
        "SELECT id::text FROM payment_webhooks WHERE provider='PAYOS' AND status='RECEIVED' ORDER BY id LIMIT 50",
      )
    ).rows;
  }
  async failUnpaid(db: PoolClient, id: string) {
    await db.query(
      "UPDATE payments SET status='FAILED' WHERE id=$1 AND status='PENDING' AND received_minor=0",
      [id],
    );
  }
  async audit(
    db: PoolClient,
    actorId: string | null,
    action: string,
    id: string,
    requestId: string,
  ) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id)
      VALUES($1,$2,$3,'PAYMENT',$4,$5)`,
      [actorId ? 'USER' : 'SYSTEM', actorId, action, id, requestId],
    );
  }
}
