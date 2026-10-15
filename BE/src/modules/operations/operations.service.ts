import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { checkDatabase } from '../../shared/database/pool.js';
import { checkRuntimeReadiness } from '../../shared/workers/readiness.js';
import { WorkerHealthStore, workerNames } from '../../shared/workers/worker-health.js';
import { env } from '../../config/env.js';
import { OperationsRepository } from './operations.repository.js';
export class OperationsService {
  constructor(
    private readonly repository = new OperationsRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  async health(actor: RequestActor) {
    const backlog = await withTransaction(async (db) => {
      await this.access.permission(db, actor, 'statistics.read_system');
      return this.repository.backlog(db);
    });
    let ready = true;
    try {
      await checkDatabase();
      await checkRuntimeReadiness();
    } catch {
      ready = false;
    }
    const store = new WorkerHealthStore(),
      workers = await Promise.all(
        workerNames.map((name) =>
          store.read(name, env.WORKER_STALE_SECONDS, env.WORKER_JOB_TIMEOUT_SECONDS),
        ),
      );
    return { ready, workers, backlog };
  }
}
