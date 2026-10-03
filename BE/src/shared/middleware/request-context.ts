import { randomUUID } from 'node:crypto';

import type { Express } from 'express';

export interface RequestLogFields {
  requestId: string;
  method: string;
  statusCode: number;
}

type LogRequest = (
  fields: RequestLogFields,
) => void;

export function registerRequestContext(
  app: Express,
  logRequest?: LogRequest,
) {
  app.use((req, res, next) => {
    const requestId = randomUUID();

    res.locals.requestId = requestId;

    res.setHeader(
      'X-Request-Id',
      requestId,
    );

    res.setHeader(
      'Cache-Control',
      'no-store',
    );

    res.on('finish', () => {
      logRequest?.({
        requestId,
        method: req.method,
        statusCode: res.statusCode,
      });
    });

    next();
  });
}