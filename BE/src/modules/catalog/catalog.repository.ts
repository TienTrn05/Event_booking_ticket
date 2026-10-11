import { contentRepository } from './repositories/content.repository.js';
import { eventsRepository } from './repositories/events.repository.js';
import { organizersRepository } from './repositories/organizers.repository.js';
import { venuesRepository } from './repositories/venues.repository.js';
import type { CatalogRepository } from './types/catalog.repository.types.js';
export type { CatalogRepository } from './types/catalog.repository.types.js';
export const postgresCatalogRepository: CatalogRepository = {
  ...eventsRepository,
  ...organizersRepository,
  ...contentRepository,
  ...venuesRepository,
};
