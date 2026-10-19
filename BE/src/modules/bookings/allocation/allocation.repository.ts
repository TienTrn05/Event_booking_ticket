import type { PoolClient } from 'pg';

export function lockBookingForHold(db: PoolClient, holdId: string) {
  return db.query<{ id: string; status: string; expires_at: Date }>(
    'SELECT id::text,status,expires_at FROM bookings WHERE hold_id=$1 ORDER BY id FOR UPDATE',
    [holdId],
  );
}

export function clearHeldSeats(db: PoolClient, holdId: string) {
  return db.query(
    `UPDATE session_seats SET status='AVAILABLE',hold_id=NULL,hold_expires_at=NULL,current_booking_id=NULL,version=version+1
    WHERE hold_id=$1 AND status='HELD'`,
    [holdId],
  );
}

export function expireHold(db: PoolClient, holdId: string) {
  return db.query("UPDATE seat_holds SET status='EXPIRED' WHERE id=$1", [holdId]);
}

export function expireBooking(db: PoolClient, bookingId: string) {
  return db.query("UPDATE bookings SET status='EXPIRED' WHERE id=$1", [bookingId]);
}

export function findHoldReplay(db: PoolClient, actorScope: string, operation: string, key: string) {
  return db.query(
    'SELECT 1 FROM idempotency_records WHERE actor_scope=$1 AND operation=$2 AND idempotency_key=$3 AND expires_at>clock_timestamp() AND resource_id IS NOT NULL',
    [actorScope, operation, key],
  );
}

export function listActiveAllocations(db: PoolClient, userId: string, sessionId: string) {
  return db.query<{
    id: string;
    status: string;
    expires_at: Date;
    booking_status: string | null;
  }>(
    `SELECT h.id::text,h.status,h.expires_at,b.status AS booking_status FROM seat_holds h
        LEFT JOIN bookings b ON b.hold_id=h.id WHERE h.customer_id=$1 AND h.session_id=$2
        AND (h.status='ACTIVE' OR (h.status='CONVERTED' AND b.status='AWAITING_PAYMENT')) ORDER BY h.id`,
    [userId, sessionId],
  );
}

export function insertHold(db: PoolClient, userId: string, sessionId: string) {
  return db.query<{ id: string }>(
    `INSERT INTO seat_holds(customer_id,session_id,expires_at)
      VALUES($1,$2,clock_timestamp()+interval '5 minutes') RETURNING id::text`,
    [userId, sessionId],
  );
}

export function setHoldExpiry(db: PoolClient, holdId: string, expiresAt: Date) {
  return db.query('UPDATE seat_holds SET expires_at=$2 WHERE id=$1', [holdId, expiresAt]);
}

export function insertHoldItem(
  db: PoolClient,
  input: {
    holdId: string;
    seatId: string;
    sessionId: string;
    priceMinor: string;
    currency: string;
  },
) {
  return db.query(
    'INSERT INTO seat_hold_items(hold_id,session_seat_id,session_id,price_minor,currency) VALUES($1,$2,$3,$4,$5)',
    [input.holdId, input.seatId, input.sessionId, input.priceMinor, input.currency],
  );
}

export function assignSeatToHold(db: PoolClient, seatId: string, holdId: string, expiresAt: Date) {
  return db.query(
    "UPDATE session_seats SET status='HELD',hold_id=$2,hold_expires_at=$3,version=version+1 WHERE id=$1",
    [seatId, holdId, expiresAt],
  );
}

export function convertHold(db: PoolClient, holdId: string) {
  return db.query("UPDATE seat_holds SET status='CONVERTED' WHERE id=$1", [holdId]);
}

export function setHoldStatus(db: PoolClient, holdId: string, status: 'EXPIRED' | 'RELEASED') {
  return db.query('UPDATE seat_holds SET status=$2 WHERE id=$1', [holdId, status]);
}

export function expiredAllocationIds(db: PoolClient) {
  return db.query<{ id: string }>(`SELECT h.id::text FROM seat_holds h
    LEFT JOIN bookings b ON b.hold_id=h.id WHERE h.expires_at<=clock_timestamp()
    AND (h.status='ACTIVE' OR (h.status='CONVERTED' AND b.status='AWAITING_PAYMENT')) ORDER BY h.id LIMIT 100`);
}
