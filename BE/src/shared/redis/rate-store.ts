import { MemoryStore, type Options, type Store } from 'express-rate-limit';
import { env } from '../../config/env.js';
import { redisCommand } from './client.js';

export function sharedRateStore(purpose: string, allowLocalFallback = false) {
  if (!env.REDIS_URL) return {};
  let windowMs = 60_000;
  const fallback = allowLocalFallback ? new MemoryStore() : undefined;
  const prefix = `${env.REDIS_PREFIX}:rate:${purpose}:`;
  const store: Store = {
    localKeys: false,
    init(options: Options) {
      windowMs = options.windowMs;
      fallback?.init(options);
    },
    async increment(key: string) {
      const local = fallback ? await fallback.increment(key) : undefined;
      let result;
      try {
        result = await redisCommand([
          'EVAL',
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return {n,redis.call('PTTL',KEYS[1])}",
          '1',
          prefix + key,
          String(windowMs),
        ]);
      } catch (error) {
        if (local) return local;
        throw error;
      }
      if (!Array.isArray(result) || typeof result[0] !== 'number' || typeof result[1] !== 'number')
        throw new Error('Invalid limiter response');
      return { totalHits: result[0], resetTime: new Date(Date.now() + result[1]) };
    },
    async decrement(key: string) {
      await fallback?.decrement(key);
      await redisCommand([
        'EVAL',
        "if tonumber(redis.call('GET',KEYS[1]) or '0')>0 then redis.call('DECR',KEYS[1]) end; return 1",
        '1',
        prefix + key,
      ]);
    },
    async resetKey(key: string) {
      await fallback?.resetKey(key);
      await redisCommand(['DEL', prefix + key]);
    },
  };
  return { store };
}
