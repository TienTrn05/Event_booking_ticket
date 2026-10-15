import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
const root = fileURLToPath(new URL('../', import.meta.url));
if (!existsSync(join(root, 'dist', 'server.js'))) throw new Error('Run npm run build first.');
const { ProcessSupervisor } = await import('../dist/shared/workers/process-supervisor.js');
const supervisor = new ProcessSupervisor(
  [
    { name: 'api', args: [join(root, 'dist', 'server.js')] },
    { name: 'bookings', args: [join(root, 'dist', 'scripts', 'booking-worker.js')] },
    { name: 'notifications', args: [join(root, 'dist', 'scripts', 'notification-worker.js')] },
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
