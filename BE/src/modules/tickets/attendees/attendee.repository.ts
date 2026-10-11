import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { encryptCccd } from './attendee.crypto.js';
import type { AttendeeInput } from './attendee.schema.js';
export type BookingContext = {
  id: string;
  session_id: string;
  event_id: string;
  status: string;
  expired: boolean;
  event_status: string;
  session_status: string;
  minimum_age: number | null;
  reference_date: string;
  today: string;
  purge_after: Date;
};
export const attendeeRepository = {
  async paymentInProgress(db: PoolClient, bookingId: string) {
    return !!(
      await db.query(
        "SELECT id FROM payments WHERE booking_id=$1 AND (status IN ('PENDING','SUCCESS') OR received_minor>0) LIMIT 1",
        [bookingId],
      )
    ).rowCount;
  },
  async booking(
    db: PoolClient,
    actor: RequestActor,
    id: string,
    lock = false,
  ): Promise<BookingContext> {
    const first = await db.query<{ session_id: string; event_id: string }>(
      `SELECT session_id::text,event_id::text FROM bookings WHERE id=$1 AND customer_id=$2`,
      [id, actor.id],
    );
    if (!first.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt vé.');
    if (lock) {
      await db.query(
        'SELECT customer_id FROM reservation_quotas WHERE customer_id=$1 AND session_id=$2 FOR UPDATE',
        [actor.id, first.rows[0].session_id],
      );
      await db.query('SELECT id FROM events WHERE id=$1 FOR SHARE', [first.rows[0].event_id]);
      await db.query('SELECT id FROM event_sessions WHERE id=$1 FOR SHARE', [
        first.rows[0].session_id,
      ]);
    }
    const { rows } = await db.query<BookingContext>(
      `SELECT b.id::text,b.session_id::text,b.event_id::text,b.status,
      b.expires_at<=clock_timestamp() AS expired,e.status AS event_status,s.status AS session_status,e.minimum_age,
      to_char((s.starts_at AT TIME ZONE v.timezone)::date,'YYYY-MM-DD') AS reference_date,
      to_char(CURRENT_DATE,'YYYY-MM-DD') AS today,s.ends_at+interval '30 days' AS purge_after
      FROM bookings b JOIN events e ON e.id=b.event_id JOIN event_sessions s ON s.id=b.session_id
      JOIN venues v ON v.id=s.venue_id WHERE b.id=$1 AND b.customer_id=$2 ${lock ? 'FOR UPDATE OF b' : ''}`,
      [id, actor.id],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt vé.');
    return rows[0];
  },
  async items(db: PoolClient, bookingId: string, lock = false) {
    const { rows } = await db.query<{ id: string }>(
      'SELECT id::text FROM booking_items WHERE booking_id=$1 ORDER BY id' +
        (lock ? ' FOR UPDATE' : ''),
      [bookingId],
    );
    return rows;
  },
  async save(db: PoolClient, context: BookingContext, attendee: AttendeeInput) {
    const pii = encryptCccd(attendee.cccd, attendee.bookingItemId, context.session_id);
    await db.query(
      `UPDATE booking_items SET attendee_name_snapshot=$2,attendee_date_of_birth=$3,attendee_phone=$4,
      cccd_ciphertext=$5,cccd_mac=$6,cccd_last_four=$7,pii_key_version=$8,cccd_purge_after=$9,
      cccd_purged_at=NULL,identity_verified_at=NULL,identity_verified_by=NULL WHERE id=$1`,
      [
        attendee.bookingItemId,
        attendee.fullName,
        attendee.dateOfBirth,
        attendee.phone,
        pii.ciphertext,
        pii.mac,
        pii.lastFour,
        pii.keyVersion,
        context.purge_after,
      ],
    );
  },
  async list(db: PoolClient, bookingId: string) {
    const { rows } = await db.query(
      `SELECT bi.id::text AS "bookingItemId",CASE WHEN bi.attendee_date_of_birth IS NOT NULL THEN bi.attendee_name_snapshot ELSE NULL END AS "fullName",
      to_char(bi.attendee_date_of_birth,'YYYY-MM-DD') AS "dateOfBirth",bi.attendee_phone AS phone,
      CASE WHEN bi.cccd_purge_after>clock_timestamp() THEN '********'||bi.cccd_last_four ELSE NULL END AS "maskedCccd",
      bi.identity_verified_at IS NOT NULL AS "identityVerified",bi.cccd_purged_at AS "cccdPurgedAt"
      FROM booking_items bi WHERE bi.booking_id=$1 ORDER BY bi.id`,
      [bookingId],
    );
    return rows;
  },
  async purge(db: PoolClient) {
    const result =
      await db.query(`UPDATE booking_items SET cccd_ciphertext=NULL,cccd_mac=NULL,cccd_last_four=NULL,
      pii_key_version=NULL,cccd_purged_at=clock_timestamp() WHERE id IN (
      SELECT id FROM booking_items WHERE cccd_purged_at IS NULL AND cccd_purge_after<=clock_timestamp()
      ORDER BY cccd_purge_after,id LIMIT 1000 FOR UPDATE SKIP LOCKED)`);
    return result.rowCount ?? 0;
  },
  async verification(db: PoolClient, actor: RequestActor, ticketId: string) {
    const lookup = await db.query<{
      event_id: string;
      session_id: string;
      booking_id: string;
      booking_item_id: string;
      organization_id: string;
    }>(
      `SELECT b.event_id::text,b.session_id::text,b.id::text AS booking_id,
      bi.id::text AS booking_item_id,e.organization_id::text FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id
      JOIN bookings b ON b.id=bi.booking_id JOIN events e ON e.id=b.event_id WHERE t.id=$1`,
      [ticketId],
    );
    const target = lookup.rows[0];
    if (!target) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé.');
    const access = await db.query(
      `SELECT m.id FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id
      JOIN auth_sessions s ON s.user_id=m.user_id AND s.identity_id=m.company_identity_id
      JOIN external_identities i ON i.id=s.identity_id JOIN user_roles ur ON ur.user_id=m.user_id
      JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id
      WHERE m.user_id=$1 AND s.id=$2 AND m.organization_id=$3 AND p.code='ticket.checkin_own'
      AND m.status='ACTIVE' AND o.status='APPROVED' AND s.revoked_at IS NULL AND s.expires_at>clock_timestamp()
      AND i.revoked_at IS NULL AND i.email_verified_at IS NOT NULL AND i.provider=m.company_identity_provider
      AND i.provider IN ('GOOGLE','COMPANY_EMAIL') AND split_part(i.email_canonical,'@',2)=o.company_domain
      AND (i.provider='COMPANY_EMAIL' OR i.hosted_domain=o.company_domain) FOR SHARE OF m,o,s,i,ur,rp`,
      [actor.id, actor.sessionId, target.organization_id],
    );
    if (!access.rowCount) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé.');
    await db.query('SELECT id FROM events WHERE id=$1 FOR SHARE', [target.event_id]);
    await db.query('SELECT id FROM event_sessions WHERE id=$1 FOR SHARE', [target.session_id]);
    await db.query('SELECT id FROM bookings WHERE id=$1 FOR SHARE', [target.booking_id]);
    await db.query('SELECT id FROM booking_items WHERE id=$1 FOR UPDATE', [target.booking_item_id]);
    const { rows } = await db.query<{
      booking_item_id: string;
      session_id: string;
      full_name: string;
      date_of_birth: string;
      cccd_mac: Buffer | null;
      minimum_age: number | null;
      reference_date: string;
      available: boolean;
    }>(
      `SELECT bi.id::text AS booking_item_id,
      s.id::text AS session_id,bi.attendee_name_snapshot AS full_name,to_char(bi.attendee_date_of_birth,'YYYY-MM-DD') AS date_of_birth,bi.cccd_mac,e.minimum_age,
      to_char((s.starts_at AT TIME ZONE v.timezone)::date,'YYYY-MM-DD') AS reference_date,
      (t.status='VALID' AND b.status='CONFIRMED' AND e.status='PUBLISHED' AND s.status='SCHEDULED'
       AND clock_timestamp()>=s.admission_opens_at AND clock_timestamp()<s.admission_closes_at
       AND bi.cccd_purged_at IS NULL AND clock_timestamp()<bi.cccd_purge_after) AS available
      FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN bookings b ON b.id=bi.booking_id
      JOIN event_sessions s ON s.id=b.session_id JOIN events e ON e.id=b.event_id JOIN venues v ON v.id=s.venue_id
      WHERE t.id=$1 FOR UPDATE OF t,bi`,
      [ticketId],
    );
    if (!rows[0] || !rows[0].available)
      throw new AppError(
        409,
        'ATTENDEE_VERIFICATION_UNAVAILABLE',
        'Chưa thể xác minh người tham dự.',
      );
    return rows[0];
  },
  async markVerified(db: PoolClient, bookingItemId: string, actorId: string) {
    await db.query(
      'UPDATE booking_items SET identity_verified_at=clock_timestamp(),identity_verified_by=$2 WHERE id=$1',
      [bookingItemId, actorId],
    );
  },
  async audit(
    db: PoolClient,
    actorId: string,
    resourceId: string,
    action: string,
    requestId: string,
  ) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id)
      VALUES('USER',$1,$2,$3,$4,$5)`,
      [actorId, action, action.startsWith('ticket.') ? 'TICKET' : 'BOOKING', resourceId, requestId],
    );
  },
};
