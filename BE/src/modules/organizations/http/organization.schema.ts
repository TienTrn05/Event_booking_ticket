import { z } from 'zod';
import { versionSchema } from '../../../shared/validation/common.schema.js';
export const organizationInput = z.object({ name: z.string().trim().min(1).max(180) }).strict();
export const organizationResubmit = organizationInput.extend({ version: versionSchema }).strict();
export const organizationDecision = z
  .object({ version: versionSchema, reason: z.string().trim().min(1).max(2000) })
  .strict();
