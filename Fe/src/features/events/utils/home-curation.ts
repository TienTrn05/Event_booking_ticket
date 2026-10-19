import type { HomeCatalog } from '../../catalog/types';

/** Merge editorial feeds once; the hero already owns the leading event. Search remains complete. */
export function selectHomeFeatured(catalog: HomeCatalog) {
  const heroId = (catalog.featuredEvents[0] ?? catalog.events[0])?.id;
  const unique = new Map(
    [...catalog.featuredEvents, ...catalog.spotlightEvents].map((event) => [event.id, event]),
  );
  return [...unique.values()].filter((event) => event.id !== heroId).slice(0, 8);
}
