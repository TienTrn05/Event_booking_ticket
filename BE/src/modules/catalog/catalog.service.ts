import { AppError } from '../../shared/errors/app-error.js';
import type { CatalogRepository } from './catalog.repository.js';
import type { EventFilters, HomeCatalog } from './catalog.types.js';

const defaultFilters: EventFilters = { page: 1, pageSize: 100 };

export function createCatalogService(repository: CatalogRepository) {
  return {
    async home(): Promise<HomeCatalog> {
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
        repository.listEvents(defaultFilters),
        repository.listEvents({ ...defaultFilters, featured: true }),
        repository.listEvents({ ...defaultFilters, spotlight: true }),
        repository.listOrganizers(true),
        repository.listMerchandise(),
        repository.listArticles(),
        repository.listChangeRequests(),
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
    listOrganizers: (featuredOnly?: boolean) => repository.listOrganizers(featuredOnly),
    listMerchandise: () => repository.listMerchandise(),
    listArticles: () => repository.listArticles(),
    listChangeRequests: () => repository.listChangeRequests(),
    listCategories: () => repository.listCategories(),
    listLocations: () => repository.listLocations(),
    listVenues: (city?: string) => repository.listVenues(city),
    event: async (id: string) => found(await repository.findEvent(id), 'EVENT_NOT_FOUND'),
    organizer: async (id: string) =>
      found(await repository.findOrganizer(id), 'ORGANIZER_NOT_FOUND'),
    merchandise: async (id: string) =>
      found(await repository.findMerchandise(id), 'MERCHANDISE_NOT_FOUND'),
    article: async (id: string) => found(await repository.findArticle(id), 'ARTICLE_NOT_FOUND'),
    venue: async (id: string) => found(await repository.findVenue(id), 'VENUE_NOT_FOUND'),
  };
}

function found<T>(value: T | null, code: string): T {
  if (!value) throw new AppError(404, code, 'Không tìm thấy tài nguyên.');
  return value;
}
