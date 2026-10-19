import { z } from 'zod';

export const otpRequestSchema = z
  .object({
    identifier: z.string().trim().min(1).max(254),
    phone: z.string().max(32).optional(),
    purpose: z.enum(['LOGIN', 'LINK_IDENTITY']).default('LOGIN'),
  })
  .strict();
export const otpVerifySchema = z
  .object({
    challengeId: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
    code: z.string().regex(/^\d{6}$/),
  })
  .strict();
export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
