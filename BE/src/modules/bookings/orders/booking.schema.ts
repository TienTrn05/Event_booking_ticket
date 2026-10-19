import { z } from 'zod';
import { numericId } from '../../../shared/validation/common.schema.js';

export const bookingInput = z
  .object({
    holdId: numericId,
    attendees: z
      .array(
        z
          .object({
            sessionSeatId: numericId,
            attendeeName: z.string().trim().min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(6)
      .refine((items) => new Set(items.map((i) => i.sessionSeatId)).size === items.length),
  })
  .strict();

export const cancelInput = z.object({ reason: z.string().trim().min(1).max(2000) }).strict();

export type BookingInput = z.infer<typeof bookingInput>;
