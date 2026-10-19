import { z } from 'zod';
import { paginationShape, queryInteger } from '../../../shared/validation/common.schema.js';

export const catalogId = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9-]+$/);
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
const priceQuery = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((value) => BigInt(value) <= 9223372036854775807n);
export const eventQuery = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(160).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    featured: booleanQuery.optional(),
    spotlight: booleanQuery.optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    minPrice: priceQuery.optional(),
    maxPrice: priceQuery.optional(),
    available: booleanQuery.optional(),
    sort: z.enum(['recommended', 'date_asc', 'date_desc', 'price_asc', 'price_desc']).optional(),
    page: paginationShape.page,
    pageSize: queryInteger(100).default(24),
  })
  .strict()
  .refine((q) => !q.from || !q.to || Date.parse(q.from) < Date.parse(q.to), {
    path: ['to'],
    message: 'Invalid date range',
  })
  .refine(
    (q) =>
      q.minPrice === undefined ||
      q.maxPrice === undefined ||
      BigInt(q.minPrice) <= BigInt(q.maxPrice),
    { path: ['maxPrice'], message: 'Invalid price range' },
  );
export const organizerQuery = z.object({ featured: booleanQuery.optional() }).strict();
export const venueQuery = z.object({ city: z.string().trim().min(1).max(120).optional() }).strict();
