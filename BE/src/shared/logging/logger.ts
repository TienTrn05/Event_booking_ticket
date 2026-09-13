import pino from 'pino';
import { env } from '../../config/env.js';
export const logger = pino({
  level: env.LOG_LEVEL,
  base: null,
  redact: {
    paths: [
      'password',
      'token',
      'secret',
      'DB_PASSWORD',
      'req.headers.authorization',
      'req.headers.cookie',
      'res.headers["set-cookie"]',
    ],
    censor: '[REDACTED]',
  },
});
// Log only explicit safe fields. Never pass env, request bodies, URLs with queries,
// provider payloads or raw database Error objects (may contain SQL/credentials).
