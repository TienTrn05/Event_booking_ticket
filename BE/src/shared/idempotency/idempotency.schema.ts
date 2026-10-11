import { z } from 'zod';

export const idempotencyKey = z
  .string()
  .min(8)
  .max(191)
  .regex(/^[A-Za-z0-9._:-]+$/);
