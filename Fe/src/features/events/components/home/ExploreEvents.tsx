import { ui } from '../../../../shared/styles/classes';
import { SectionEmblem } from '../../../../shared/ui/SectionEmblem';
import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, MapPin, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-react';
import { exploreEvents } from '../../data/mockData';
import EventCard from './DiscoveryEventCard';
import type { Event, EventCategory } from '../../types/index';

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
  'Most Popular',
  'Date (Soonest)',
  'Price (Low to High)',
  'Price (High to Low)',
] as const;
const initialEventCount = 8;

export default function ExploreEvents({
  category,
  onCategoryChange,
}: {
  category: EventCategory | 'All';
  onCategoryChange: (category: EventCategory | 'All') => void;
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedCity = searchParams.get('city');
  const [search, setSearch] = useState('');
  const city: (typeof cityFilters)[number] = cityFilters.includes(
    requestedCity as (typeof cityFilters)[number],
  )
    ? (requestedCity as (typeof cityFilters)[number])
    : 'All Cities';
  const [sort, setSort] = useState<(typeof sortOptions)[number]>('Most Popular');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filtered = useMemo(() => {
    let result: Event[] = exploreEvents.filter((event) => {
      if (category !== 'All' && event.category !== category) return false;
      if (city !== 'All Cities' && event.city !== city) return false;
      if (
        search &&
        !event.title.toLowerCase().includes(search.toLowerCase()) &&
        !event.venue.toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });

    if (sort === 'Date (Soonest)') {
      result = [...result].sort((a, b) => a.date.localeCompare(b.date));
    } else if (sort === 'Price (Low to High)') {
      result = [...result].sort((a, b) => a.startingPrice - b.startingPrice);
    } else if (sort === 'Price (High to Low)') {
      result = [...result].sort((a, b) => b.startingPrice - a.startingPrice);
    }
    return result;
  }, [search, category, city, sort]);

  const visibleEvents = showAll ? filtered : filtered.slice(0, initialEventCount);

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
            {filtered.length} events found
          </span>
        </div>

        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search
              className={ui('absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400')}
              size={18}
            />
            <input
              type="text"
              placeholder="Search events, venues, organizers..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setShowAll(false);
              }}
              className={ui(
                'w-full h-11 pl-11 pr-4 text-sm rounded-xl border border-ink-200 bg-white text-ink-800 placeholder:text-ink-400 focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all',
              )}
            />
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
                    setShowAll(false);
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
                  setShowAll(false);
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
                  setShowAll(false);
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
          {visibleEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onToggleFavorite={toggleFavorite}
              isFavorite={favorites.has(event.id)}
            />
          ))}
        </div>

        {filtered.length > initialEventCount && (
          <div className="flex justify-center mt-8">
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className={ui(
                'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-ink-200 bg-white text-sm font-bold text-ink-700 hover:border-primary-300 hover:text-primary-700 hover:shadow-card transition-all',
              )}
            >
              {showAll
                ? 'Show fewer events'
                : `Show ${filtered.length - initialEventCount} more events`}
              {showAll ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        )}

        {filtered.length === 0 && (
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
