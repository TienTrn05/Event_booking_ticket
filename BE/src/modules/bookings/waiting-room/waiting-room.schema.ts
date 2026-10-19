import { z } from 'zod';
import { publicId } from '../../../shared/validation/common.schema.js';

export const marketCacheSchema = z
  .object({
    publicId,
    state: z.enum(['OPEN', 'PAUSED', 'SOLD_OUT', 'CLOSED']),
  })
  .strict();
