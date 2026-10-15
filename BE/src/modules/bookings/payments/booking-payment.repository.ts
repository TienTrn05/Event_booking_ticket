import type { PoolClient } from 'pg';
export class BookingPaymentRepository {
  async lookup(db: PoolClient, id: string, ownerId?: string) {
    return (
      await db.query<{ id: string; hold_id: string; customer_id: string }>(
        `SELECT id::text,hold_id::text,customer_id::text FROM bookings
      WHERE id=$1 AND ($2::bigint IS NULL OR customer_id=$2)`,
        [id, ownerId ?? null],
      )
    ).rows[0];
  }
  async details(db: PoolClient, id: string) {
    return (
      await db.query<{
        status: string;
        confirmed_payment_id: string | null;
        expires_at: Date;
        total_minor: string;
        currency: string;
        customer_active: boolean;
      }>(
        `SELECT b.status,b.confirmed_payment_id::text,b.expires_at,b.total_minor::text,b.currency,u.status='ACTIVE' AS customer_active
        FROM bookings b JOIN users u ON u.id=b.customer_id WHERE b.id=$1`,
        [id],
      )
    ).rows[0]!;
  }
  async items(db: PoolClient, id: string) {
    return (
      await db.query<{
        id: string;
        seatId: string;
        name: string;
        price: string;
        eligible: boolean;
      }>(
        `SELECT bi.id::text,bi.session_seat_id::text AS "seatId",bi.seat_label_snapshot AS name,bi.price_minor::text AS price,
        (bi.attendee_date_of_birth IS NOT NULL AND bi.attendee_date_of_birth<=CURRENT_DATE
          AND bi.attendee_phone IS NOT NULL AND bi.cccd_ciphertext IS NOT NULL AND bi.cccd_purged_at IS NULL
          AND bi.cccd_purge_after>clock_timestamp() AND (e.minimum_age IS NULL OR
           EXTRACT(YEAR FROM age((s.starts_at AT TIME ZONE v.timezone)::date,bi.attendee_date_of_birth))>=e.minimum_age)) AS eligible
        FROM booking_items bi JOIN event_sessions s ON s.id=bi.session_id JOIN events e ON e.id=s.event_id
        JOIN venues v ON v.id=s.venue_id WHERE bi.booking_id=$1 ORDER BY bi.id FOR UPDATE OF bi`,
        [id],
      )
    ).rows;
  }
  async confirm(db: PoolClient, id: string, paymentId: string) {
    await db.query(
      `UPDATE session_seats SET status='SOLD',hold_id=NULL,hold_expires_at=NULL,version=version+1
      WHERE current_booking_id=$1 AND status='HELD'`,
      [id],
    );
    await db.query(
      "UPDATE bookings SET status='CONFIRMED',confirmed_at=clock_timestamp(),confirmed_payment_id=$2 WHERE id=$1",
      [id, paymentId],
    );
  }
}
