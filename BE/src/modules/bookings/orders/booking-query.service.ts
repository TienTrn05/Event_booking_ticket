import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import * as repo from '../shared/booking.repository.js';
import * as bookingWrites from './booking-write.repository.js';

export async function getBooking(actor: RequestActor, id: string) {
  return withTransaction(async (db) => {
    await repo.requireBuyer(db, actor, 'booking.read_self');
    return repo.bookingDto(db, id, actor.id);
  });
}

export async function listBookings(actor: RequestActor, page: number, pageSize: number) {
  return withTransaction(async (db) => {
    await repo.requireBuyer(db, actor, 'booking.read_self');
    const ids = await bookingWrites.listBookingIds(db, actor.id, pageSize, (page - 1) * pageSize);
    const total = Number((await bookingWrites.countBookings(db, actor.id)).rows[0]!.total);
    const items = [];
    for (const row of ids.rows) items.push(await repo.bookingDto(db, row.id, actor.id));
    return {
      items,
      pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  });
}
