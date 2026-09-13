import { createApp } from './app.js';
import { env } from './config/env.js';
import { pool, checkDatabase } from './shared/database/pool.js';
import { logger } from './shared/logging/logger.js';

const app = createApp({
  checkDatabase,
  logRequest: (fields) => logger.info(fields, 'request completed'),
});
const server = app.listen(env.PORT, env.HOST, () =>
  logger.info({ port: env.PORT }, 'API listening'),
);
let stopping = false;
function shutdown(exitCode = 0) {
  if (stopping) return;
  stopping = true;
  logger.info('Stopping API');
  const deadline = setTimeout(() => process.exit(1), 10_000);
  deadline.unref();
  server.close(() => {
    void pool
      .end()
      .then(() => {
        clearTimeout(deadline);
        process.exitCode = exitCode;
      })
      .catch(() => {
        logger.error('Database shutdown failed');
        process.exit(1);
      });
  });
  server.closeIdleConnections();
}
server.on('error', () => {
  logger.error('API could not start; check host/port availability');
  shutdown(1);
});
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
process.on('uncaughtException', () => {
  logger.fatal('Uncaught exception; shutting down');
  shutdown(1);
});
process.on('unhandledRejection', () => {
  logger.fatal('Unhandled rejection; shutting down');
  shutdown(1);
});
