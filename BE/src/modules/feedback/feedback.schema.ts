import { z } from 'zod';
import { numericId } from '../../shared/validation/common.schema.js';
const content = z.string().trim().min(3).max(2000);
export const feedbackInput = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('ORGANIZATION'),
      eventId: numericId,
      stars: z.number().int().min(1).max(5),
      content,
    })
    .strict(),
  z
    .object({
      kind: z.literal('SYSTEM'),
      category: z.enum(['BUG', 'PERFORMANCE', 'USABILITY', 'OTHER']),
      stars: z.number().int().min(1).max(5).nullable().optional(),
      content,
    })
    .strict(),
]);
export const feedbackEdit = z
  .object({
    version: z.number().int().nonnegative(),
    stars: z.number().int().min(1).max(5),
    content,
  })
  .strict();
export const feedbackReply = z
  .object({ version: z.number().int().nonnegative(), reply: content })
  .strict();
export const feedbackHandle = z
  .object({
    version: z.number().int().nonnegative(),
    reply: content,
    status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']),
  })
  .strict();
export const feedbackModerate = z
  .object({
    version: z.number().int().nonnegative(),
    hidden: z.boolean(),
    reason: z.string().trim().min(3).max(1000),
  })
  .strict();
export type FeedbackInput = z.infer<typeof feedbackInput>;
