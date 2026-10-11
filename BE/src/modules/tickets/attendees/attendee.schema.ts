import { z } from 'zod';
import { calendarDate, numericId } from '../../../shared/validation/common.schema.js';
import { normalizePhone } from '../../../shared/validation/contact.schema.js';
export const cccdSchema = z.string().regex(/^[0-9]{12}$/);
export const attendeeInput = z
  .object({
    bookingItemId: numericId,
    fullName: z.string().trim().min(1).max(200),
    dateOfBirth: calendarDate,
    phone: z.string().max(40).transform(normalizePhone),
    cccd: cccdSchema,
  })
  .strict();
export const attendeesInput = z
  .object({
    attendees: z
      .array(attendeeInput)
      .min(1)
      .max(6)
      .refine(
        (items) => new Set(items.map((i) => i.bookingItemId)).size === items.length,
        'Duplicate booking item',
      ),
  })
  .strict();
export const verificationInput = z
  .object({
    cccd: cccdSchema,
    fullName: z.string().trim().min(1).max(200),
    dateOfBirth: calendarDate,
    physicalDocumentSeen: z.literal(true),
  })
  .strict();
export type AttendeeInput = z.infer<typeof attendeeInput>;
