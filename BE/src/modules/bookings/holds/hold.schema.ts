import { z } from 'zod';
import { numericId } from '../../../shared/validation/common.schema.js';
export const zoneHoldInput = z
  .object({
    zones: z
      .array(z.object({ sectionId: numericId, quantity: z.number().int().min(1).max(6) }).strict())
      .min(1)
      .max(6),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.zones.map((z) => z.sectionId)).size === v.zones.length &&
      v.zones.reduce((n, z) => n + z.quantity, 0) <= 6,
  );

export const holdInput = z
  .object({
    seatIds: z
      .array(numericId)
      .min(1)
      .max(6)
      .refine((ids) => new Set(ids).size === ids.length),
  })
  .strict();
