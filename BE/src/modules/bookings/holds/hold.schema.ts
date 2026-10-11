import { z } from 'zod';
import { numericId } from '../../../shared/validation/common.schema.js';

export const holdInput = z
  .object({
    seatIds: z
      .array(numericId)
      .min(1)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
