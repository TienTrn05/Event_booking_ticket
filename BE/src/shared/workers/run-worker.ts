import { setTimeout } from 'node:timers/promises';
import { pool } from '../database/pool.js';
import { logger } from '../logging/logger.js';
import { closeRedis } from '../redis/client.js';

export type WorkerJob = {
  run: () => Promise<boolean>;
  failureCode: string;
  failureMessage: string;
};

/** Each job owns its transaction and retry policy; the runner owns only lifecycle. */
export async function runWorker(jobs: WorkerJob[], idleMs: number) {
  const controller = new AbortController();
  const stop = () => controller.abort();
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    while (!controller.signal.aborted) {
      let busy = false;
      for (const job of jobs) {
        if (controller.signal.aborted) break;
        try {
          const hasMore = await job.run();
          busy = busy || hasMore;
        } catch {
          logger.error({ code: job.failureCode }, job.failureMessage);
        }
      }
      if (busy) continue;
      try {
        await setTimeout(idleMs, undefined, { signal: controller.signal });
      } catch {
        break;
      }
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    await Promise.all([pool.end(), closeRedis()]);
  }
}
