import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { usersRepository } from '../repositories/users.repository.js';
import { followsRepository } from '../../notifications/repositories/follows.repository.js';
import { OrganizerBlockRepository } from './organizer-block.repository.js';
export class OrganizerBlockService {
  constructor(private readonly repository = new OrganizerBlockRepository()) {}
  async change(actor: RequestActor, id: string, blocked: boolean) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      await usersRepository.requireOnboarding(db, actor.id);
      await followsRepository.requireCustomer(db, actor.id);
      const organizationId = await followsRepository.organization(db, id, blocked);
      return this.repository.change(db, actor.id, organizationId, blocked);
    });
  }
  async list(actor: RequestActor, page: number, pageSize: number) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      await followsRepository.requireCustomer(db, actor.id);
      const result = await this.repository.list(db, actor.id, page, pageSize);
      return {
        ...result,
        pagination: {
          page,
          pageSize,
          total: result.total,
          totalPages: Math.ceil(result.total / pageSize),
        },
      };
    });
  }
}
