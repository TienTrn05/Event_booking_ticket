import { env } from '../../config/env.js';
import { ElasticsearchClient } from '../../modules/search/search.client.js';
import { redisCommand } from '../redis/client.js';
import { WorkerHealthStore, workerNames, type WorkerName } from './worker-health.js';
type Settings = Pick<
  typeof env,
  | 'REDIS_URL'
  | 'APP_ENV'
  | 'READINESS_REQUIRE_WORKERS'
  | 'WORKER_STALE_SECONDS'
  | 'WORKER_JOB_TIMEOUT_SECONDS'
  | 'PAYOS_CLIENT_ID'
  | 'ELASTICSEARCH_URL'
>;
export interface RuntimeProbes {
  search?: () => Promise<void>;
  redis: () => Promise<string>;
  worker: (name: WorkerName) => Promise<boolean>;
}
export async function checkRuntimeReadiness(probes?: RuntimeProbes, settings: Settings = env) {
  const store = new WorkerHealthStore();
  const checks = probes ?? {
    redis: async () => String(await redisCommand(['PING'])),
    worker: async (name: WorkerName) =>
      (await store.read(name, settings.WORKER_STALE_SECONDS, settings.WORKER_JOB_TIMEOUT_SECONDS))
        .healthy,
  };
  if ((settings.PAYOS_CLIENT_ID || settings.APP_ENV === 'production') && !settings.REDIS_URL)
    throw new Error('Commerce Redis not configured');
  if (settings.REDIS_URL && (await checks.redis()) !== 'PONG') throw new Error('Redis not ready');
  if (settings.ELASTICSEARCH_URL)
    await (probes?.search ?? (() => new ElasticsearchClient().ready()))();
  const requireWorkers =
    settings.READINESS_REQUIRE_WORKERS === 'true' ||
    (settings.READINESS_REQUIRE_WORKERS !== 'false' &&
      ['staging', 'production'].includes(settings.APP_ENV));
  if (requireWorkers) {
    for (const name of workerNames) {
      if (!(await checks.worker(name))) throw new Error('Worker not ready');
    }
  }
}
