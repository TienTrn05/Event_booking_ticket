import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withConnection } from '../../../shared/database/pool.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { redisCommand } from '../../../shared/redis/client.js';
import { parseCachedJson } from '../../../shared/validation/cached-json.js';
import * as inventoryRepo from '../inventory/inventory.repository.js';
import { assertSale } from '../shared/booking.policy.js';
import * as repo from '../shared/booking.repository.js';
import { roomOperation, roomPrefix, type MarketState } from './waiting-room.repository.js';
import { marketCacheSchema } from './waiting-room.schema.js';

async function market(publicId: string, sessionId: string): Promise<MarketState> {
  const cacheKey = roomPrefix(sessionId) + 'market';
  const cached = await redisCommand(['GET', cacheKey]);
  const value = parseCachedJson(marketCacheSchema, cached);
  if (value) {
    if (value.publicId !== publicId)
      throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy suất diễn.');
    return value.state;
  }
  // Single refresher per session prevents a cache miss stampede on the DB.
  const claimed = await redisCommand(['SET', cacheKey + ':refresh', '1', 'NX', 'PX', '2000']);
  if (!claimed)
    throw new AppError(
      503,
      'WAITING_ROOM_REFRESHING',
      'Phòng chờ đang cập nhật; vui lòng thử lại.',
    );
  const state = await withConnection(async (db) => {
    const context = await repo.sessionContext(db, sessionId, publicId);
    const time = await repo.now(db);
    try {
      assertSale(context, time);
    } catch {
      return 'CLOSED' as const;
    }
    const r = await inventoryRepo.availabilityCounts(db, sessionId, time);
    const seats = r.rows[0]!;
    if (seats.total > 0 && seats.sold === seats.total) return 'SOLD_OUT' as const;
    return seats.available > 0 ? ('OPEN' as const) : ('PAUSED' as const);
  });
  await redisCommand(['SET', cacheKey, JSON.stringify({ publicId, state }), 'PX', '2000']);
  return state;
}
export async function waitingRoom(
  actor: RequestActor,
  publicId: string,
  sessionId: string,
  mode: 'join' | 'status' | 'leave',
) {
  await withConnection(async (db) => {
    await repo.requireBuyer(db, actor, 'seat.hold');
  });
  return roomOperation(
    sessionId,
    actor.id,
    mode,
    mode === 'leave' ? 'PAUSED' : await market(publicId, sessionId),
  );
}
export async function returnAdmission(sessionId: string, userId: string) {
  // A committed hold no longer needs a browsing slot. Redis failure cannot undo it.
  try {
    await roomOperation(sessionId, userId, 'leave', 'PAUSED');
  } catch {
    /* absolute expiry releases it */
  }
}
