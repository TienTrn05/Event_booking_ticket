import { z } from 'zod';
import { numericId, versionSchema } from '../../../shared/validation/common.schema.js';
export const invitationInput = z.object({ userId: numericId, version: versionSchema }).strict();
export const membershipDecision = z.object({ version: versionSchema }).strict();
