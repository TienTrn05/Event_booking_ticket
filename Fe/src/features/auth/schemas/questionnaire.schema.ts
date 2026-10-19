import { z } from 'zod';
export const questionSchema = z.object({
  key: z.string(),
  label: z.string(),
  required: z.boolean(),
  kind: z.enum(['CATEGORIES', 'CITY', 'ORGANIZERS', 'TEXT', 'SINGLE_CHOICE', 'MULTI_CHOICE']),
  options: z.array(z.object({ value: z.string(), label: z.string() })).optional(),
});
export const questionnaireSchema = z.object({ id: z.string(), questions: z.array(questionSchema) });
export type Question = z.infer<typeof questionSchema>;
export type Answers = Record<string, string | string[]>;
