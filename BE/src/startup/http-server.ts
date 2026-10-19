import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import type { Express } from 'express';
export function createHttpServer(app: Express, tls?: { certFile: string; keyFile: string }) {
  return tls
    ? httpsServer(
        { cert: readFileSync(tls.certFile), key: readFileSync(tls.keyFile), minVersion: 'TLSv1.2' },
        app,
      )
    : httpServer(app);
}
