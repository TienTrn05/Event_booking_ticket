import { ui } from '../../../../shared/styles/classes';
import { SectionEmblem } from '../../../../shared/ui/SectionEmblem';
import { useState, useMemo } from 'react';
import { useAuthDialog } from '../../../auth/context/AuthDialogContext';
import { useEventSearch, useEventSuggestions } from '../../../search/hooks/useEventSearch';
import { useQuickPreview } from '../../../preview/hooks/useQuickPreview';
import type { EventSearchInput } from '../../../search/api/event-search.api';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, SlidersHorizontal, ChevronDown } from 'lucide-react';
import EventCard from './DiscoveryEventCard';
import type { EventCategory } from '../../types/index';
import { useCatalog } from '../../../catalog/hooks/useCatalog';

const categoryFilters = [
  'All',
  'Music',
  'Technology',
  'Sports',
  'Arts',
  'Workshops',
  'Festivals',
] as const;
const cityFilters = [
  'All Cities',
  'Ha Noi',
  'Ho Chi Minh City',
  'Da Nang',
  'Hue',
  'Hai Phong',
] as const;
const sortOptions = [
  'Best Match',
  'Most Popular',
  'Date (Soonest)',
  'Price (Low to High)',
  'Price (High to Low)',
] as const;

export default function ExploreEvents({
  category,
  onCategoryChange,
}: {
  category: EventCategory | 'All';
  onCategoryChange: (category: EventCategory | 'All') => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCity = searchParams.get('city');
  const search = searchParams.get('q') ?? '';
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const city: (typeof cityFilters)[number] = cityFilters.includes(
    requestedCity as (typeof cityFilters)[number],
  )
    ? (requestedCity as (typeof cityFilters)[number])
    : 'All Cities';
  const [sort, setSort] = useState<(typeof sortOptions)[number]>(
    search.trim() ? 'Best Match' : 'Most Popular',
  );
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const { catalog } = useCatalog();
  const { accessToken } = useAuthDialog();
  const { openPreview } = useQuickPreview();
  const filters = useMemo(() => {
    const categorySlug =
      category === 'All'
        ? undefined
        : (catalog.categories.find((c) => c.name === category)?.id ??
          catalog.events.find((e) => e.category === category)?.categorySlug ??
          category.toLowerCase());
    const sorts: Record<(typeof sortOptions)[number], EventSearchInput['sort']> = {
      'Best Match': 'relevance',
      'Most Popular': 'popular',
      'Date (Soonest)': 'date_asc',
      'Price (Low to High)': 'price_asc',
      'Price (High to Low)': 'price_desc',
    };
    return {
      q: search.trim(),
      ...(categorySlug ? { category: categorySlug } : {}),
      ...(city === 'All Cities' ? {} : { city }),
      sort: sorts[sort],
    };
  }, [search, category, city, sort, catalog.categories, catalog.events]);
  const results = useEventSearch(filters, accessToken);
  const suggestions = useEventSuggestions(filters, accessToken, suggestOpen);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section id="discover" className={ui('home-chapter chapter-discover py-14 lg:py-20')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <SectionEmblem kind="discover" />
            <h2
              data-reveal="heading"
              className={ui(
                'text-2xl lg:text-3xl font-extrabold text-ink-900 tracking-tight mt-1.5',
              )}
            >
              Moments Await
            </h2>
          </div>
          <span className={ui('text-sm text-ink-500 font-medium')}>
            {results.loading ? 'Searching…' : `${results.total} events found`}
          </span>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              className={ui('absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400')}
              size={18}
            />
            <input
              aria-label="Search events"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={suggestions.length > 0}
              aria-controls="event-search-suggestions"
              aria-activedescendant={
                activeSuggestion >= 0 && suggestions[activeSuggestion]
                  ? `event-suggestion-${activeSuggestion}`
                  : undefined
              }
              type="text"
              placeholder="Search events, venues, organizers..."
              value={search}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                if (event.target.value) next.set('q', event.target.value);
                else next.delete('q');
                void setSearchParams(next, { replace: true, preventScrollReset: true });
                if (!search.trim() && event.target.value.trim()) setSort('Best Match');
                setSuggestOpen(true);
                setActiveSuggestion(-1);
              }}
              onFocus={() => setSuggestOpen(true)}
              onBlur={() => setSuggestOpen(false)}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  setSuggestOpen(false);
                  setActiveSuggestion(-1);
                }
                if (event.key === 'ArrowDown' && suggestions.length) {
                  event.preventDefault();
                  setActiveSuggestion((value) => (value + 1) % suggestions.length);
                }
                if (event.key === 'ArrowUp' && suggestions.length) {
                  event.preventDefault();
                  setActiveSuggestion(
                    (value) => (value - 1 + suggestions.length) % suggestions.length,
                  );
                }
                if (event.key === 'Enter' && suggestions[activeSuggestion]) {
                  event.preventDefault();
                  openPreview('event', suggestions[activeSuggestion]!.id);
                  setSuggestOpen(false);
                }
              }}
              className={ui(
                'w-full h-11 pl-11 pr-4 text-sm rounded-xl border border-ink-200 bg-white text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all',
              )}
            />
            {suggestions.length > 0 && (
              <ul
                id="event-search-suggestions"
                role="listbox"
                aria-label="Event suggestions"
                className="absolute left-0 right-0 top-full z-40 mt-2 rounded-xl border border-ink-200 bg-white p-1 shadow-lg"
              >
                {suggestions.map((item, index) => (
                  <li
                    id={`event-suggestion-${index}`}
                    role="option"
                    aria-selected={activeSuggestion === index}
                    key={item.id}
                  >
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => {
                        openPreview('event', item.id);
                        setSuggestOpen(false);
                      }}
                      className={ui(
                        `w-full rounded-lg px-3 py-2 text-left text-sm ${activeSuggestion === index ? 'bg-primary-100' : 'hover:bg-ink-50'}`,
                      )}
                    >
                      <span className="block font-semibold text-ink-900">{item.title}</span>
                      <span className="block text-xs text-ink-500">
                        {item.organizer} · {item.venue}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={() => setShowFilters((prev) => !prev)}
            className={ui(
              `flex items-center gap-2 px-4 h-11 text-sm font-semibold rounded-xl border transition-all ${showFilters ? 'bg-ink-900 text-white border-ink-900' : 'bg-white text-ink-700 border-ink-200 hover:border-ink-300'}`,
            )}
          >
            <SlidersHorizontal size={16} />
            Filters
          </button>
        </div>

        {showFilters && (
          <div
            className={ui(
              'flex flex-wrap items-center gap-3 mb-6 p-4 bg-ink-50 rounded-xl animate-fade-in',
            )}
          >
            <div className={ui('flex items-center gap-2 overflow-x-auto no-scrollbar')}>
              {categoryFilters.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    onCategoryChange(cat);
                  }}
                  className={ui(
                    `px-3 py-1.5 text-sm font-semibold rounded-lg whitespace-nowrap transition-all ${category === cat ? 'bg-primary-600 text-white' : 'bg-white text-ink-600 hover:bg-ink-100 border border-ink-200'}`,
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="relative">
              <MapPin
                className={ui('absolute left-3 top-1/2 -translate-y-1/2 text-ink-400')}
                size={16}
              />
              <select
                value={city}
                onChange={(event) => {
                  const next = new URLSearchParams(searchParams);
                  if (event.target.value === 'All Cities') next.delete('city');
                  else next.set('city', event.target.value);
                  void setSearchParams(next, { preventScrollReset: true });
                }}
                className={ui(
                  'h-10 pl-9 pr-8 text-sm font-medium rounded-lg border border-ink-200 bg-white text-ink-700 focus:outline-none focus:border-primary-400 appearance-none cursor-pointer',
                )}
              >
                {cityFilters.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={ui(
                  'absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none',
                )}
                size={16}
              />
            </div>
            <div className="relative">
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as (typeof sortOptions)[number]);
                }}
                className={ui(
                  'h-10 pl-3 pr-8 text-sm font-medium rounded-lg border border-ink-200 bg-white text-ink-700 focus:outline-none focus:border-primary-400 appearance-none cursor-pointer',
                )}
              >
                {sortOptions.map((option) => (
                  <option key={option} value={option}>
                    Sort: {option}
                  </option>
                ))}
              </select>
              <ChevronDown
                className={ui(
                  'absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 pointer-events-none',
                )}
                size={16}
              />
            </div>
          </div>
        )}

        <div className={ui('grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5')}>
          {results.items.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onToggleFavorite={toggleFavorite}
              isFavorite={favorites.has(event.id)}
            />
          ))}
        </div>

        {results.degraded && (
          <p className="mt-4 text-sm text-ink-500" role="status">
            Some search features are temporarily unavailable.
          </p>
        )}
        {results.hasMore && (
          <div className="flex justify-center mt-8">
            <button
              onClick={results.loadMore}
              disabled={results.loading || results.error}
              className={ui(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-700 hover:border-primary-300 hover:text-primary-700 hover:shadow-card transition-all',
              )}
            >
              {results.loading ? 'Loading…' : 'Load more events'}
              <ChevronDown size={16} />
            </button>
          </div>
        )}

        {results.error && (
          <div className="py-6 text-center" role="alert">
            <p>Could not load events. Please try again.</p>
            <button
              type="button"
              onClick={results.retry}
              className="mt-3 font-semibold text-primary-600"
            >
              Retry search
            </button>
          </div>
        )}
        {results.loading && results.items.length === 0 && (
          <p className="py-12 text-center text-ink-500" role="status">
            Searching events…
          </p>
        )}
        {!results.loading && !results.error && results.items.length === 0 && (
          <div className="text-center py-16">
            <p className={ui('text-ink-400 font-medium')}>
              No events match your filters. Try adjusting your search.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
