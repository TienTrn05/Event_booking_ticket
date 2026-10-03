import type { Express } from 'express';

import {
  rateLimit,
} from 'express-rate-limit';

export function registerRateLimit(
  app: Express,
) {
  app.use(
    '/api',

    rateLimit({
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
            requestId:
              res.locals.requestId,
          },
        });
      },
    }),
  );
}