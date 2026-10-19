import { z } from 'zod';
import {
  numericId,
  paginationShape,
  versionSchema,
} from '../../shared/validation/common.schema.js';
export const reportInput = z
  .object({
    eventId: numericId,
    bookingId: numericId.optional(),
    merchandiseOrderId: numericId.optional(),
    reason: z.string().trim().min(3).max(2000),
  })
  .strict()
  .refine((v) => !(v.bookingId && v.merchandiseOrderId), 'Choose one purchase');
export const reportQuery = z
  .object({ ...paginationShape, status: z.enum(['OPEN', 'IN_REVIEW', 'RESOLVED']).optional() })
  .strict();
export const claimReportInput = z.object({ version: versionSchema }).strict();
export const unpublishInput = z
  .object({
    version: versionSchema,
    reportId: numericId,
    reason: z.string().trim().min(3).max(500),
  })
  .strict();
export type ReportInput = z.infer<typeof reportInput>;
export type ReportQuery = z.infer<typeof reportQuery>;
