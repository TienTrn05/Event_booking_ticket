import { AppError } from '../../shared/errors/app-error.js';
import type { CatalogRepository } from './catalog.repository.js';
import type { EventFilters, HomeCatalog } from './types/catalog.types.js';

const defaultFilters: EventFilters = { page: 1, pageSize: 100 };

export function createCatalogService(repository: CatalogRepository) {
  return {
    async home(userId?: string): Promise<HomeCatalog> {
      const [
        categories,
        events,
        featuredEvents,
        spotlightEvents,
        organizers,
        merchandise,
        articles,
        reopeningRequests,
        locations,
      ] = await Promise.all([
        repository.listCategories(),
        repository.listEvents({ ...defaultFilters, excludedForUserId: userId }),
        repository.listEvents({ ...defaultFilters, featured: true, excludedForUserId: userId }),
        repository.listEvents({ ...defaultFilters, spotlight: true, excludedForUserId: userId }),
        repository.listOrganizers(true, userId),
        repository.listMerchandise(userId),
        repository.listArticles(),
        repository.listChangeRequests(userId),
        repository.listLocations(),
      ]);
      return {
        categories,
        events,
        featuredEvents,
        spotlightEvents,
        organizers,
        merchandise,
        articles,
        reopeningRequests,
        locations,
      };
    },
    listEvents: (filters: EventFilters) => repository.listEvents(filters),
    listOrganizers: (featuredOnly?: boolean, userId?: string) =>
      repository.listOrganizers(featuredOnly, userId),
    listMerchandise: (userId?: string) => repository.listMerchandise(userId),
    listArticles: () => repository.listArticles(),
    listChangeRequests: (userId?: string) => repository.listChangeRequests(userId),
    listCategories: () => repository.listCategories(),
    listLocations: () => repository.listLocations(),
    listVenues: (city?: string) => repository.listVenues(city),
    event: async (id: string, userId?: string) =>
      found(await repository.findEvent(id, userId), 'EVENT_NOT_FOUND'),
    organizer: async (id: string, userId?: string) =>
      found(await repository.findOrganizer(id, userId), 'ORGANIZER_NOT_FOUND'),
    merchandise: async (id: string, userId?: string) =>
      found(await repository.findMerchandise(id, userId), 'MERCHANDISE_NOT_FOUND'),
    article: async (id: string) => found(await repository.findArticle(id), 'ARTICLE_NOT_FOUND'),
    venue: async (id: string) => found(await repository.findVenue(id), 'VENUE_NOT_FOUND'),
  };
}

function found<T>(value: T | null, code: string): T {
  if (!value) throw new AppError(404, code, 'Không tìm thấy tài nguyên.');
  return value;
}
