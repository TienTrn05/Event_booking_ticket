import type { PoolClient } from 'pg';

export function bookingAttendees(db: PoolClient, bookingId: string) {
  return db.query<{ sessionSeatId: string; attendeeName: string }>(
    `SELECT session_seat_id::text AS "sessionSeatId",attendee_name_snapshot AS "attendeeName"
        FROM booking_items WHERE booking_id=$1 ORDER BY session_seat_id`,
    [bookingId],
  );
}

export function insertBooking(
  db: PoolClient,
  input: {
    userId: string;
    sessionId: string;
    eventId: string;
    holdId: string;
    totalMinor: string;
    currency: string;
    expiresAt: Date;
  },
) {
  return db.query<{ id: string }>(
    `INSERT INTO bookings(customer_id,session_id,event_id,hold_id,total_minor,currency,expires_at)
      VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id::text`,
    [
      input.userId,
      input.sessionId,
      input.eventId,
      input.holdId,
      input.totalMinor,
      input.currency,
      input.expiresAt,
    ],
  );
}

export function insertBookingItem(
  db: PoolClient,
  input: {
    bookingId: string;
    seatId: string;
    sessionId: string;
    priceMinor: string;
    currency: string;
    attendeeName: string;
    ticketTypeCode: string;
    ticketTypeName: string;
    seatLabel: string;
  },
) {
  return db.query(
    `INSERT INTO booking_items(booking_id,session_seat_id,session_id,price_minor,currency,
        attendee_name_snapshot,ticket_type_code_snapshot,ticket_type_name_snapshot,seat_label_snapshot)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      input.bookingId,
      input.seatId,
      input.sessionId,
      input.priceMinor,
      input.currency,
      input.attendeeName,
      input.ticketTypeCode,
      input.ticketTypeName,
      input.seatLabel,
    ],
  );
}

export function assignSeatToBooking(db: PoolClient, seatId: string, bookingId: string) {
  return db.query('UPDATE session_seats SET current_booking_id=$2,version=version+1 WHERE id=$1', [
    seatId,
    bookingId,
  ]);
}

export function setBookingStatus(
  db: PoolClient,
  bookingId: string,
  status: 'EXPIRED' | 'CANCELLED',
) {
  return db.query('UPDATE bookings SET status=$2 WHERE id=$1', [bookingId, status]);
}

export function listBookingIds(db: PoolClient, userId: string, limit: number, offset: number) {
  return db.query<{ id: string }>(
    'SELECT id::text FROM bookings WHERE customer_id=$1 ORDER BY id DESC LIMIT $2 OFFSET $3',
    [userId, limit, offset],
  );
}

export function countBookings(db: PoolClient, userId: string) {
  return db.query<{ total: string }>(
    'SELECT count(*)::text AS total FROM bookings WHERE customer_id=$1',
    [userId],
  );
}
