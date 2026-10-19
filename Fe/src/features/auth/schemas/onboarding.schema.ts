import { z } from 'zod';
import { questionnaireSchema } from './questionnaire.schema';

export const onboardingStateSchema = z.object({
  data: z.object({
    completed: z.boolean(),
    roles: z.array(z.string()),
    registrationRole: z.enum(['CUSTOMER', 'ORGANIZER']).nullable(),
    favoriteCategories: z.array(z.string()),
    preferredCity: z.string().nullable(),
    followedOrganizers: z.array(z.string()),
    questionnaire: questionnaireSchema.nullable(),
    answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
    profile: z.object({
      displayName: z.string(),
      gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).nullable(),
      dateOfBirth: z.string().nullable(),
    }),
  }),
});
export const onboardingOptionsSchema = z.object({
  data: z.object({
    categories: z.array(z.object({ id: z.string(), name: z.string() })),
    cities: z.array(
      z.object({ id: z.string(), name: z.string(), image: z.string().nullable().optional() }),
    ),
    organizers: z.array(
      z.object({ id: z.string(), name: z.string(), avatar: z.string().nullable().optional() }),
    ),
    questionnaire: questionnaireSchema,
  }),
});
export type OnboardingState = z.infer<typeof onboardingStateSchema>['data'];
export type OnboardingOptions = z.infer<typeof onboardingOptionsSchema>['data'];
