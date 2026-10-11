import type { Express } from 'express';

import { rateLimit } from 'express-rate-limit';
import { sharedRateStore } from '../redis/rate-store.js';

export function registerRateLimit(app: Express) {
  app.use(
    '/api',

    rateLimit({
      ...sharedRateStore('global', true),
      skip: (req) =>
        req.path.startsWith('/v1/health/') || req.path === '/v1/payments/webhooks/payos',
      windowMs: 60_000,

      limit: 120,

      standardHeaders: 'draft-8',

      legacyHeaders: false,

      handler: (_req, res) => {
        res.status(429).json({
          error: {
            code: 'RATE_LIMITED',
            message: 'Vui lòng thử lại sau.',
          },

          meta: {
            requestId: res.locals.requestId,
          },
        });
      },
    }),
  );
}
