import { z } from 'zod';
import { numericId, paginationShape } from '../../shared/validation/common.schema.js';
export const auditQuery = z
  .object({
    ...paginationShape,
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    resourceType: z
      .enum([
        'EVENT',
        'ORGANIZATION',
        'REVIEW',
        'EVENT_REVIEW',
        'REASON_NOTICE',
        'BOOKING',
        'REFUND',
        'SUPPORT_REPORT',
      ])
      .optional(),
    resourceId: numericId.optional(),
    reportId: numericId.optional(),
    action: z
      .string()
      .regex(/^[a-zA-Z0-9_.-]{1,80}$/)
      .optional(),
  })
  .strict()
  .refine((q) => !q.from || !q.to || Date.parse(q.from) < Date.parse(q.to), {
    path: ['to'],
    message: 'Invalid date range',
  });
export type AuditQuery = z.infer<typeof auditQuery>;
