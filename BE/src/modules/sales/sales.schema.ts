import { z } from 'zod';
import { numericId, paginationShape } from '../../shared/validation/common.schema.js';
const filter = {
  eventId: numericId.optional(),
  sessionId: numericId.optional(),
  from: z.iso.datetime({ offset: true }).optional(),
  to: z.iso.datetime({ offset: true }).optional(),
};
const range = (q: { from?: string | undefined; to?: string | undefined }) =>
  !q.from || !q.to || new Date(q.from) < new Date(q.to);
export const ordersQuery = z
  .object({
    ...filter,
    ...paginationShape,
    status: z
      .enum(['AWAITING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'REFUNDED'])
      .optional(),
  })
  .strict()
  .refine(range, { message: 'from phải trước to', path: ['to'] });
export const ticketsQuery = z
  .object({
    ...filter,
    ...paginationShape,
    status: z.enum(['VALID', 'USED', 'CANCELLED', 'REFUNDED', 'EXPIRED']).optional(),
  })
  .strict()
  .refine(range, { message: 'from phải trước to', path: ['to'] });
export const overviewQuery = z
  .object(filter)
  .strict()
  .refine(range, { message: 'from phải trước to', path: ['to'] });
export const reconciliationQuery = z
  .object({
    ...filter,
    ...paginationShape,
    status: z.enum(['REQUIRED', 'RESOLVED', 'NONE']).default('REQUIRED'),
  })
  .strict()
  .refine(range, { message: 'from phải trước to', path: ['to'] });
export type SalesFilter = z.infer<typeof overviewQuery>;
export type OrderFilter = z.infer<typeof ordersQuery>;
export type TicketFilter = z.infer<typeof ticketsQuery>;
export type ReconciliationFilter = z.infer<typeof reconciliationQuery>;
