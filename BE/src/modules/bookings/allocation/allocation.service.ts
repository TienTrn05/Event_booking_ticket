import { randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { compareIds } from '../../../shared/database/ids.js';
import { withConnection } from '../../../shared/database/pool.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import * as repo from '../shared/booking.repository.js';
import * as allocationRepo from './allocation.repository.js';

import { purgeExpiredKeys } from '../../../shared/idempotency/idempotency.repository.js';

export class CleanupRequired extends Error {
  constructor(readonly holdIds: string[]) {
    super('Expired allocation requires cleanup');
  }
}

export async function allocationLocks(db: PoolClient, hold: repo.HoldRow) {
  await repo.quota(db, hold.customer_id, hold.session_id);
  const context = await repo.sessionContext(db, hold.session_id, undefined, true);
  const current = await repo.holdRow(db, hold.id, hold.customer_id, true);
  const bookings = await allocationRepo.lockBookingForHold(db, hold.id);
  const items = await repo.holdItems(db, hold.id);
  const seats = await repo.seatRows(
    db,
    items.map((i) => i.session_seat_id),
    hold.session_id,
    true,
  );
  return { context, hold: current, booking: bookings.rows[0], items, seats };
}

export async function clearSeats(db: PoolClient, holdId: string) {
  // Locks were taken by PK; conditional pointer prevents releasing another buyer's allocation.
  await allocationRepo.clearHeldSeats(db, holdId);
}

export async function expireAllocation(holdId: string) {
  return withTransaction(async (db) => {
    const first = await repo.holdRow(db, holdId);
    const locked = await allocationLocks(db, first);
    const time = await repo.now(db);
    if (locked.hold.status === 'ACTIVE' && locked.hold.expires_at <= time) {
      await clearSeats(db, holdId);
      await allocationRepo.expireHold(db, holdId);
      await repo.audit(db, null, 'hold.expire', 'HOLD', holdId, randomUUID());
      return true;
    }
    if (
      locked.hold.status === 'CONVERTED' &&
      locked.booking?.status === 'AWAITING_PAYMENT' &&
      locked.booking.expires_at <= time
    ) {
      await clearSeats(db, holdId);
      await allocationRepo.expireBooking(db, locked.booking.id);
      await repo.audit(db, null, 'booking.expire', 'BOOKING', locked.booking.id, randomUUID());
      return true;
    }
    return false;
  });
}

export async function retryAfterCleanup<T>(work: () => Promise<T>) {
  for (let attempt = 0; ; attempt++) {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof CleanupRequired) || attempt >= 2) {
        if (error instanceof CleanupRequired)
          throw new AppError(409, 'SEAT_UNAVAILABLE', 'Ghế đang thay đổi; thử lại với cùng key.');
        throw error;
      }
      for (const id of [...new Set(error.holdIds)].sort(compareIds)) await expireAllocation(id);
    }
  }
}

export async function expireBatch() {
  await withTransaction(purgeExpiredKeys);
  const ids = await withConnection(
    async (db) => (await allocationRepo.expiredAllocationIds(db)).rows,
  );
  for (const row of ids) await expireAllocation(row.id);
  return ids.length;
}
