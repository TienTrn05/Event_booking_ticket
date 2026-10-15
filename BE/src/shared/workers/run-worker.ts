import { setTimeout } from 'node:timers/promises';
import { pool } from '../database/pool.js';
import { logger } from '../logging/logger.js';
import { closeRedis } from '../redis/client.js';
import { env } from '../../config/env.js';
import { WorkerHealthStore, type WorkerName, type WorkerHealth } from './worker-health.js';

export type WorkerJob = {
  run: () => Promise<boolean>;
  failureCode: string;
  failureMessage: string;
};

/** Each job owns its transaction and retry policy; the runner owns only lifecycle. */
export async function runWorker(
  jobs: WorkerJob[],
  idleMs: number,
  name?: WorkerName,
  health = new WorkerHealthStore(),
) {
  const state: WorkerHealth = {
    name: name ?? 'bookings',
    pid: process.pid,
    updatedAt: Date.now(),
    state: 'running',
    activeJob: null,
    activeSince: null,
    jobs: Object.fromEntries(
      jobs.map((job) => [job.failureCode, { failures: 0, lastSuccessAt: null }]),
    ),
  };
  let writing = Promise.resolve();
  const publish = () => {
    if (!name) return;
    state.updatedAt = Date.now();
    const snapshot = structuredClone(state);
    writing = writing
      .then(() => health.write(snapshot))
      .catch(() => {
        logger.error({ code: 'WORKER_HEARTBEAT_FAILED' }, 'Worker heartbeat could not be written.');
      });
  };
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  const onMessage = (message: unknown) => {
    if (message === 'shutdown') stop();
  };
  process.on('message', onMessage);
  publish();
  const heartbeat = name ? setInterval(publish, 5000) : undefined;
  heartbeat?.unref();
  try {
    while (!controller.signal.aborted) {
      let busy = false;
      for (const job of jobs) {
        if (controller.signal.aborted) break;
        state.state = 'running';
        state.activeJob = job.failureCode;
        state.activeSince = Date.now();
        publish();
        try {
          const hasMore = await job.run();
          busy = busy || hasMore;
          state.jobs[job.failureCode]!.failures = 0;
          state.jobs[job.failureCode]!.lastSuccessAt = Date.now();
        } catch {
          state.jobs[job.failureCode]!.failures++;
          logger.error({ code: job.failureCode }, job.failureMessage);
        }
        state.activeJob = null;
        state.activeSince = null;
        publish();
      }
      if (busy) continue;
      state.state = 'idle';
      publish();
      try {
        await setTimeout(idleMs, undefined, { signal: controller.signal });
      } catch {
        break;
      }
    }
  } finally {
    if (heartbeat) clearInterval(heartbeat);
    state.state = 'stopped';
    state.activeJob = null;
    state.activeSince = null;
    publish();
    await writing;
    process.removeListener('message', onMessage);
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await Promise.all([pool.end(), closeRedis()]);
    if (env.SUPERVISED_PROCESS === 'true' && process.connected) process.disconnect();
  }
}
