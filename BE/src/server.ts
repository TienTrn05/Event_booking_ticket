import { createApp } from './app.js';

import { env } from './config/env.js';

import { dependencies } from './startup/dependencies.js';
import { registerShutdown } from './startup/shutdown.js';

import { logger } from './shared/logging/logger.js';
import { createHttpServer } from './startup/http-server.js';

const app = createApp(dependencies);

const server = createHttpServer(
  app,
  env.HTTPS_CERT_FILE && env.HTTPS_KEY_FILE
    ? { certFile: env.HTTPS_CERT_FILE, keyFile: env.HTTPS_KEY_FILE }
    : undefined,
).listen(env.PORT, env.HOST, () => {
  logger.info(
    {
      host: env.HOST,
      port: env.PORT,
    },
    'API listening',
  );
});

registerShutdown(server);
