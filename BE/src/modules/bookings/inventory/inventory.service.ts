import { env } from '../../../config/env.js';
import { withConnection } from '../../../shared/database/pool.js';
import { redisCommand } from '../../../shared/redis/client.js';
import { parseCachedJson } from '../../../shared/validation/cached-json.js';
import { assertPublic } from '../shared/booking.policy.js';
import * as repo from '../shared/booking.repository.js';
import * as inventoryRepo from './inventory.repository.js';
import { inventorySnapshotSchema, type InventorySnapshot as Snapshot } from './inventory.schema.js';
const snapshots = new Map<string, Promise<Snapshot>>();

export function publicSessions(publicId: string) {
  return withConnection(async (db) => {
    const { rows } = await inventoryRepo.publicSessions(db, publicId);
    return rows;
  });
}
function loadSeats(publicId: string, sessionId: string): Promise<Snapshot> {
  return withConnection(async (db) => {
    const context = await repo.sessionContext(db, sessionId, publicId);
    const time = await repo.now(db);
    assertPublic(context, time);
    const { rows } = await inventoryRepo.publicSeats(db, sessionId, time);
    return { sessionId, serverTime: time, items: rows };
  });
}
export async function publicSeats(publicId: string, sessionId: string): Promise<Snapshot> {
  if (!env.REDIS_URL) return loadSeats(publicId, sessionId);
  const key = `${env.REDIS_PREFIX}:inventory:{${sessionId}}:${publicId}`;
  const existing = snapshots.get(key);
  if (existing) return existing;
  const work = (async () => {
    try {
      const cached = await redisCommand(['GET', key]);
      const parsed = parseCachedJson(inventorySnapshotSchema, cached);
      if (parsed && parsed.sessionId === sessionId) return parsed;
    } catch {
      return loadSeats(publicId, sessionId);
    }
    // Only a public snapshot is cached. No owner, hold pointers, tokens or PII.
    const loaded = await loadSeats(publicId, sessionId);
    try {
      await redisCommand(['SET', key, JSON.stringify(loaded), 'PX', '1000']);
    } catch {
      /* PG remains usable */
    }
    return loaded;
  })();
  snapshots.set(key, work);
  try {
    return await work;
  } finally {
    snapshots.delete(key);
  }
}
