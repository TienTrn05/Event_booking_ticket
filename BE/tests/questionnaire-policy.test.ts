import { describe, it, expect } from 'vitest';
import {
  questionsSchema,
  answersSchema,
} from '../src/modules/users/onboarding/questions/questionnaire.schema.js';
import { validateAnswers } from '../src/modules/users/onboarding/questions/questionnaire.policy.js';
describe('admin supplemental question boundary', () => {
  it('rejects core keys, duplicate keys and choice options', () => {
    expect(
      questionsSchema.safeParse([{ key: 'role', kind: 'TEXT', label: 'Role', required: false }])
        .success,
    ).toBe(false);
    const q = { key: 'custom_goal', kind: 'TEXT', label: 'Mục tiêu', required: true };
    expect(questionsSchema.safeParse([q, q]).success).toBe(false);
    expect(
      questionsSchema.safeParse([
        {
          ...q,
          kind: 'SINGLE_CHOICE',
          options: [
            { value: 'one', label: 'Một' },
            { value: 'one', label: 'Hai' },
          ],
        },
      ]).success,
    ).toBe(false);
  });
  it('requires built-in and custom answers, rejects removed questions and invalid options', () => {
    const questions = questionsSchema.parse([
      { key: 'preferredCity', kind: 'CITY', label: 'Thành phố', required: true },
      {
        key: 'custom_goal',
        kind: 'SINGLE_CHOICE',
        label: 'Mục tiêu',
        required: true,
        options: [
          { value: 'learn', label: 'Học hỏi' },
          { value: 'network', label: 'Giao lưu' },
        ],
      },
    ]);
    const selected = { favoriteCategories: [], preferredCity: 'Ha Noi', followedOrganizers: [] };
    expect(() => validateAnswers(questions, {}, selected)).toThrow();
    expect(() => validateAnswers(questions, { custom_goal: 'wrong' }, selected)).toThrow();
    expect(() => validateAnswers(questions, { custom_goal: ['learn'] }, selected)).toThrow();
    expect(() =>
      validateAnswers(questions, { custom_goal: 'learn' }, { ...selected, preferredCity: null }),
    ).toThrow();
    expect(() =>
      validateAnswers(questions, { custom_goal: 'learn', custom_unknown: 'test' }, selected),
    ).toThrow();
    expect(() =>
      validateAnswers(
        questions,
        { custom_goal: 'learn' },
        { ...selected, favoriteCategories: ['music'] },
      ),
    ).toThrow();
    expect(() => validateAnswers(questions, { custom_goal: 'learn' }, selected)).not.toThrow();
  });
  it('supports short text and multiple choices without accepting duplicate answers', () => {
    expect(answersSchema.safeParse({ custom_choices: ['a', 'a'] }).success).toBe(false);
    const questions = questionsSchema.parse([
      { key: 'custom_goal', kind: 'TEXT', label: 'Mục tiêu', required: true },
      {
        key: 'custom_choices',
        kind: 'MULTI_CHOICE',
        label: 'Chọn',
        required: false,
        options: [
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ],
      },
    ]);
    expect(() => validateAnswers(questions, { custom_goal: ['a'] })).toThrow();
    expect(() =>
      validateAnswers(questions, { custom_goal: 'Học hỏi', custom_choices: 'a' }),
    ).toThrow();
    expect(() =>
      validateAnswers(questions, { custom_goal: 'Học hỏi', custom_choices: ['a', 'b'] }),
    ).not.toThrow();
  });
});
