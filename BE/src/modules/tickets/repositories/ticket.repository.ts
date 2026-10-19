import type { PoolClient } from 'pg';
import type { LockedPurchase } from '../../payments/application/payment.ports.js';
import { issueCode } from '../issuance/ticket.crypto.js';
export class TicketRepository {
  async issue(db: PoolClient, purchase: LockedPurchase) {
    for (const item of purchase.items) {
      const code = issueCode(item.id, purchase.sessionId);
      await db.query(
        `INSERT INTO tickets(booking_item_id,session_seat_id,ticket_code_hash,ticket_code_ciphertext,ticket_key_version)
    VALUES($1,$2,$3,$4,$5)`,
        [item.id, item.seatId, code.hash, code.ciphertext, code.version],
      );
    }
  }
  async own(db: PoolClient, actorId: string, bookingId?: string, ticketId?: string) {
    return (
      await db.query(
        `SELECT t.id::text,t.status,t.booking_item_id::text AS item_id,t.ticket_code_ciphertext,t.ticket_key_version,
   b.id::text AS booking_id,b.session_id::text,e.title,e.public_id AS event_id,s.starts_at,s.timezone,
   bi.attendee_name_snapshot AS attendee_name,bi.seat_label_snapshot AS seat_label,s.admission_opens_at,s.admission_closes_at,
   s.counter_opens_at,s.counter_closes_at,t.admitted_at,ci.method AS check_in_method,ci.checked_in_at,
   e.status AS event_status,s.status AS session_status,o.status AS organization_status,
   s.starts_at-interval '24 hours'<=clock_timestamp() AND clock_timestamp()<s.starts_at AS online_check_in_open
   FROM tickets t JOIN booking_items bi ON bi.id=t.booking_item_id JOIN bookings b ON b.id=bi.booking_id
   JOIN event_sessions s ON s.id=b.session_id JOIN events e ON e.id=b.event_id JOIN organizations o ON o.id=e.organization_id
    LEFT JOIN check_ins ci ON ci.ticket_id=t.id
   WHERE b.customer_id=$1 AND ($2::bigint IS NULL OR b.id=$2) AND ($3::bigint IS NULL OR t.id=$3) ORDER BY t.id`,
        [actorId, bookingId ?? null, ticketId ?? null],
      )
    ).rows;
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
   VALUES($1,$2,$3,'TICKET',$4,$5)`,
      [actorId ? 'USER' : 'SYSTEM', actorId, action, id, requestId],
    );
  }
}
