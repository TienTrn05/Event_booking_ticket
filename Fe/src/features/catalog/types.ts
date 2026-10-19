import type { Event, ReopeningRequest } from '../events/types';
import type { HomeMerchandiseProduct } from '../merchandise/types';
import type { Organizer } from '../organizer/types';

export interface CatalogCategory {
  id: string;
  name: string;
  eventCount: number;
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

export interface CatalogLocation {
  name: string;
  queryValue: string;
  eventCount: number;
  image: string;
}

export interface HomeCatalog {
  categories: CatalogCategory[];
  featuredEvents: Event[];
  events: Event[];
  spotlightEvents: Event[];
  organizers: Organizer[];
  merchandise: HomeMerchandiseProduct[];
  articles: CatalogArticle[];
  reopeningRequests: ReopeningRequest[];
  locations: CatalogLocation[];
}
