import { z } from 'zod';
import { apiRequest } from '../../../shared/api/client';
import type { HomeCatalog } from '../types';

export const eventSchema = z.object({
  id: z.string(),
  title: z.string(),
  minimumAge: z.number().int().nullable(),
  ageTag: z.string().nullable(),
  displayName: z.string(),
  category: z.string().min(1),
  categorySlug: z.string(),
  image: z.string(),
  date: z.string(),
  dateLabel: z.string(),
  startsAt: z.string(),
  venue: z.string(),
  city: z.string(),
  startingPrice: z.string().regex(/^\d+$/),
  currency: z.string().length(3),
  organizer: z.string(),
  organizerId: z.string(),
  description: z.string(),
  admission: z.enum(['numbered', 'quantity']),
  status: z.enum(['on-sale', 'few-left', 'sold-out', 'coming-soon']),
  badge: z.string().nullable(),
  featured: z.boolean(),
  spotlight: z.boolean(),
  reopeningNote: z.string().nullable(),
});

const organizerSchema = z.object({
  id: z.string(),
  name: z.string(),
  avatar: z.string(),
  summary: z.string(),
  verified: z.boolean(),
  eventCount: z.number().int().nonnegative(),
  hasMerchandise: z.boolean(),
  category: z.string(),
  upcomingEventTitle: z.string().nullable(),
  upcomingEventDate: z.string().nullable(),
  upcomingEventId: z.string().nullable(),
});

const merchandiseSchema = z.object({
  id: z.string(),
  eventId: z.string(),
  eventTitle: z.string(),
  name: z.string(),
  description: z.string(),
  image: z.string(),
  price: z.string().regex(/^\d+$/),
  currency: z.string().length(3),
  organizer: z.string(),
  organizerId: z.string(),
  badge: z.enum(['New', 'Limited', 'Best Seller']).nullable(),
  requiresTicket: z.boolean(),
});

const homeCatalogSchema = z.object({
  data: z.object({
    categories: z.array(
      z.object({ id: z.string(), name: z.string(), eventCount: z.number().int().nonnegative() }),
    ),
    featuredEvents: z.array(eventSchema),
    events: z.array(eventSchema),
    spotlightEvents: z.array(eventSchema),
    organizers: z.array(organizerSchema),
    merchandise: z.array(merchandiseSchema),
    articles: z.array(
      z.object({
        id: z.string(),
        image: z.string(),
        publishedAt: z.string(),
        date: z.string(),
        category: z.string(),
        readTime: z.string(),
        title: z.string(),
        excerpt: z.string(),
        paragraphs: z.array(z.string()),
      }),
    ),
    reopeningRequests: z.array(
      z.object({
        id: z.string(),
        eventId: z.string(),
        eventTitle: z.string(),
        organizer: z.string(),
        image: z.string(),
        type: z.string(),
        reason: z.string(),
        impactSummary: z.string(),
        status: z.string(),
        requestedAt: z.string(),
      }),
    ),
    locations: z.array(
      z.object({
        name: z.string(),
        queryValue: z.string(),
        eventCount: z.number().int().nonnegative(),
        image: z.string(),
      }),
    ),
  }),
});

export async function getHomeCatalog(signal?: AbortSignal): Promise<HomeCatalog> {
  const response = await apiRequest('/catalog/home', signal ? { signal } : {});
  return homeCatalogSchema.parse(response).data;
}
