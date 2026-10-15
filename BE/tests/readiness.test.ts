import { expect, it, vi } from 'vitest';
import { checkRuntimeReadiness, type RuntimeProbes } from '../src/shared/workers/readiness.js';
import { env } from '../src/config/env.js';
it('gates configured Redis and required workers while allowing a local catalog-only profile', async () => {
  const probes: RuntimeProbes = {
    redis: vi.fn(async () => 'PONG'),
    worker: vi.fn(async () => true),
  };
  const production = {
    ...env,
    APP_ENV: 'production' as const,
    REDIS_URL: 'redis://127.0.0.1:6379',
    READINESS_REQUIRE_WORKERS: undefined,
  };
  await checkRuntimeReadiness(probes, production);
  await expect(
    checkRuntimeReadiness(
      { ...probes, worker: async (name) => name !== 'notifications' },
      production,
    ),
  ).rejects.toThrow('Worker not ready');
  await expect(
    checkRuntimeReadiness({ ...probes, redis: async () => 'FAIL' }, production),
  ).rejects.toThrow('Redis not ready');
  await expect(
    checkRuntimeReadiness(probes, { ...production, REDIS_URL: undefined }),
  ).rejects.toThrow('Commerce Redis not configured');
  await checkRuntimeReadiness(probes, {
    ...env,
    APP_ENV: 'development',
    REDIS_URL: undefined,
    READINESS_REQUIRE_WORKERS: 'false',
  });
});
it('uses the same configured search probe for API and Admin runtime readiness', async () => {
  const probes = {
    redis: async () => 'PONG',
    worker: async () => true,
    search: async () => {
      throw new Error('Search offline');
    },
  };
  await expect(
    checkRuntimeReadiness(probes, { ...env, ELASTICSEARCH_URL: 'http://127.0.0.1:9200' }),
  ).rejects.toThrow('Search offline');
  await checkRuntimeReadiness(
    { ...probes, search: async () => {} },
    { ...env, ELASTICSEARCH_URL: 'http://127.0.0.1:9200' },
  );
});
