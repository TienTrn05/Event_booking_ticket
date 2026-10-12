import type { RequestActor } from '../../../shared/auth/request-actor.js';
import { withTransaction } from '../../../shared/database/transaction.js';
import { usersRepository } from '../repositories/users.repository.js';
import { claimKey, finishKey } from '../../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../../shared/errors/app-error.js';
import { followsRepository } from '../../notifications/repositories/follows.repository.js';
import { OnboardingRepository } from './onboarding.repository.js';
import type { OnboardingInput, PreferencesInput } from './onboarding.schema.js';
import { QuestionnaireRepository } from './questions/questionnaire.repository.js';
import { validateAnswers } from './questions/questionnaire.policy.js';
import type { Answers } from './questions/questionnaire.schema.js';
export class OnboardingService {
  constructor(
    private readonly repository = new OnboardingRepository(),
    private readonly questionnaires = new QuestionnaireRepository(),
  ) {}
  async state(actor: RequestActor) {
    return withTransaction(async (db) => {
      const profile = await usersRepository.profile(db, actor);
      const state = await this.repository.state(db, actor.id);
      const assigned = await this.questionnaires.assigned(db, actor.id);
      return {
        profile,
        ...state,
        completed: !!state.completedAt,
        roles: await this.repository.roles(db, actor.id),
        followedOrganizers: await this.repository.followedIds(db, actor.id),
        questionnaire: assigned.questionnaire
          ? { id: assigned.questionnaire.id, questions: assigned.questionnaire.questions }
          : null,
        answers: assigned.answers,
      };
    });
  }
  async options(actor: RequestActor) {
    return withTransaction(async (db) => {
      await usersRepository.profile(db, actor);
      const questionnaire = await this.questionnaires.get(db);
      return {
        ...(await this.repository.options(db)),
        questionnaire: { id: questionnaire.id, questions: questionnaire.questions },
      };
    });
  }
  async complete(actor: RequestActor, input: OnboardingInput, key: string, requestId: string) {
    await withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const record = await claimKey(db, actor.id, 'user.onboarding', key, input);
      if (record.resource_id) return;
      const state = await this.repository.state(db, actor.id);
      if (state.completedAt)
        throw new AppError(
          409,
          'ONBOARDING_COMPLETE',
          'Hồ sơ đã hoàn tất. Hãy dùng chức năng sửa hồ sơ/sở thích.',
        );
      const questionnaire = await this.questionnaires.get(db, undefined, 'share');
      if (
        input.questionnaireId !== questionnaire.id &&
        !(input.questionnaireId === undefined && questionnaire.createdBy === null)
      )
        throw new AppError(
          409,
          'ONBOARDING_QUESTIONNAIRE_CHANGED',
          'Bộ câu hỏi vừa thay đổi. Hãy tải lại.',
        );
      validateAnswers(questionnaire.questions, input.answers, input);
      if (input.dateOfBirth > (await usersRepository.today(db)))
        throw new AppError(400, 'INVALID_DATE_OF_BIRTH', 'Ngày sinh không được ở tương lai.');
      await this.repository.validatePreferences(db, input);
      const organizations: string[] = [];
      for (const id of [...input.followedOrganizers].sort())
        organizations.push(await followsRepository.organization(db, id));
      await this.repository.complete(db, actor.id, input);
      await this.questionnaires.save(db, actor.id, questionnaire.id, input.answers);
      for (const id of organizations)
        await followsRepository.follow(db, actor.id, id, input.role === 'CUSTOMER');
      await this.repository.audit(db, actor.id, requestId, 'user.onboarding.complete');
      await finishKey(db, record.id, 'USER', actor.id, 200);
    });
    return this.state(actor);
  }
  async preferences(actor: RequestActor, input: PreferencesInput, requestId: string) {
    await withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      if (!(await this.repository.state(db, actor.id)).completedAt)
        throw new AppError(409, 'ONBOARDING_REQUIRED', 'Cần hoàn tất hồ sơ trước.');
      await this.repository.validatePreferences(db, input);
      await this.repository.savePreferences(db, actor.id, input);
      await this.repository.audit(db, actor.id, requestId, 'user.preferences.update');
    });
    return this.state(actor);
  }
  async answers(actor: RequestActor, answers: Answers, requestId: string) {
    await withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      await usersRepository.requireOnboarding(db, actor.id);
      const assigned = await this.questionnaires.assigned(db, actor.id),
        questionnaire = assigned.questionnaire!;
      validateAnswers(questionnaire.questions, answers);
      await this.questionnaires.save(db, actor.id, questionnaire.id, answers);
      await this.repository.audit(db, actor.id, requestId, 'user.onboarding.answers.update');
    });
    return this.state(actor);
  }
  async customer(actor: RequestActor, key: string, requestId: string) {
    await withTransaction(async (db) => {
      await usersRepository.profile(db, actor, true);
      const state = await this.repository.state(db, actor.id),
        roles = await this.repository.roles(db, actor.id);
      if (!state.completedAt || !roles.includes('ORGANIZER'))
        throw new AppError(403, 'FORBIDDEN', 'Chức năng dành cho Organizer đã hoàn tất hồ sơ.');
      const record = await claimKey(db, actor.id, 'user.activate_customer', key, {});
      if (record.resource_id) return;
      await this.repository.activateCustomer(db, actor.id);
      await this.repository.audit(db, actor.id, requestId, 'user.customer.activate');
      await finishKey(db, record.id, 'USER', actor.id, 200);
    });
    return this.state(actor);
  }
}
