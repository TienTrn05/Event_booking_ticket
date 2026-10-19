import { z } from 'zod';
import { numericId } from '../../../../shared/validation/common.schema.js';
const label = z.string().trim().min(1).max(160);
const common = { label, required: z.boolean() };
const option = z.object({ value: z.string().regex(/^[a-zA-Z0-9_-]{1,40}$/), label }).strict();
const unique = <T>(values: T[]) => new Set(values).size === values.length;
export const questionSchema = z.union([
  z
    .object({ ...common, key: z.literal('favoriteCategories'), kind: z.literal('CATEGORIES') })
    .strict(),
  z.object({ ...common, key: z.literal('preferredCity'), kind: z.literal('CITY') }).strict(),
  z
    .object({ ...common, key: z.literal('followedOrganizers'), kind: z.literal('ORGANIZERS') })
    .strict(),
  z
    .object({
      ...common,
      key: z.string().regex(/^custom_[a-z][a-z0-9_]{0,39}$/),
      kind: z.literal('TEXT'),
    })
    .strict(),
  z
    .object({
      ...common,
      key: z.string().regex(/^custom_[a-z][a-z0-9_]{0,39}$/),
      kind: z.enum(['SINGLE_CHOICE', 'MULTI_CHOICE']),
      options: z
        .array(option)
        .min(2)
        .max(20)
        .refine((values) => unique(values.map((v) => v.value))),
    })
    .strict(),
]);
export const questionsSchema = z
  .array(questionSchema)
  .max(20)
  .refine((values) => unique(values.map((v) => v.key)), 'Question keys must be unique');
export const publishQuestionsInput = z
  .object({ questionnaireId: numericId, questions: questionsSchema })
  .strict();
export const answerValue = z.union([
  z.string().trim().min(1).max(500),
  z.array(z.string().trim().min(1).max(40)).min(1).max(20).refine(unique),
]);
export const answersSchema = z
  .record(z.string().regex(/^custom_[a-z][a-z0-9_]{0,39}$/), answerValue)
  .refine((values) => Object.keys(values).length <= 20)
  .default({});
export const editAnswersInput = z.object({ answers: answersSchema }).strict();
export type Question = z.infer<typeof questionSchema>;
export type Answers = z.infer<typeof answersSchema>;
export type Questionnaire = {
  id: string;
  questions: Question[];
  createdAt: Date;
  createdBy: string | null;
};
