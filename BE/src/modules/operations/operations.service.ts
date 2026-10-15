import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import type { RequestActor } from '../../shared/auth/request-actor.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { checkDatabase } from '../../shared/database/pool.js';
import { checkRuntimeReadiness } from '../../shared/workers/readiness.js';
import { WorkerHealthStore, workerNames } from '../../shared/workers/worker-health.js';
import { env } from '../../config/env.js';
import { OperationsRepository } from './operations.repository.js';
import type { StatisticsQuery } from './operations.schema.js';
import { AppError } from '../../shared/errors/app-error.js';
import { MerchandiseRepository } from '../merchandise/merchandise.repository.js';
export class OperationsService {
  constructor(
    private readonly repository = new OperationsRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  async statistics(actor: RequestActor, q: StatisticsQuery) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'statistics.read_system');
      if (!(await this.repository.adminRole(db, actor.id)))
        throw new AppError(403, 'FORBIDDEN', 'Cần vai trò Admin.');
      return {
        basis: 'ENTITY_CREATED_COHORT',
        range: { from: q.from ?? null, to: q.to ?? null },
        ...(await this.repository.statistics(db, q)),
        merchandise: await new MerchandiseRepository().overview(db, null, q.from, q.to),
      };
    });
  }
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
