import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { compareIds } from '../../../shared/database/ids.js';
import { withConnection } from '../../../shared/database/pool.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { AppError } from '../../../shared/errors/app-error.js';
import * as allocationRepo from '../allocation/allocation.repository.js';
import {
  CleanupRequired,
  allocationLocks,
  clearSeats,
  retryAfterCleanup,
} from '../allocation/allocation.service.js';
import { assertSale } from '../shared/booking.policy.js';
import * as repo from '../shared/booking.repository.js';

import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
export async function createHold(
  actor: RequestActor,
  publicId: string,
  sessionId: string,
  seatIds: string[],
  key: string,
  requestId: string,
  admit: () => Promise<void>,
) {
  const sorted = [...seatIds].sort(compareIds);
  // Redis/network admission is outside the PG transaction. Replay avoids needing a new queue lease.
  const previous = await withConnection(async (db) => {
    await repo.requireBuyer(db, actor, 'seat.hold');
    const r = await allocationRepo.findHoldReplay(db, `user:${actor.id}`, 'hold.create', key);
    return !!r.rowCount;
  });
  if (!previous) await admit();
  return retryAfterCleanup(() =>
    withTransaction(async (db) => {
      await repo.requireBuyer(db, actor, 'seat.hold');
      const record = await claimKey(db, actor.id, 'hold.create', key, {
        method: 'POST',
        route: 'events/:eventId/sessions/:sessionId/seats/hold',
        publicId,
        sessionId,
        seatIds: sorted,
      });
      if (record.resource_id)
        return {
          status: record.response_code!,
          data: await repo.holdDto(db, record.resource_id, actor.id),
          replayed: true,
        };
      await repo.quota(db, actor.id, sessionId);
      const context = await repo.sessionContext(db, sessionId, publicId, true);
      const own = await allocationRepo.listActiveAllocations(db, actor.id, sessionId);
      let time = await repo.now(db);
      const expired = own.rows.filter((h) => h.expires_at <= time);
      if (expired.length) throw new CleanupRequired(expired.map((h) => h.id));
      if (own.rowCount)
        throw new AppError(
          409,
          'ACTIVE_ALLOCATION_EXISTS',
          'Bạn đang có một lượt giữ ghế hoặc đơn chưa kết thúc trong suất này.',
        );
      assertSale(context, time);
      // Hold row precedes seat locks. It remains invisible until commit and rolls back on any failure.
      const hold = (await allocationRepo.insertHold(db, actor.id, sessionId)).rows[0]!;
      const seats = await repo.seatRows(db, sorted, sessionId, true);
      time = await repo.now(db);
      assertSale(context, time);
      const stale = seats.filter(
        (s) => s.status === 'HELD' && s.hold_expires_at && s.hold_expires_at <= time && s.hold_id,
      );
      if (stale.length) throw new CleanupRequired(stale.map((s) => s.hold_id!));
      if (seats.some((s) => s.status !== 'AVAILABLE' || !s.active))
        throw new AppError(409, 'SEAT_UNAVAILABLE', 'Một hoặc nhiều ghế không còn trống.');
      if (new Set(seats.map((s) => s.currency)).size !== 1)
        throw new AppError(409, 'CURRENCY_CONFLICT', 'Các ghế phải cùng đơn vị tiền tệ.');
      if (seats.some((s) => BigInt(s.price_minor) <= 0))
        throw new AppError(409, 'PRICE_NOT_CONFIGURED', 'Vé trả tiền phải có giá lớn hơn 0.');
      const expires = new Date(time.getTime() + 300_000);
      await allocationRepo.setHoldExpiry(db, hold.id, expires);
      for (const seat of seats) {
        await allocationRepo.insertHoldItem(db, {
          holdId: hold.id,
          seatId: seat.id,
          sessionId: sessionId,
          priceMinor: seat.price_minor,
          currency: seat.currency,
        });
        await allocationRepo.assignSeatToHold(db, seat.id, hold.id, expires);
      }
      await repo.audit(db, actor.id, 'hold.create', 'HOLD', hold.id, requestId);
      await finishKey(db, record.id, 'HOLD', hold.id, 201);
      return { status: 201, data: await repo.holdDto(db, hold.id, actor.id), replayed: false };
    }),
  );
}

export async function releaseHold(actor: RequestActor, id: string, key: string, requestId: string) {
  return withTransaction(async (db) => {
    await repo.requireBuyer(db, actor, 'seat.hold');
    const record = await claimKey(db, actor.id, 'hold.release', key, {
      method: 'DELETE',
      route: 'holds/:holdId',
      id,
    });
    if (record.resource_id) {
      await repo.holdRow(db, id, actor.id);
      return;
    }
    const locked = await allocationLocks(db, await repo.holdRow(db, id, actor.id));
    if (locked.hold.status === 'CONVERTED')
      throw new AppError(409, 'HOLD_ALREADY_CONVERTED', 'Hãy hủy booking tương ứng.');
    if (locked.hold.status === 'ACTIVE') {
      const expired = locked.hold.expires_at <= (await repo.now(db));
      await clearSeats(db, id);
      await allocationRepo.setHoldStatus(db, id, expired ? 'EXPIRED' : 'RELEASED');
      await repo.audit(db, actor.id, 'hold.release', 'HOLD', id, requestId);
    }
    await finishKey(db, record.id, 'HOLD', id, 204);
  });
}

export async function getHold(actor: RequestActor, id: string) {
  return withTransaction(async (db) => {
    await repo.requireBuyer(db, actor, 'seat.hold');
    return repo.holdDto(db, id, actor.id);
  });
}
