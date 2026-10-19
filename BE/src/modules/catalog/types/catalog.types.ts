export interface EventFilters {
  /** Set from a verified session only; excluded from public query schemas. */
  excludedForUserId?: string | undefined;
  q?: string | undefined;
  category?: string | undefined;
  city?: string | undefined;
  featured?: boolean | undefined;
  spotlight?: boolean | undefined;
  from?: string | undefined;
  to?: string | undefined;
  minPrice?: string | undefined;
  maxPrice?: string | undefined;
  available?: boolean | undefined;
  sort?: 'recommended' | 'date_asc' | 'date_desc' | 'price_asc' | 'price_desc' | undefined;
  page: number;
  pageSize: number;
}

export interface CatalogEvent {
  id: string;
  title: string;
  minimumAge: number | null;
  ageTag: string | null;
  displayName: string;
  category: string;
  categorySlug: string;
  image: string;
  date: string;
  dateLabel: string;
  startsAt: string;
  venue: string;
  city: string;
  startingPrice: string;
  currency: string;
  organizer: string;
  organizerId: string;
  description: string;
  admission: 'numbered' | 'quantity';
  status: 'on-sale' | 'few-left' | 'sold-out' | 'coming-soon';
  badge: string | null;
  featured: boolean;
  spotlight: boolean;
  reopeningNote: string | null;
}

export interface CatalogOrganizer {
  id: string;
  name: string;
  avatar: string;
  summary: string;
  verified: boolean;
  eventCount: number;
  hasMerchandise: boolean;
  category: string;
  upcomingEventTitle: string | null;
  upcomingEventDate: string | null;
  upcomingEventId: string | null;
}

export interface CatalogMerchandise {
  id: string;
  eventId: string;
  eventTitle: string;
  name: string;
  description: string;
  image: string;
  price: string;
  currency: string;
  organizer: string;
  organizerId: string;
  badge: string | null;
  requiresTicket: boolean;
}

export interface CatalogArticle {
  id: string;
  image: string;
  publishedAt: string;
  date: string;
  category: string;
  readTime: string;
  title: string;
  excerpt: string;
  paragraphs: string[];
}

export interface EventChangeRequest {
  id: string;
  eventId: string;
  eventTitle: string;
  organizer: string;
  image: string;
  type: string;
  reason: string;
  impactSummary: string;
  status: string;
  requestedAt: string;
}

export interface EventCategory {
  id: string;
  name: string;
  eventCount: number;
}

export interface CatalogLocation {
  name: string;
  queryValue: string;
  eventCount: number;
  image: string;
}

export interface CatalogVenue {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  timezone: string;
  maxCapacity: number;
  version: number;
}

export interface HomeCatalog {
  categories: EventCategory[];
  featuredEvents: CatalogEvent[];
  events: CatalogEvent[];
  spotlightEvents: CatalogEvent[];
  organizers: CatalogOrganizer[];
  merchandise: CatalogMerchandise[];
  articles: CatalogArticle[];
  reopeningRequests: EventChangeRequest[];
  locations: CatalogLocation[];
}
