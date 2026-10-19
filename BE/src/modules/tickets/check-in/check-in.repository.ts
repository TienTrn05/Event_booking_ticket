import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { AppError } from '../../../shared/errors/app-error.js';
export type EntryTicket = {
  id: string;
  booking_id: string;
  item_id: string;
  session_id: string;
  organization_id: string;
  status: string;
  name: string;
  birth: string | null;
  cccd_mac: Buffer | null;
  identity_verified_at: Date | null;
  proof_available: boolean;
  minimum_age: number | null;
  reference_date: string;
  event_status: string;
  session_status: string;
  organization_status: string;
  starts_at: Date;
  counter_opens_at: Date;
  counter_closes_at: Date;
  admission_opens_at: Date;
  admission_closes_at: Date;
  now: Date;
};
export class CheckInRepository {
  async locate(db: PoolClient, hash: Buffer) {
    return (
      await db.query<{
        id: string;
        booking_id: string;
        organization_id: string;
        session_id: string;
      }>(
        `SELECT t.id::text,b.id::text AS booking_id,e.organization_id::text,b.session_id::text FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id
    JOIN bookings b ON b.id=bi.booking_id JOIN events e ON e.id=b.event_id WHERE t.ticket_code_hash=$1`,
        [hash],
      )
    ).rows[0];
  }
  async staff(db: PoolClient, actor: RequestActor, organizationId?: string) {
    const access = await db.query<{ organization_id: string }>(
      `SELECT m.organization_id::text FROM organization_memberships m JOIN organizations o ON o.id=m.organization_id
   JOIN auth_sessions a ON a.user_id=m.user_id JOIN external_identities i ON i.id=a.identity_id
   JOIN user_roles ur ON ur.user_id=m.user_id JOIN role_permissions rp ON rp.role_id=ur.role_id JOIN permissions p ON p.id=rp.permission_id
   WHERE m.user_id=$1 AND a.id=$2 AND ($3::bigint IS NULL OR m.organization_id=$3) AND p.code='ticket.checkin_own'
   AND m.status='ACTIVE' AND o.status='APPROVED' AND o.public_id IS NOT NULL AND a.revoked_at IS NULL AND a.expires_at>clock_timestamp()
   AND i.revoked_at IS NULL
    FOR SHARE OF m,o,a,i,ur,rp`,
      [actor.id, actor.sessionId, organizationId ?? null],
    );
    if (!access.rowCount)
      throw new AppError(403, 'FORBIDDEN', 'Cần phiên hợp lệ và quyền kiểm tra vé của tổ chức.');
    return access.rows;
  }
  async sessions(db: PoolClient, organizationIds: string[]) {
    return (
      await db.query(
        `SELECT s.id::text,e.title,e.public_id AS "eventId",s.starts_at AS "startsAt",s.timezone
   FROM event_sessions s JOIN events e ON e.id=s.event_id
   WHERE e.organization_id=ANY($1::bigint[]) AND e.status='PUBLISHED' AND s.status='SCHEDULED' ORDER BY s.starts_at DESC,s.id LIMIT 100`,
        [organizationIds],
      )
    ).rows;
  }
  async lock(db: PoolClient, id: string): Promise<EntryTicket> {
    const { rows } = await db.query<EntryTicket>(
      `SELECT t.id::text,bi.booking_id::text,bi.id::text AS item_id,bi.session_id::text,e.organization_id::text,t.status,
   bi.attendee_name_snapshot AS name,to_char(bi.attendee_date_of_birth,'YYYY-MM-DD') AS birth,bi.cccd_mac,bi.identity_verified_at,
   (bi.cccd_purged_at IS NULL AND bi.cccd_purge_after>clock_timestamp() AND bi.cccd_mac IS NOT NULL) AS proof_available,e.minimum_age,
   to_char((s.starts_at AT TIME ZONE v.timezone)::date,'YYYY-MM-DD') AS reference_date,e.status AS event_status,s.status AS session_status,
   o.status AS organization_status,s.starts_at,s.counter_opens_at,s.counter_closes_at,s.admission_opens_at,s.admission_closes_at,clock_timestamp() AS now
   FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN event_sessions s ON s.id=bi.session_id
   JOIN events e ON e.id=s.event_id JOIN organizations o ON o.id=e.organization_id JOIN venues v ON v.id=s.venue_id WHERE t.id=$1 FOR UPDATE OF t`,
      [id],
    );
    if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy vé.');
    return rows[0];
  }
  async existing(db: PoolClient, ticketId: string) {
    return (
      await db.query<{ id: string; method: string; checked_in_at: Date }>(
        'SELECT id::text,method,checked_in_at FROM check_ins WHERE ticket_id=$1 FOR UPDATE',
        [ticketId],
      )
    ).rows[0];
  }
  async checkIn(db: PoolClient, ticketId: string, actorId: string, method: 'ONLINE' | 'COUNTER') {
    return (
      await db.query<{ id: string; method: string; checked_in_at: Date }>(
        `INSERT INTO check_ins(ticket_id,method,actor_id,checked_in_at)
   VALUES($1,$2,$3,clock_timestamp()) RETURNING id::text,method,checked_in_at`,
        [ticketId, method, actorId],
      )
    ).rows[0]!;
  }
  async admit(db: PoolClient, ticket: EntryTicket, checkInId: string, actorId: string) {
    await db.query(
      'UPDATE booking_items SET identity_verified_at=clock_timestamp(),identity_verified_by=$2 WHERE id=$1',
      [ticket.item_id, actorId],
    );
    await db.query(
      "UPDATE tickets SET status='USED',admission_check_in_id=$2,admitted_at=clock_timestamp(),admitted_by=$3 WHERE id=$1",
      [ticket.id, checkInId, actorId],
    );
  }
}
