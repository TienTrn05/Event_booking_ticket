import type { Server } from 'node:http';

import { pool } from '../shared/database/pool.js';
import { closePrisma } from '../shared/database/prisma.js';
import { logger } from '../shared/logging/logger.js';
import { closeRedis } from '../shared/redis/client.js';
import { env } from '../config/env.js';

export function registerShutdown(server: Server) {
  let stopping = false;

  function shutdown(exitCode = 0) {
    if (stopping) {
      return;
    }

    stopping = true;

    logger.info('Stopping API');

    const deadline = setTimeout(() => {
      logger.error('Graceful shutdown timed out');

      process.exit(1);
    }, 10_000);

    deadline.unref();

    server.close(() => {
      void Promise.all([closePrisma().then(() => pool.end()), closeRedis()])
        .then(() => {
          clearTimeout(deadline);

          logger.info('API stopped');

          process.exitCode = exitCode;
          if (env.SUPERVISED_PROCESS === 'true' && process.connected) process.disconnect();
        })
        .catch((error: unknown) => {
          logger.error({ error }, 'Database shutdown failed');

          process.exit(1);
        });
    });

    server.closeIdleConnections();
  }

  server.on('error', (error) => {
    logger.error({ error }, 'API could not start; check host/port availability');

    shutdown(1);
  });

  process.on('SIGINT', () => {
    shutdown();
  });

  process.on('SIGTERM', () => {
    shutdown();
  });
  process.on('message', (message: unknown) => {
    if (message === 'shutdown') shutdown();
  });

  process.on('uncaughtException', (error) => {
    logger.fatal({ error }, 'Uncaught exception; shutting down');

    shutdown(1);
  });

  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection; shutting down');

    shutdown(1);
  });
}
