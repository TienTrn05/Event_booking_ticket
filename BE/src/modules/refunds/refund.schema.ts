import { z } from 'zod';
import { numericId, versionSchema } from '../../shared/validation/common.schema.js';
export const refundInput = z.object({ reason: z.string().trim().min(3).max(500) }).strict();
export const refundDecision = z
  .object({
    version: versionSchema,
    reason: z.string().trim().min(3).max(1000),
    reportId: numericId.optional(),
  })
  .strict();
export const refundResult = z.discriminatedUnion('status', [
  z
    .object({
      version: versionSchema,
      status: z.literal('SUCCESS'),
      reference: z.string().trim().min(3).max(191),
      evidenceNote: z.string().trim().min(10).max(2000),
      transferredAt: z.iso.datetime({ offset: true }),
      reportId: numericId.optional(),
    })
    .strict(),
  z
    .object({
      version: versionSchema,
      status: z.literal('FAILED'),
      reason: z.string().trim().min(3).max(1000),
      reportId: numericId.optional(),
    })
    .strict(),
]);
export type RefundDecision = z.infer<typeof refundDecision>;
export type RefundResult = z.infer<typeof refundResult>;
