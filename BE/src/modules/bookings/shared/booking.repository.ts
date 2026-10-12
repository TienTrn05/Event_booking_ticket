import type { PoolClient } from 'pg';
import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { compareIds } from '../../../shared/database/ids.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { usersRepository } from '../../users/repositories/users.repository.js';

export type SaleContext = {
  id: string;
  event_id: string;
  organization_id: string;
  starts_at: Date;
  ends_at: Date;
  sale_opens_at: Date;
  sale_closes_at: Date;
  event_status: string;
  session_status: string;
  organization_status: string;
  published_at: Date | null;
};
export type HoldRow = {
  id: string;
  customer_id: string;
  session_id: string;
  status: string;
  expires_at: Date;
};
export type SeatRow = {
  id: string;
  session_id: string;
  status: string;
  hold_id: string | null;
  current_booking_id: string | null;
  hold_expires_at: Date | null;
  price_minor: string;
  currency: string;
  seat_label: string;
  ticket_type_code: string;
  ticket_type_name: string;
  active: boolean;
};
export async function requireBuyer(db: PoolClient, actor: RequestActor, permission: string) {
  await usersRepository.profile(db, actor, true);
  if (['seat.hold', 'booking.create'].includes(permission))
    await usersRepository.requireOnboarding(db, actor.id);
  const result = await db.query(
    `SELECT ur.user_id FROM user_roles ur JOIN roles r ON r.id=ur.role_id
    JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions p ON p.id=rp.permission_id
    WHERE ur.user_id=$1 AND r.code='CUSTOMER' AND p.code=$2 FOR SHARE OF ur,rp`,
    [actor.id, permission],
  );
  if (!result.rowCount)
    throw new AppError(403, 'FORBIDDEN', 'Không có quyền thực hiện thao tác này.');
}
export async function sessionContext(
  db: PoolClient,
  sessionId: string,
  eventPublicId?: string,
  lock = false,
): Promise<SaleContext> {
  const first = await db.query<{ event_id: string; organization_id: string }>(
    `SELECT s.event_id::text,e.organization_id::text FROM event_sessions s JOIN events e ON e.id=s.event_id
       WHERE s.id=$1 AND e.public_id IS NOT NULL AND ($2::text IS NULL OR e.public_id=$2)`,
    [sessionId, eventPublicId ?? null],
  );
  if (!first.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy suất diễn.');
  if (lock) {
    await db.query('SELECT id FROM organizations WHERE id=$1 FOR SHARE', [
      first.rows[0].organization_id,
    ]);
    await db.query('SELECT id FROM events WHERE id=$1 FOR SHARE', [first.rows[0].event_id]);
    await db.query('SELECT id FROM event_sessions WHERE id=$1 FOR SHARE', [sessionId]);
  }
  const { rows } = await db.query<SaleContext>(
    `SELECT s.id::text,s.event_id::text,e.organization_id::text,
    s.starts_at,s.ends_at,s.sale_opens_at,s.sale_closes_at,e.status AS event_status,s.status AS session_status,
    o.status AS organization_status,e.published_at FROM event_sessions s JOIN events e ON e.id=s.event_id
    JOIN organizations o ON o.id=e.organization_id
    WHERE s.id=$1 AND e.public_id IS NOT NULL AND ($2::text IS NULL OR e.public_id=$2)`,
    [sessionId, eventPublicId ?? null],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy suất diễn.');
  return rows[0];
}
export async function now(db: PoolClient): Promise<Date> {
  return (await db.query<{ now: Date }>('SELECT clock_timestamp() AS now')).rows[0]!.now;
}

export async function quota(db: PoolClient, userId: string, sessionId: string) {
  await db.query(
    'INSERT INTO reservation_quotas(customer_id,session_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
    [userId, sessionId],
  );
  await db.query(
    'SELECT customer_id FROM reservation_quotas WHERE customer_id=$1 AND session_id=$2 FOR UPDATE',
    [userId, sessionId],
  );
}
export async function holdRow(
  db: PoolClient,
  id: string,
  userId?: string,
  lock = false,
): Promise<HoldRow> {
  const { rows } = await db.query<HoldRow>(
    `SELECT id::text,customer_id::text,session_id::text,status,expires_at FROM seat_holds
    WHERE id=$1 AND ($2::bigint IS NULL OR customer_id=$2) ${lock ? 'FOR UPDATE' : ''}`,
    [id, userId ?? null],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy lượt giữ ghế.');
  return rows[0];
}
export async function seatRows(db: PoolClient, ids: string[], sessionId: string, lock = false) {
  const rows: SeatRow[] = [];
  for (const id of [...ids].sort(compareIds)) {
    const result = await db.query<SeatRow>(
      `SELECT ss.id::text,ss.session_id::text,ss.status,ss.hold_id::text,
      ss.current_booking_id::text,ss.hold_expires_at,ss.price_minor::text,ss.currency,
      ls.code||'-'||lr.code||'-'||s.number AS seat_label,tt.code AS ticket_type_code,tt.name AS ticket_type_name,s.is_active AS active
      FROM session_seats ss JOIN seats s ON s.id=ss.seat_id JOIN layout_rows lr ON lr.id=s.row_id
      JOIN layout_sections ls ON ls.id=lr.section_id JOIN ticket_types tt ON tt.id=ss.ticket_type_id
      WHERE ss.id=$1 AND ss.session_id=$2 ${lock ? 'FOR UPDATE OF ss' : ''}`,
      [id, sessionId],
    );
    if (!result.rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy ghế trong suất này.');
    rows.push(result.rows[0]);
  }
  return rows;
}
export async function holdItems(db: PoolClient, id: string) {
  return (
    await db.query<{ session_seat_id: string; price_minor: string; currency: string }>(
      'SELECT session_seat_id::text,price_minor::text,currency FROM seat_hold_items WHERE hold_id=$1 ORDER BY seat_hold_items.session_seat_id',
      [id],
    )
  ).rows;
}
export async function holdDto(db: PoolClient, id: string, userId: string) {
  const hold = await holdRow(db, id, userId);
  return {
    id: hold.id,
    sessionId: hold.session_id,
    status: hold.status,
    expiresAt: hold.expires_at,
    expired: hold.expires_at <= (await now(db)),
    items: (await holdItems(db, id)).map((i) => ({
      sessionSeatId: i.session_seat_id,
      priceMinor: i.price_minor,
      currency: i.currency,
    })),
  };
}
export async function bookingDto(db: PoolClient, id: string, userId: string) {
  const { rows } = await db.query(
    `SELECT id::text,event_id::text AS "eventId",session_id::text AS "sessionId",hold_id::text AS "holdId",status,
    total_minor::text AS "totalMinor",currency,expires_at AS "expiresAt",confirmed_at AS "confirmedAt",
    status='AWAITING_PAYMENT' AND expires_at<=clock_timestamp() AS expired,
    (SELECT p.id::text FROM payments p WHERE p.booking_id=bookings.id AND p.provider='PAYOS' ORDER BY p.id DESC LIMIT 1) AS "paymentId"
    FROM bookings WHERE id=$1 AND customer_id=$2`,
    [id, userId],
  );
  if (!rows[0]) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy đơn đặt vé.');
  const items = await db.query(
    `SELECT id::text,session_seat_id::text AS "sessionSeatId",price_minor::text AS "priceMinor",currency,
    attendee_name_snapshot AS "attendeeName",seat_label_snapshot AS "seatLabel",ticket_type_name_snapshot AS "ticketTypeName"
    FROM booking_items WHERE booking_id=$1 ORDER BY id`,
    [id],
  );
  return { ...rows[0], items: items.rows };
}
export async function audit(
  db: PoolClient,
  actorId: string | null,
  action: string,
  type: 'HOLD' | 'BOOKING',
  id: string,
  requestId: string,
) {
  await db.query(
    `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id)
    VALUES($1,$2,$3,$4,$5,$6)`,
    [actorId ? 'USER' : 'SYSTEM', actorId, action, type, id, requestId],
  );
}
