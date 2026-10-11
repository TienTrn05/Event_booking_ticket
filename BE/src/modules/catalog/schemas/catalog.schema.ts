import { z } from 'zod';
import { paginationShape, queryInteger } from '../../../shared/validation/common.schema.js';

export const catalogId = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9-]+$/);
const booleanQuery = z.enum(['true', 'false']).transform((value) => value === 'true');
export const eventQuery = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    category: z.string().trim().min(1).max(160).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    featured: booleanQuery.optional(),
    spotlight: booleanQuery.optional(),
    page: paginationShape.page,
    pageSize: queryInteger(100).default(24),
  })
  .strict();
export const organizerQuery = z.object({ featured: booleanQuery.optional() }).strict();
export const venueQuery = z.object({ city: z.string().trim().min(1).max(120).optional() }).strict();
