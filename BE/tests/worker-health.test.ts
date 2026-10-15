import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, expect, it } from 'vitest';
import { WorkerHealthStore, type WorkerHealth } from '../src/shared/workers/worker-health.js';
let directory: string | undefined;
afterEach(async () => {
  if (directory?.startsWith(join(tmpdir(), 'eventix-worker-health-')))
    await rm(directory, { recursive: true, force: true });
  directory = undefined;
});
it('detects stale, stopped, stuck and repeatedly failing workers without trusting malformed heartbeat data', async () => {
  directory = await mkdtemp(join(tmpdir(), 'eventix-worker-health-'));
  const store = new WorkerHealthStore(directory),
    now = Date.now();
  const state: WorkerHealth = {
    name: 'bookings',
    pid: process.pid,
    updatedAt: now,
    state: 'idle',
    activeJob: null,
    activeSince: null,
    jobs: { expiry: { failures: 0, lastSuccessAt: now } },
  };
  await store.write(state);
  expect((await store.read('bookings', 60, 120, now)).healthy).toBe(true);
  expect((await store.read('bookings', 60, 120, now + 61000)).healthy).toBe(false);
  for (const change of [
    { state: 'stopped' as const },
    { activeJob: 'expiry', activeSince: now - 121000 },
    { jobs: { expiry: { failures: 3, lastSuccessAt: now } } },
  ]) {
    await store.write({ ...state, ...change });
    expect((await store.read('bookings', 60, 120, now)).healthy).toBe(false);
  }
  await writeFile(join(directory, 'bookings.json'), '{"password":"private-fixture"}');
  expect((await store.read('bookings', 60, 120, now)).state).toBeNull();
  expect((await store.read('notifications', 60, 120, now)).healthy).toBe(false);
});
