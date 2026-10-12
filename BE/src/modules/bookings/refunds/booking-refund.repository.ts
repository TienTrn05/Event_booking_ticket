import type { PoolClient } from 'pg';
export class BookingRefundRepository {
  async tickets(db: PoolClient, id: string) {
    const ids = (
      await db.query<{ id: string }>(
        'SELECT t.id::text FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id WHERE bi.booking_id=$1 ORDER BY t.id',
        [id],
      )
    ).rows;
    const rows: { id: string; status: string }[] = [];
    for (const row of ids)
      rows.push(
        (
          await db.query<{ id: string; status: string }>(
            'SELECT id::text,status FROM tickets WHERE id=$1 FOR UPDATE',
            [row.id],
          )
        ).rows[0]!,
      );
    return rows;
  }
  async revoke(db: PoolClient, id: string) {
    await db.query(
      "UPDATE tickets SET status='CANCELLED' WHERE booking_item_id IN (SELECT id FROM booking_items WHERE booking_id=$1) AND status='VALID'",
      [id],
    );
  }
  async complete(db: PoolClient, id: string) {
    await db.query("UPDATE bookings SET status='REFUNDED' WHERE id=$1 AND status='CONFIRMED'", [
      id,
    ]);
    await db.query(
      "UPDATE tickets SET status='REFUNDED' WHERE booking_item_id IN (SELECT id FROM booking_items WHERE booking_id=$1) AND status='CANCELLED'",
      [id],
    );
  }
}
