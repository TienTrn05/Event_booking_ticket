import type { Express, RequestHandler } from 'express';

import swaggerUi from 'swagger-ui-express';

import { openApiDocument } from '../../openapi.js';

const redirectSwagger: RequestHandler = (req, res, next) => {
  const path = req.originalUrl.split('?')[0];

  if (path === '/api/docs') {
    res.redirect(308, '/api/docs/');

    return;
  }

  next();
};

export function registerSwagger(app: Express) {
  app.get('/api/v1/openapi.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.use(
    '/api/docs',

    redirectSwagger,

    swaggerUi.serve,

    swaggerUi.setup(openApiDocument, {
      customSiteTitle: 'Event Ticketing API',

      swaggerOptions: {
        displayRequestDuration: true,
        tryItOutEnabled: true,
      },
    }),
  );
}
