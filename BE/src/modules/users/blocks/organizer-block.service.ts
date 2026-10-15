import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withPrismaTransaction } from '../../../shared/database/prisma.js';
import { usersRepository } from '../repositories/users.repository.js';
import { followsRepository } from '../../notifications/repositories/follows.repository.js';
import { OrganizerBlockRepository } from './organizer-block.repository.js';
export class OrganizerBlockService {
  constructor(private readonly repository = new OrganizerBlockRepository()) {}
  async change(actor: RequestActor, id: string, blocked: boolean) {
    return withPrismaTransaction(async (db, sql) => {
      await usersRepository.profile(sql, actor, true);
      await usersRepository.requireOnboarding(sql, actor.id);
      await followsRepository.requireCustomer(sql, actor.id);
      const organizationId = await followsRepository.organization(sql, id, blocked);
      return this.repository.change(db, actor.id, organizationId, blocked);
    });
  }
  async list(actor: RequestActor, page: number, pageSize: number) {
    return withPrismaTransaction(async (db, sql) => {
      // Serialize preference writes while Prisma reads the page and its total.
      await usersRepository.profile(sql, actor, true);
      await followsRepository.requireCustomer(sql, actor.id);
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
