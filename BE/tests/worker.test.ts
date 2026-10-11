import { expect, it, vi } from 'vitest';
import { pool } from '../src/shared/database/pool.js';
import { logger } from '../src/shared/logging/logger.js';
import { closeRedis } from '../src/shared/redis/client.js';
import { runWorker } from '../src/shared/workers/run-worker.js';

vi.mock('../src/shared/database/pool.js', () => ({ pool: { end: vi.fn(async () => {}) } }));
vi.mock('../src/shared/redis/client.js', () => ({ closeRedis: vi.fn(async () => {}) }));
vi.mock('../src/shared/logging/logger.js', () => ({ logger: { error: vi.fn() } }));

it('runs the next job after a failure and releases resources/listeners on shutdown', async () => {
  const listeners = {
    interrupt: process.listenerCount('SIGINT'),
    terminate: process.listenerCount('SIGTERM'),
  };
  const failing = vi.fn(async (): Promise<boolean> => {
    throw new Error('Private fixture error');
  });
  const dispatch = vi.fn(async () => {
    process.emit('SIGTERM');
    return false;
  });
  await runWorker(
    [
      { run: failing, failureCode: 'RETENTION_FAILED', failureMessage: 'Retention will retry.' },
      { run: dispatch, failureCode: 'DISPATCH_FAILED', failureMessage: 'Dispatch will retry.' },
    ],
    3000,
  );
  expect(dispatch).toHaveBeenCalledOnce();
  expect(logger.error).toHaveBeenCalledExactlyOnceWith(
    { code: 'RETENTION_FAILED' },
    'Retention will retry.',
  );
  expect(pool.end).toHaveBeenCalledOnce();
  expect(closeRedis).toHaveBeenCalledOnce();
  expect(process.listenerCount('SIGINT')).toBe(listeners.interrupt);
  expect(process.listenerCount('SIGTERM')).toBe(listeners.terminate);
});
