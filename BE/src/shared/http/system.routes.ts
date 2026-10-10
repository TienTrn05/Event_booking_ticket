import type { Express } from 'express';

import { AppError } from '../errors/app-error.js';

interface SystemDependencies {
  checkDatabase: () => Promise<void>;
}

export function registerSystemRoutes(app: Express, deps: SystemDependencies) {
  app.get('/api/v1/health/live', (_req, res) => {
    res.json({
      data: {
        status: 'ok',
      },
      meta: {
        requestId: res.locals.requestId,
      },
    });
  });

  app.get('/api/v1/health/ready', async (_req, res, next) => {
    try {
      await deps.checkDatabase();

      res.json({
        data: {
          status: 'ready',
        },
        meta: {
          requestId: res.locals.requestId,
        },
      });
    } catch {
      next(new AppError(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng.'));
    }
  });
}
