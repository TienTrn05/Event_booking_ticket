import express from 'express';

import { registerRateLimit } from './shared/middleware/rate-limit.js';
import { registerRequestContext } from './shared/middleware/request-context.js';
import { registerSecurityMiddleware } from './shared/middleware/security.js';

import { registerSwagger } from './shared/http/swagger.js';
import { registerSystemRoutes } from './shared/http/system.routes.js';

import { registerModules, type ModuleDependencies } from './modules/index.js';

import { errorHandler } from './shared/middleware/error-handler.js';
import { requireJsonRequest } from './shared/middleware/json-request.js';
import { notFoundHandler } from './shared/middleware/not-found.js';

export interface AppDependencies extends ModuleDependencies {
  checkDatabase: () => Promise<void>;

  logRequest?: (fields: { requestId: string; method: string; statusCode: number }) => void;
}

export function createApp(deps: AppDependencies) {
  const app = express();

  registerSecurityMiddleware(app);
  registerRequestContext(app, deps.logRequest);
  registerRateLimit(app);

  app.use('/api/v1', requireJsonRequest);
  app.use('/api/v1/admin/onboarding/questions', express.json({ limit: '256kb' }));
  app.use('/api/v1/organizer/events/:id/layouts', express.json({ limit: '1mb' }));
  app.use(
    '/api/v1/organizer/events/:id/sessions/:sessionId/prices',
    express.json({ limit: '1mb' }),
  );
  app.use(express.json({ limit: '32kb' }));

  registerSystemRoutes(app, {
    checkDatabase: deps.checkDatabase,
  });

  registerSwagger(app);

  registerModules(app, deps);

  app.use(notFoundHandler);

  app.use(errorHandler);

  return app;
}
