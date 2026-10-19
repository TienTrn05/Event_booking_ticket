import { z } from 'zod';
import {
  versionSchema as versionValue,
  paginationShape,
} from '../../../shared/validation/common.schema.js';
const reason = z.string().trim().min(1).max(2000);
export const contentChange = z
  .object({
    version: versionValue,
    title: z.string().trim().min(1).max(180),
    description: z.string().trim().min(1).max(10000),
    reason,
  })
  .strict();
export const operationDecision = z.object({ version: versionValue, reason }).strict();
export const changeList = z
  .object({
    ...paginationShape,
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN']).optional(),
  })
  .strict();
export type ContentChange = z.infer<typeof contentChange>;
export type OperationDecision = z.infer<typeof operationDecision>;
