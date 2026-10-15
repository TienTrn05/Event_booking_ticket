import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { describe, it, expect } from 'vitest';
import { ProcessSupervisor } from '../src/shared/workers/process-supervisor.js';
import { WorkerHealthStore } from '../src/shared/workers/worker-health.js';
describe.skipIf(!process.env.COMMERCE_TEST_DB_PORT)('single-host supervised monolith', () => {
  it('marks a dead worker unready, restarts it once and restores readiness without another API instance', async () => {
    const root = fileURLToPath(new URL('../', import.meta.url)),
      directory = await mkdtemp(join(root, 'tmp', 'supervisor-'));
    const listener = createServer();
    await new Promise<void>((done) => listener.listen(0, '127.0.0.1', done));
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>((done) => listener.close(() => done()));
    const reports: string[] = [];
    const supervisor = new ProcessSupervisor(
      [
        { name: 'api', args: [join(root, 'dist', 'server.js')] },
        { name: 'bookings', args: [join(root, 'dist', 'scripts', 'booking-worker.js')] },
        { name: 'notifications', args: [join(root, 'dist', 'scripts', 'notification-worker.js')] },
      ],
      root,
      (name, code) => reports.push(name + ':' + code),
      500,
      {
        ...process.env,
        PORT: String(port),
        HOST: '127.0.0.1',
        READINESS_REQUIRE_WORKERS: 'true',
        WORKER_HEALTH_DIRECTORY: directory,
      },
    );
    const store = new WorkerHealthStore(directory),
      url = `http://127.0.0.1:${port}/api/v1/health/ready`;
    const until = async (check: () => Promise<boolean>) => {
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        if (await check()) return;
        await new Promise((done) => setTimeout(done, 50));
      }
      throw new Error('Supervised fixture did not reach the expected state');
    };
    supervisor.start();
    try {
      await until(async () => {
        try {
          return (await fetch(url)).status === 200;
        } catch {
          return false;
        }
      });
      const worker = (await store.read('bookings', 60, 120)).state!;
      expect(worker).toBeDefined();
      process.kill(worker.pid, 'SIGTERM');
      await until(async () => !(await store.read('bookings', 60, 120)).healthy);
      expect((await fetch(url)).status).toBe(503);
      await until(async () => {
        const current = await store.read('bookings', 60, 120);
        return (
          current.healthy && current.state?.pid !== worker.pid && (await fetch(url)).status === 200
        );
      });
      expect(reports.filter((code) => code === 'bookings:PROCESS_RESTARTING')).toHaveLength(1);
      expect(reports.filter((code) => code.startsWith('api:'))).toEqual([]);
    } finally {
      await supervisor.stop();
      if (directory.startsWith(join(root, 'tmp', 'supervisor-')))
        await rm(directory, { recursive: true, force: true });
    }
  }, 30000);
});
