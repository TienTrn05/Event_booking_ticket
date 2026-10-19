import { z } from 'zod';

export const googleStartInput = z.object({ link: z.boolean().optional() }).strict();
// Google may add scope/authuser/prompt; only code and state are consumed.
export const googleCallbackQuery = z.object({
  code: z.string().min(1).max(2048),
  state: z.string().min(1).max(256),
});
