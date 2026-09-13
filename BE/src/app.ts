import { randomUUID } from 'node:crypto';
import express from 'express';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { errorHandler } from './shared/middleware/error-handler.js';
import { AppError } from './shared/errors/app-error.js';

interface AppDependencies {
  checkDatabase: () => Promise<void>;
  logRequest?: (fields: { requestId: string; method: string; statusCode: number }) => void;
}
export function createApp(deps: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', false);
  app.use(helmet());
  app.use((req, res, next) => {
    // Generate locally instead of accepting untrusted IDs into logs.
    const requestId = randomUUID();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);
    res.setHeader('Cache-Control', 'no-store');
    res.on('finish', () =>
      deps.logRequest?.({ requestId, method: req.method, statusCode: res.statusCode }),
    );
    next();
  });
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 120,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      handler: (_req, res) =>
        res.status(429).json({
          error: { code: 'RATE_LIMITED', message: 'Vui lòng thử lại sau.' },
          meta: { requestId: res.locals.requestId },
        }),
    }),
  );
  app.use(express.json({ limit: '32kb' }));
  app.get('/api/v1/health/live', (_req, res) => {
    res.json({ data: { status: 'ok' }, meta: { requestId: res.locals.requestId } });
  });
  app.get('/api/v1/health/ready', async (_req, res) => {
    try {
      await deps.checkDatabase();
    } catch {
      throw new AppError(503, 'SERVICE_UNAVAILABLE', 'Dịch vụ chưa sẵn sàng.');
    }
    res.json({ data: { status: 'ready' }, meta: { requestId: res.locals.requestId } });
  });
  app.use((_req, _res, next) => next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.')));
  app.use(errorHandler);
  return app;
}
