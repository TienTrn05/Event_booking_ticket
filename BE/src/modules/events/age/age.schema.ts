import { z } from 'zod';
import { calendarDate, versionSchema } from '../../../shared/validation/common.schema.js';

export const ageRestrictionInput = z
  .object({
    minimumAge: z.number().int().min(1).max(32767).nullable(),
    version: versionSchema,
  })
  .strict();
export const ageEligibilityInput = z.object({ dateOfBirth: calendarDate.optional() }).strict();
export type AgeRestrictionInput = z.infer<typeof ageRestrictionInput>;
