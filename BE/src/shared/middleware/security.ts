import type { Express } from 'express';

import helmet from 'helmet';

export function registerSecurityMiddleware(
  app: Express,
) {
  app.disable('x-powered-by');

  app.set(
    'trust proxy',
    false,
  );

  app.use(
    helmet(),
  );
}