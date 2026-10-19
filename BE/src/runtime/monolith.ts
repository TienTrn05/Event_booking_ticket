import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import '../config/env.js';
import { ProcessSupervisor } from '../shared/workers/process-supervisor.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const supervisor = new ProcessSupervisor(
  [
    { name: 'api', args: [join(root, 'dist', 'server.js')] },
    { name: 'bookings', args: [join(root, 'dist', 'runtime', 'booking-worker.js')] },
    { name: 'notifications', args: [join(root, 'dist', 'runtime', 'notification-worker.js')] },
  ],
  root,
  (name, code) => {
    console.error(JSON.stringify({ name, code }));
    if (code === 'RESTART_LIMIT_REACHED') process.exitCode = 1;
  },
  1000,
  { ...process.env, READINESS_REQUIRE_WORKERS: process.env.READINESS_REQUIRE_WORKERS ?? 'true' },
);
supervisor.start();
const stop = () => {
  void supervisor.stop();
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
