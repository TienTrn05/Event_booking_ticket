import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { usersRepository } from '../../users/repositories/users.repository.js';
import { RecommendationRepository } from './recommendation.repository.js';
import { rankRecommendations } from './recommendation.policy.js';
export class RecommendationService {
  constructor(private readonly repository = new RecommendationRepository()) {}
  async list(actor: RequestActor, limit: number) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      await usersRepository.requireOnboarding(db, actor.id);
      const preferences = await this.repository.preferences(db, actor.id),
        candidates = await this.repository.candidates(db),
        now = await this.repository.now(db);
      return {
        algorithm: 'RULES_V1',
        items: rankRecommendations(candidates, preferences, now, limit).map(
          ({ event, score, reasons }) => {
            const dto = { ...event };
            Reflect.deleteProperty(dto, 'popularity');
            return { event: dto, score, reasons };
          },
        ),
      };
    });
  }
}
