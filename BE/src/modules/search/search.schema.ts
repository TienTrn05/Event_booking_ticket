import { z } from 'zod';
import { numericId, paginationShape } from '../../shared/validation/common.schema.js';
const price = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,18})$/)
  .refine((v) => BigInt(v) <= 9223372036854775807n);
export const searchQuery = z
  .object({
    q: z.string().trim().max(120).optional(),
    category: z.string().trim().min(1).max(160).optional(),
    city: z.string().trim().min(1).max(120).optional(),
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
    minPrice: price.optional(),
    maxPrice: price.optional(),
    available: z
      .enum(['true', 'false'])
      .transform((v) => v === 'true')
      .optional(),
    sort: z
      .enum(['relevance', 'popular', 'date_asc', 'date_desc', 'price_asc', 'price_desc'])
      .default('relevance'),
    ...paginationShape,
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
export type SearchQuery = z.infer<typeof searchQuery>;
export const candidateSchema = z
  .object({ id: numericId, hash: z.string().regex(/^[a-f0-9]{32}$/) })
  .strict();
export const candidatesSchema = z.array(candidateSchema).max(10000);
export type SearchCandidate = z.infer<typeof candidateSchema>;
export type SearchDocument = {
  id: string;
  eventId: string;
  hash: string;
  version: string;
  title: string;
  organizer: string;
  venue: string;
  description: string;
  category: string;
  city: string;
  startsAt: string;
  endsAt: string;
  completion: { input: string[] };
};
