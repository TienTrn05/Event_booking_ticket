import { z } from 'zod';
import { numericId } from '../../shared/validation/common.schema.js';
export const reputationAdjustment = z
  .object({
    reportId: numericId,
    delta: z
      .number()
      .int()
      .min(-20)
      .max(20)
      .refine((v) => v !== 0),
    reason: z.string().trim().min(3).max(2000),
  })
  .strict();
export const reputationReversal = z.object({ reason: z.string().trim().min(3).max(2000) }).strict();
