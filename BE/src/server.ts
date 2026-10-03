import { createApp } from './app.js';

import { env } from './config/env.js';

import { dependencies } from './Bootstrap/dependencies.js';
import { registerShutdown } from './Bootstrap/shutdown.js';

import { logger } from './shared/logging/logger.js';

const app = createApp(dependencies);

const server = app.listen(
  env.PORT,
  env.HOST,
  () => {
    logger.info(
      {
        host: env.HOST,
        port: env.PORT,
      },
      'API listening',
    );
  },
);

registerShutdown(server);