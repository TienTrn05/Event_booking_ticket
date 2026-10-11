import { z } from 'zod';

import { calendarDate } from '../../../shared/validation/common.schema.js';
export const updateProfileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    gender: z.enum(['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED']).nullable().optional(),
    dateOfBirth: calendarDate.nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export type ProfileUpdate = z.infer<typeof updateProfileSchema>;

export type UserProfile = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  gender: 'MALE' | 'FEMALE' | 'OTHER' | 'UNDISCLOSED' | null;
  dateOfBirth: string | null;
};
