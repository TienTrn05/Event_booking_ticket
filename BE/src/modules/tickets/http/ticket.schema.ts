import { z } from 'zod';
import { calendarDate } from '../../../shared/validation/common.schema.js';
import { cccdSchema } from '../attendees/attendee.schema.js';
export const ticketCode = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^EVX-[A-F0-9]{32}$/);
export const lookupInput = z.object({ ticketCode }).strict();
export const checkInInput = z
  .object({ attendeeName: z.string().trim().min(1).max(200), ticketCode })
  .strict();
export const admissionInput = z
  .object({
    ticketCode,
    cccd: cccdSchema,
    fullName: z.string().trim().min(1).max(200),
    dateOfBirth: calendarDate,
    physicalDocumentSeen: z.literal(true),
  })
  .strict();
