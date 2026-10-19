import { z } from 'zod';
export const followSchema = z.object({ notificationsEnabled: z.boolean().optional() }).strict();
export const followPreferenceSchema = z.object({ notificationsEnabled: z.boolean() }).strict();
