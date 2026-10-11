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
  findEvent(id: string): Promise<CatalogEvent | null>;
  listOrganizers(featuredOnly?: boolean): Promise<CatalogOrganizer[]>;
  findOrganizer(id: string): Promise<CatalogOrganizer | null>;
  listMerchandise(): Promise<CatalogMerchandise[]>;
  findMerchandise(id: string): Promise<CatalogMerchandise | null>;
  listArticles(): Promise<CatalogArticle[]>;
  findArticle(id: string): Promise<CatalogArticle | null>;
  listChangeRequests(): Promise<EventChangeRequest[]>;
  listLocations(): Promise<CatalogLocation[]>;
  listVenues(city?: string): Promise<CatalogVenue[]>;
  findVenue(id: string): Promise<CatalogVenue | null>;
}
