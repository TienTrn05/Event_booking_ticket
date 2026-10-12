import { AppError } from '../../../../shared/errors/app-error.js';
import type { Answers, Question } from './questionnaire.schema.js';
type Selections = {
  favoriteCategories: string[];
  preferredCity: string | null;
  followedOrganizers: string[];
};
export function validateAnswers(questions: Question[], answers: Answers, selections?: Selections) {
  const byKey = new Map(questions.map((q) => [q.key, q]));
  for (const key of Object.keys(answers)) {
    const question = byKey.get(key),
      value = answers[key]!;
    if (!question || ['CATEGORIES', 'CITY', 'ORGANIZERS'].includes(question.kind))
      throw new AppError(422, 'UNKNOWN_ONBOARDING_ANSWER', 'Câu trả lời không thuộc bộ câu hỏi.');
    if (question.kind === 'TEXT' && typeof value !== 'string')
      throw new AppError(422, 'INVALID_ONBOARDING_ANSWER', 'Câu trả lời cần văn bản.');
    if (question.kind === 'SINGLE_CHOICE' || question.kind === 'MULTI_CHOICE') {
      const values = Array.isArray(value) ? value : [value];
      if (
        (question.kind === 'SINGLE_CHOICE' && Array.isArray(value)) ||
        (question.kind === 'MULTI_CHOICE' && !Array.isArray(value)) ||
        values.some((v) => !question.options.some((option) => option.value === v))
      )
        throw new AppError(422, 'INVALID_ONBOARDING_ANSWER', 'Lựa chọn không hợp lệ.');
    }
  }
  for (const question of questions) {
    const selected =
      question.kind === 'CATEGORIES'
        ? selections?.favoriteCategories.length
        : question.kind === 'CITY'
          ? selections?.preferredCity
          : question.kind === 'ORGANIZERS'
            ? selections?.followedOrganizers.length
            : answers[question.key];
    if (question.required && !selected && (selections || question.key.startsWith('custom_')))
      throw new AppError(422, 'ONBOARDING_ANSWER_REQUIRED', 'Cần trả lời câu hỏi bắt buộc.', [
        { field: question.key, code: 'REQUIRED' },
      ]);
  }
  if (selections) {
    for (const key of ['favoriteCategories', 'preferredCity', 'followedOrganizers'] as const) {
      const value = selections[key];
      if (!byKey.has(key) && (Array.isArray(value) ? value.length > 0 : !!value))
        throw new AppError(422, 'QUESTION_NOT_AVAILABLE', 'Câu hỏi không còn trong bộ đăng ký.');
    }
  }
}
