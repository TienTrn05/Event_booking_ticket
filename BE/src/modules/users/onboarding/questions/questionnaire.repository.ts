import type { PoolClient } from 'pg';
import { AppError } from '../../../../shared/errors/app-error.js';
import {
  questionsSchema,
  type Questionnaire,
  type Question,
  type Answers,
} from './questionnaire.schema.js';
export class QuestionnaireRepository {
  async get(
    db: PoolClient,
    id?: string,
    lock: 'none' | 'share' | 'update' = 'none',
  ): Promise<Questionnaire> {
    const row = (
      await db.query<Questionnaire>(
        `SELECT id::text,questions,created_at AS "createdAt",created_by::text AS "createdBy" FROM onboarding_questionnaires WHERE ${id ? 'id=$1' : "status='ACTIVE'"} ${lock === 'update' ? 'FOR UPDATE' : lock === 'share' ? 'FOR SHARE' : ''}`,
        id ? [id] : [],
      )
    ).rows[0];
    if (!row)
      throw new AppError(
        409,
        'ONBOARDING_QUESTIONNAIRE_CHANGED',
        'Bộ câu hỏi vừa thay đổi. Hãy tải lại.',
      );
    return { ...row, questions: questionsSchema.parse(row.questions) };
  }
  async assigned(db: PoolClient, userId: string) {
    const state = (
      await db.query<{ id: string | null; completed: boolean; answers: Answers }>(
        'SELECT onboarding_questionnaire_id::text AS id,onboarding_completed_at IS NOT NULL AS completed,onboarding_answers AS answers FROM users WHERE id=$1',
        [userId],
      )
    ).rows[0]!;
    return {
      ...state,
      questionnaire: state.completed ? await this.get(db, state.id ?? '1') : null,
    };
  }
  async save(db: PoolClient, userId: string, id: string, answers: Answers) {
    await db.query(
      'UPDATE users SET onboarding_questionnaire_id=$2,onboarding_answers=$3 WHERE id=$1',
      [userId, id, JSON.stringify(answers)],
    );
  }
  async publish(db: PoolClient, actorId: string, currentId: string, questions: Question[]) {
    await db.query(`UPDATE onboarding_questionnaires SET status='ARCHIVED' WHERE id=$1`, [
      currentId,
    ]);
    return (
      await db.query<{ id: string }>(
        `INSERT INTO onboarding_questionnaires(questions,created_by) VALUES($1,$2) RETURNING id::text`,
        [JSON.stringify(questions), actorId],
      )
    ).rows[0]!.id;
  }
  async audit(db: PoolClient, actorId: string, id: string, requestId: string) {
    await db.query(
      `INSERT INTO audit_logs(actor_type,actor_id,action,resource_type,resource_id,request_id) VALUES('USER',$1,'onboarding.questions.publish','QUESTIONNAIRE',$2,$3)`,
      [actorId, id, requestId],
    );
  }
}
