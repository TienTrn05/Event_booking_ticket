import express from 'express';

import { registerSecurityMiddleware } from './shared/middleware/security.js';
import { registerRequestContext } from './shared/middleware/request-context.js';
import { registerRateLimit } from './shared/middleware/rate-limit.js';

import { registerSystemRoutes } from './shared/http/system.routes.js';
import { registerSwagger } from './shared/http/swagger.js';

import { registerModules, type ModuleDependencies } from './modules/index.js';

import { AppError } from './shared/errors/app-error.js';
import { errorHandler } from './shared/middleware/error-handler.js';

export interface AppDependencies extends ModuleDependencies {
  checkDatabase: () => Promise<void>;

  logRequest?: (fields: { requestId: string; method: string; statusCode: number }) => void;
}

export function createApp(deps: AppDependencies) {
  const app = express();

  registerSecurityMiddleware(app);
  registerRequestContext(app, deps.logRequest);
  registerRateLimit(app);

  app.use(express.json({ limit: '32kb' }));

  registerSystemRoutes(app, {
    checkDatabase: deps.checkDatabase,
  });

  registerSwagger(app);

  registerModules(app, deps);

  app.use((_req, _res, next) => {
    next(new AppError(404, 'NOT_FOUND', 'Không tìm thấy tài nguyên.'));
  });

  app.use(errorHandler);

  return app;
}
