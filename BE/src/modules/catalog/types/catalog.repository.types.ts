import type { QueryResultRow } from 'pg';
import type {
  CatalogArticle,
  CatalogEvent,
  CatalogLocation,
  CatalogMerchandise,
  CatalogOrganizer,
  CatalogVenue,
  EventCategory,
  EventChangeRequest,
  EventFilters,
} from './catalog.types.js';
export type CatalogRow<T> = T & QueryResultRow;
export interface CatalogRepository {
  listCategories(): Promise<EventCategory[]>;
  listEvents(filters: EventFilters): Promise<CatalogEvent[]>;
  findEvent(id: string, userId?: string): Promise<CatalogEvent | null>;
  listOrganizers(featuredOnly?: boolean, userId?: string): Promise<CatalogOrganizer[]>;
  findOrganizer(id: string, userId?: string): Promise<CatalogOrganizer | null>;
  listMerchandise(userId?: string): Promise<CatalogMerchandise[]>;
  findMerchandise(id: string, userId?: string): Promise<CatalogMerchandise | null>;
  listArticles(): Promise<CatalogArticle[]>;
  findArticle(id: string): Promise<CatalogArticle | null>;
  listChangeRequests(userId?: string): Promise<EventChangeRequest[]>;
  listLocations(): Promise<CatalogLocation[]>;
  listVenues(city?: string): Promise<CatalogVenue[]>;
  findVenue(id: string): Promise<CatalogVenue | null>;
}
