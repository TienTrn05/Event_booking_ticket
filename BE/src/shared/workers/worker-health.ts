import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { env } from '../../config/env.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
export const workerNames = ['bookings', 'notifications'] as const;
export type WorkerName = (typeof workerNames)[number];
const healthSchema = z
  .object({
    name: z.enum(workerNames),
    pid: z.number().int().positive(),
    updatedAt: z.number(),
    state: z.enum(['running', 'idle', 'stopped']),
    activeJob: z.string().nullable(),
    activeSince: z.number().nullable(),
    jobs: z.record(
      z.string(),
      z.object({ failures: z.number().int().min(0), lastSuccessAt: z.number().nullable() }),
    ),
  })
  .strict();
export type WorkerHealth = z.infer<typeof healthSchema>;
export const workerHealthDirectory = env.WORKER_HEALTH_DIRECTORY
  ? resolve(fileURLToPath(new URL('../../../', import.meta.url)), env.WORKER_HEALTH_DIRECTORY)
  : fileURLToPath(new URL('../../../.local/worker-health/', import.meta.url));
export class WorkerHealthStore {
  constructor(private readonly directory = workerHealthDirectory) {}
  async write(state: WorkerHealth) {
    await mkdir(this.directory, { recursive: true });
    const target = join(this.directory, state.name + '.json'),
      temporary = target + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, target);
    } finally {
      await unlink(temporary).catch(() => {});
    }
  }
  async read(name: WorkerName, staleSeconds: number, jobTimeoutSeconds: number, now = Date.now()) {
    try {
      const state = healthSchema.parse(
        JSON.parse(await readFile(join(this.directory, name + '.json'), 'utf8')),
      );
      let alive = false;
      try {
        process.kill(state.pid, 0);
        alive = true;
      } catch {
        /* Same-host process is absent or inaccessible. */
      }
      const healthy =
        alive &&
        state.name === name &&
        state.updatedAt <= now + 5000 &&
        now - state.updatedAt < staleSeconds * 1000 &&
        state.state !== 'stopped' &&
        !(state.activeSince !== null && now - state.activeSince > jobTimeoutSeconds * 1000) &&
        Object.values(state.jobs).every((job) => job.failures < 3);
      return { name, healthy, state };
    } catch {
      return { name, healthy: false, state: null };
    }
  }
}
