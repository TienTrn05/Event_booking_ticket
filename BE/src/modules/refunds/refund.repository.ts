import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { AppError } from '../../shared/errors/app-error.js';
import type { RefundResult } from './refund.schema.js';
export type RefundContext = {
  booking_id: string;
  customer_id: string;
  payment_id: string | null;
  organization_id: string;
  event_id: string;
  session_id: string;
  starts_at: Date;
  event_status: string;
  session_status: string;
};
export type RefundRow = {
  type: 'CUSTOMER' | 'COMPENSATION';
  id: string;
  payment_id: string;
  requested_by: string | null;
  approved_by: string | null;
  status: string;
  amount_minor: string;
  reason: string;
  version: number;
  decision_reason: string | null;
  approved_at: Date | null;
  recorded_at: Date | null;
  provider_reference: string | null;
  evidence_note: string | null;
  transferred_at: Date | null;
  created_at: Date;
};
export class RefundRepository {
  private readonly select =
    'r.id::text,r.type,r.payment_id::text,r.requested_by::text,r.approved_by::text,r.status,r.amount_minor::text,r.reason,r.version,r.decision_reason,r.approved_at,r.recorded_at,r.provider_reference,r.evidence_note,r.transferred_at,r.created_at';
  async context(db: PoolClient, id: string, byRefund = false) {
    return (
      await db.query<RefundContext>(
        `SELECT b.id::text AS booking_id,b.customer_id::text,b.confirmed_payment_id::text AS payment_id,e.organization_id::text,e.id::text AS event_id,b.session_id::text,s.starts_at,e.status AS event_status,s.status AS session_status FROM bookings b JOIN events e ON e.id=b.event_id JOIN event_sessions s ON s.id=b.session_id ${byRefund ? 'JOIN payments p ON p.booking_id=b.id JOIN refunds r ON r.payment_id=p.id' : ''} WHERE ${byRefund ? 'r.id' : 'b.id'}=$1`,
        [id],
      )
    ).rows[0];
  }
  async get(db: PoolClient, id: string, lock = false) {
    return (
      await db.query<RefundRow>(
        `SELECT ${this.select} FROM refunds r WHERE r.id=$1 ${lock ? 'FOR UPDATE OF r' : ''}`,
        [id],
      )
    ).rows[0];
  }
  async active(db: PoolClient, paymentId: string) {
    return (
      await db.query<{ id: string }>(
        "SELECT id::text FROM refunds WHERE payment_id=$1 AND status<>'REJECTED' FOR UPDATE",
        [paymentId],
      )
    ).rows[0];
  }
  async create(db: PoolClient, userId: string, paymentId: string, amount: string, reason: string) {
    return (
      await db.query<{ id: string }>(
        "INSERT INTO refunds(payment_id,requested_by,type,amount_minor,reason,provider,provider_key) VALUES($1,$2,'CUSTOMER',$3,$4,'PAYOS',$5) RETURNING id::text",
        [paymentId, userId, amount, reason, randomUUID()],
      )
    ).rows[0]!.id;
  }
  async cancellation(
    db: PoolClient,
    paymentId: string,
    actorId: string,
    amount: string,
    reason: string,
  ) {
    const current = await this.active(db, paymentId);
    if (current) {
      await db.query(
        "UPDATE refunds SET status='PROCESSING',approved_by=$2,approved_at=clock_timestamp(),decision_reason=$3,version=version+1 WHERE id=$1 AND status='REQUESTED'",
        [current.id, actorId, reason],
      );
      return current.id;
    }
    return (
      await db.query<{ id: string }>(
        "INSERT INTO refunds(payment_id,type,status,amount_minor,reason,provider,provider_key,approved_by,approved_at,decision_reason) VALUES($1,'COMPENSATION','PROCESSING',$3,$4,'PAYOS',$5,$2,clock_timestamp(),$4) RETURNING id::text",
        [paymentId, actorId, amount, reason.slice(0, 500), randomUUID()],
      )
    ).rows[0]!.id;
  }
  async adminRole(db: PoolClient, id: string) {
    return !!(
      await db.query(
        "SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE ur.user_id=$1 AND r.code='ADMIN' FOR SHARE OF ur",
        [id],
      )
    ).rowCount;
  }
  async referenceExists(db: PoolClient, reference: string, id: string) {
    return !!(
      await db.query(
        "SELECT id FROM refunds WHERE provider='PAYOS' AND provider_reference=$1 AND id<>$2",
        [reference, id],
      )
    ).rowCount;
  }
  async decide(
    db: PoolClient,
    id: string,
    userId: string,
    approve: boolean,
    reason: string,
    reportId?: string,
  ) {
    await db.query(
      'UPDATE refunds SET status=$2,approved_by=CASE WHEN $3 THEN $4::bigint ELSE NULL END,approved_at=CASE WHEN $3 THEN clock_timestamp() ELSE NULL END,decision_reason=$5,support_report_id=$6,version=version+1 WHERE id=$1',
      [id, approve ? 'PROCESSING' : 'REJECTED', approve, userId, reason, reportId ?? null],
    );
  }
  async result(db: PoolClient, id: string, userId: string, input: RefundResult) {
    if (input.status === 'SUCCESS') {
      try {
        await db.query(
          "UPDATE refunds SET status='SUCCESS',provider_reference=$2,evidence_note=$3,transferred_at=$4,recorded_by=$5,recorded_at=clock_timestamp(),version=version+1 WHERE id=$1",
          [id, input.reference, input.evidenceNote, input.transferredAt, userId],
        );
      } catch (error) {
        if (error && typeof error === 'object' && 'code' in error && error.code === '23505')
          throw new AppError(
            409,
            'REFUND_REFERENCE_EXISTS',
            'Chứng từ đã dùng cho khoản hoàn khác.',
          );
        throw error;
      }
    } else
      await db.query(
        "UPDATE refunds SET status='FAILED',decision_reason=$2,recorded_by=$3,recorded_at=clock_timestamp(),version=version+1 WHERE id=$1",
        [id, input.reason, userId],
      );
  }
  async retry(db: PoolClient, id: string, reason: string) {
    await db.query(
      "UPDATE refunds SET status='PROCESSING',decision_reason=$2,version=version+1 WHERE id=$1",
      [id, reason],
    );
  }
  async list(
    db: PoolClient,
    scope: 'self' | 'organization' | 'admin',
    id: string,
    page: number,
    size: number,
  ) {
    const where =
      scope === 'self'
        ? 'b.customer_id=$1'
        : scope === 'organization'
          ? 'e.organization_id=$1'
          : 'b.id=$1';
    const joins =
      'FROM refunds r JOIN payments p ON p.id=r.payment_id JOIN bookings b ON b.id=p.booking_id JOIN events e ON e.id=b.event_id';
    return {
      items: (
        await db.query<RefundRow>(
          `SELECT ${this.select} ${joins} WHERE ${where} ORDER BY r.id DESC LIMIT $2 OFFSET $3`,
          [id, size, (page - 1) * size],
        )
      ).rows,
      total: (
        await db.query<{ total: number }>(`SELECT count(*)::int AS total ${joins} WHERE ${where}`, [
          id,
        ])
      ).rows[0]!.total,
    };
  }
  async report(db: PoolClient, id: string, userId: string, context?: RefundContext) {
    return (
      await db.query<{ id: string; booking_id: string; event_id: string }>(
        `SELECT id::text,booking_id::text,event_id::text FROM support_reports WHERE id=$1 AND assigned_admin_id=$2 AND status='IN_REVIEW' ${context ? 'AND booking_id=$3 AND event_id=$4' : ''} FOR SHARE`,
        context ? [id, userId, context.booking_id, context.event_id] : [id, userId],
      )
    ).rows[0];
  }
  async createReport(db: PoolClient, userId: string, context: RefundContext, reason: string) {
    return (
      await db.query<{ id: string }>(
        'INSERT INTO support_reports(reporter_id,event_id,booking_id,reason) VALUES($1,$2,$3,$4) RETURNING id::text',
        [userId, context.event_id, context.booking_id, reason],
      )
    ).rows[0]!.id;
  }
  async reports(db: PoolClient, userId: string, admin: boolean, page: number, size: number) {
    return (
      await db.query(
        'SELECT id::text,reporter_id::text,event_id::text,booking_id::text,reason,status,version,assigned_admin_id::text,resolution,created_at FROM support_reports WHERE ($1 OR reporter_id=$2) ORDER BY id DESC LIMIT $3 OFFSET $4',
        [admin, userId, size, (page - 1) * size],
      )
    ).rows;
  }
  async claimReport(db: PoolClient, id: string, userId: string) {
    return (
      await db.query(
        "UPDATE support_reports SET status='IN_REVIEW',assigned_admin_id=$2,version=version+1 WHERE id=$1 AND (status='OPEN' OR (status='IN_REVIEW' AND assigned_admin_id=$2)) RETURNING id::text,status,version",
        [id, userId],
      )
    ).rows[0];
  }
  async closeReport(
    db: PoolClient,
    id: string,
    userId: string,
    version: number,
    resolution: string,
  ) {
    return (
      await db.query(
        "UPDATE support_reports SET status='RESOLVED',resolution=$4,resolved_at=clock_timestamp(),version=version+1 WHERE id=$1 AND assigned_admin_id=$2 AND status='IN_REVIEW' AND version=$3 RETURNING id::text,status,version",
        [id, userId, version, resolution],
      )
    ).rows[0];
  }
  async audit(
    db: PoolClient,
    userId: string,
    id: string,
    action: string,
    requestId: string,
    type = 'REFUND',
    context?: { organizationId?: string; reportId?: string; version?: number; status?: string },
  ) {
    await db.query(
      "INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id,organization_id,support_report_id,after_redacted) VALUES('USER',$1,$2,$3,$4,$5,$6,$7,$8)",
      [
        userId,
        action,
        type,
        id,
        requestId,
        context?.organizationId ?? null,
        context?.reportId ?? null,
        context ? JSON.stringify({ version: context.version, status: context.status }) : null,
      ],
    );
  }
}
