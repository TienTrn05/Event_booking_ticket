import type { RequestActor } from '../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../shared/database/transaction.js';
import { AuditRepository } from './audit.repository.js';
import type { AuditQuery } from './audit.schema.js';
export class AuditService {
  constructor(
    private readonly repository = new AuditRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  async list(actor: RequestActor, q: AuditQuery) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'audit.read');
      const result = await this.repository.list(db, actor.id, q);
      return {
        ...result,
        pagination: {
          page: q.page,
          pageSize: q.pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / q.pageSize),
        },
      };
    });
  }
}
