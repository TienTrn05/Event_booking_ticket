import { z } from 'zod';
import { calendarDate, publicId, numericId } from '../../../shared/validation/common.schema.js';
import { answersSchema } from './questions/questionnaire.schema.js';
const unique = <T>(items: T[]) => new Set(items).size === items.length;
export const preferenceFields = {
  favoriteCategories: z
    .array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,159}$/))
    .max(10)
    .refine(unique)
    .default([]),
  preferredCity: z.string().trim().min(1).max(120).nullable().default(null),
};
export const onboardingInput = z
  .object({
    role: z.enum(['CUSTOMER', 'ORGANIZER']),
    displayName: z.string().trim().min(1).max(120),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']),
    dateOfBirth: calendarDate,
    ...preferenceFields,
    followedOrganizers: z.array(publicId).max(20).refine(unique).default([]),
    noOrganizerYet: z.boolean().default(false),
    questionnaireId: numericId.optional(),
    answers: answersSchema,
  })
  .strict()
  .refine((value) => !value.noOrganizerYet || value.followedOrganizers.length === 0, {
    message: 'Choose organizers or explicitly choose none, not both.',
    path: ['noOrganizerYet'],
  });
export const preferencesInput = z.object(preferenceFields).strict();
export type OnboardingInput = z.infer<typeof onboardingInput>;
export type PreferencesInput = z.infer<typeof preferencesInput>;
