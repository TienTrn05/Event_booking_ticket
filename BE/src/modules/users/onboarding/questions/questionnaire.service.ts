import type { RequestActor } from '../../../../shared/auth/request-actor.js';
import { ManagementAccessRepository } from '../../../../shared/auth/management-access.repository.js';
import { withTransaction } from '../../../../shared/database/transaction.js';
import { claimKey, finishKey } from '../../../../shared/idempotency/idempotency.repository.js';
import { AppError } from '../../../../shared/errors/app-error.js';
import { QuestionnaireRepository } from './questionnaire.repository.js';
import type { Question } from './questionnaire.schema.js';
export class QuestionnaireService {
  constructor(
    private readonly repository = new QuestionnaireRepository(),
    private readonly access = new ManagementAccessRepository(),
  ) {}
  async get(actor: RequestActor) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'onboarding.manage');
      return this.repository.get(db);
    });
  }
  async publish(
    actor: RequestActor,
    input: { questionnaireId: string; questions: Question[] },
    key: string,
    requestId: string,
  ) {
    return withTransaction(async (db) => {
      await this.access.permission(db, actor, 'onboarding.manage');
      const record = await claimKey(db, actor.id, 'onboarding.questions.publish', key, input);
      if (record.resource_id) return this.repository.get(db, record.resource_id);
      const current = await this.repository.get(db, undefined, 'update');
      if (current.id !== input.questionnaireId)
        throw new AppError(
          409,
          'ONBOARDING_QUESTIONNAIRE_CHANGED',
          'Bộ câu hỏi vừa thay đổi. Hãy tải lại trước khi lưu.',
        );
      if (JSON.stringify(current.questions) === JSON.stringify(input.questions)) {
        await finishKey(db, record.id, 'QUESTIONNAIRE', current.id, 200);
        return current;
      }
      const id = await this.repository.publish(
        db,
        actor.id,
        current.id,
        input.questions.map((question) => ({ ...question, required: true })),
      );
      await this.repository.audit(db, actor.id, id, requestId);
      await finishKey(db, record.id, 'QUESTIONNAIRE', id, 200);
      return this.repository.get(db, id);
    });
  }
}
