import { z } from 'zod';
import { apiRequest } from '../../../shared/api/client';
import { eventSchema } from '../../catalog/api/catalog.api';
export type EventSearchInput = {
  q?: string;
  category?: string;
  city?: string;
  sort: 'relevance' | 'popular' | 'date_asc' | 'price_asc' | 'price_desc';
  page: number;
  pageSize: number;
};
export const eventSearchResponse = z.object({
  data: z.object({
    items: z.array(eventSchema),
    total: z.number().int().nonnegative(),
    degraded: z.boolean(),
    pagination: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      total: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasMore: z.boolean(),
    }),
  }),
});
export type EventSearchResult = z.infer<typeof eventSearchResponse>['data'];
export async function searchEvents(
  input: EventSearchInput,
  token: string | null,
  signal: AbortSignal,
  suggest = false,
) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(input))
    if (value !== undefined && value !== '') query.set(key, String(value));
  const response = await apiRequest(
    '/search/events' + (suggest ? '/suggestions' : '') + '?' + query.toString(),
    { signal, ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}) },
  );
  return eventSearchResponse.parse(response).data;
}
