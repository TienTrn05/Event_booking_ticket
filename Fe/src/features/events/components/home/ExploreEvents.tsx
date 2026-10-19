import { SectionHeader } from '../../../../shared/ui/SectionHeader';
import { Skeleton } from '../../../../shared/ui/Page';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Compass, SlidersHorizontal, SearchX, X } from 'lucide-react';
import { OrbInput } from '../../../../components/ui/animated-input';
import { useAuthDialog } from '../../../auth/context/AuthDialogContext';
import { useEventSearch, useEventSuggestions } from '../../../search/hooks/useEventSearch';
import { useQuickPreview } from '../../../preview/hooks/useQuickPreview';
import type { EventSearchInput } from '../../../search/api/event-search.api';
import EventCard from './DiscoveryEventCard';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { categoryLabel } from '../../../catalog/category-label';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { ExpressiveIcon } from '../../../../shared/ui/ExpressiveIcon';

export default function ExploreEvents({
  category,
  onCategoryChange,
}: {
  category: string;
  onCategoryChange: (value: string) => void;
}) {
  const [params, setParams] = useSearchParams();
  const { catalog } = useCatalog();
  const { t, locale } = useLocale();
  const { accessToken } = useAuthDialog();
  const { openPreview } = useQuickPreview();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [showFilters, setShowFilters] = useState(false);
  const search = params.get('q') ?? '';
  const collection = params.get('collection') === 'featured' ? 'featured' : undefined;
  const city = params.get('city') ?? '';
  const sortValue = params.get('sort') ?? (search.trim() ? 'relevance' : 'popular');
  const validSorts: EventSearchInput['sort'][] = [
    'relevance',
    'popular',
    'date_asc',
    'price_asc',
    'price_desc',
  ];
  const sort = validSorts.includes(sortValue as EventSearchInput['sort'])
    ? (sortValue as EventSearchInput['sort'])
    : 'relevance';
  const filters = useMemo<Omit<EventSearchInput, 'page' | 'pageSize'>>(
    () => ({
      q: search.trim(),
      ...(collection ? { collection } : {}),
      ...(category === 'All'
        ? {}
        : {
            category:
              catalog.categories.find(
                (item) =>
                  item.id.toLowerCase() === category.toLowerCase() || item.name === category,
              )?.id ?? category.toLowerCase(),
          }),
      ...(city ? { city } : {}),
      sort,
    }),
    [search, category, city, sort, collection, catalog.categories],
  );
  const results = useEventSearch(filters, accessToken);
  const suggestions = useEventSuggestions(filters, accessToken, suggestOpen);
  const updateParam = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    void setParams(next, { replace: name === 'q', preventScrollReset: true });
  };
  const cities = [
    ...new Set([
      ...catalog.locations.map((item) => item.queryValue),
      ...catalog.events.map((event) => event.city),
      ...(city ? [city] : []),
    ]),
  ];
  const reset = () => {
    const next = new URLSearchParams(params);
    ['q', 'category', 'city', 'sort'].forEach((key) => next.delete(key));
    void setParams(next, { preventScrollReset: true });
  };
  const control =
    'min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft';
  return (
    <section id="discover" className="home-section home-discover">
      <div className="home-section-inner">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <SectionHeader
            title={
              collection
                ? t('Sự kiện nổi bật', 'Featured events')
                : category !== 'All'
                  ? categoryLabel(
                      catalog.categories.find((item) => item.id === category)?.name ?? category,
                      category,
                      locale,
                    )
                  : t('Khám phá sự kiện', 'Discover events')
            }
            eyebrow={t('Tìm cuộc hẹn tiếp theo', 'Find your next experience')}
            icon={<ExpressiveIcon icon={Compass} />}
          />
          <p className="text-xs text-muted" role="status">
            {results.error
              ? t('Tạm thời gián đoạn', 'Temporarily unavailable')
              : results.loading
                ? t('Đang tìm…', 'Searching…')
                : t(`${results.total} sự kiện`, `${results.total} events`)}
          </p>
        </div>
        <div className="mb-3 rounded-2xl border border-line bg-surface p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <div className="relative min-w-0 flex-1">
              <OrbInput
                type="search"
                role="combobox"
                aria-label={t('Tìm sự kiện', 'Search events')}
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
                aria-controls="event-search-suggestions"
                aria-activedescendant={
                  activeSuggestion >= 0 && suggestions[activeSuggestion]
                    ? `event-suggestion-${activeSuggestion}`
                    : undefined
                }
                placeholders={[
                  t('Tìm sự kiện bạn yêu thích…', 'Find an event you will love…'),
                  t('Tìm theo nhà tổ chức…', 'Search by organizer…'),
                  t('Bạn muốn đến địa điểm nào?', 'Where would you like to go?'),
                  t('Khám phá trải nghiệm tiếp theo…', 'Discover your next experience…'),
                ]}
                value={search}
                maxLength={120}
                onChange={(event) => {
                  updateParam('q', event.target.value);
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
              />
              {suggestions.length > 0 && (
                <ul
                  id="event-search-suggestions"
                  role="listbox"
                  aria-label={t('Gợi ý sự kiện', 'Event suggestions')}
                  className="absolute inset-x-0 top-full z-40 mt-2 overflow-hidden rounded-xl border border-line bg-surface p-1 shadow-elevated"
                >
                  {suggestions.map((item, index) => (
                    <li
                      key={item.id}
                      id={`event-suggestion-${index}`}
                      role="option"
                      aria-selected={activeSuggestion === index}
                    >
                      <button
                        type="button"
                        tabIndex={-1}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          openPreview('event', item.id);
                          setSuggestOpen(false);
                        }}
                        className={`min-h-11 w-full rounded-lg px-3 py-3 text-left text-sm ${activeSuggestion === index ? 'bg-accent-soft' : 'hover:bg-raised'}`}
                      >
                        <span className="block font-semibold text-foreground">{item.title}</span>
                        <span className="block text-xs text-muted">
                          {item.organizer} · {item.venue}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              aria-label={t('Bộ lọc sự kiện', 'Event filters')}
              aria-expanded={showFilters}
              aria-controls="event-filters"
              onClick={() => setShowFilters((value) => !value)}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold ${showFilters ? 'bg-accent-soft text-accent' : 'bg-surface text-foreground hover:bg-raised'}`}
            >
              <SlidersHorizontal size={18} />
              <span className="hidden sm:inline">{t('Bộ lọc', 'Filters')}</span>
            </button>
          </div>
          <div
            id="event-filters"
            className="home-filter-panel"
            data-open={showFilters}
            inert={!showFilters}
          >
            <div className="min-h-0 overflow-hidden">
              <div className="mt-4 grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
                <label className="space-y-2 text-sm font-medium text-muted">
                  <span>{t('Thể loại', 'Category')}</span>
                  <select
                    className={control}
                    value={category}
                    onChange={(event) => onCategoryChange(event.target.value)}
                  >
                    <option value="All">{t('Tất cả thể loại', 'All categories')}</option>
                    {catalog.categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {categoryLabel(item.name, item.id, locale)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-muted">
                  <span>{t('Địa điểm', 'Location')}</span>
                  <select
                    className={control}
                    value={city}
                    onChange={(event) => updateParam('city', event.target.value)}
                  >
                    <option value="">{t('Tất cả thành phố', 'All cities')}</option>
                    {cities.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2 text-sm font-medium text-muted">
                  <span>{t('Sắp xếp theo', 'Sort by')}</span>
                  <select
                    className={control}
                    value={sort}
                    onChange={(event) => updateParam('sort', event.target.value)}
                  >
                    <option value="relevance">{t('Phù hợp nhất', 'Best match')}</option>
                    <option value="popular">{t('Được quan tâm', 'Popular')}</option>
                    <option value="date_asc">{t('Sắp diễn ra', 'Soonest')}</option>
                    <option value="price_asc">{t('Giá tăng dần', 'Price: low to high')}</option>
                    <option value="price_desc">{t('Giá giảm dần', 'Price: high to low')}</option>
                  </select>
                </label>
              </div>
            </div>
          </div>
          {(search || city || category !== 'All') && (
            <button
              type="button"
              onClick={reset}
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
            >
              <X size={16} />
              {t('Bỏ bộ lọc', 'Clear filters')}
            </button>
          )}
        </div>
        <div
          className="event-results-grid grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
          aria-busy={results.loading}
        >
          {results.items.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
          {results.loading &&
            !results.items.length &&
            [0, 1, 2, 3].map((key) => <Skeleton key={key} className="h-[390px]" />)}
        </div>
        {results.degraded && (
          <p
            className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm text-muted"
            role="status"
          >
            {t(
              'Một số khả năng tìm kiếm đang tạm gián đoạn. Kết quả có thể bị giới hạn.',
              'Some search features are temporarily unavailable. Results may be limited.',
            )}
          </p>
        )}
        {results.error && (
          <div
            className="mt-5 rounded-2xl border border-line bg-surface p-8 text-center"
            role="alert"
          >
            <p className="font-semibold text-foreground">
              {t('Không tải được sự kiện.', 'Events could not be loaded.')}
            </p>
            <button
              type="button"
              onClick={results.retry}
              className="mt-4 min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent"
            >
              {t('Thử lại', 'Try again')}
            </button>
          </div>
        )}
        {!results.loading && !results.error && !results.items.length && (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-10 text-center">
            <SearchX size={32} className="mx-auto text-muted" />
            <h3 className="mt-4 text-lg font-bold text-foreground">
              {t('Chưa tìm thấy sự kiện phù hợp', 'No matching events')}
            </h3>
            <p className="mt-2 text-sm text-muted">
              {t(
                'Thử từ khóa khác hoặc bỏ bớt bộ lọc để khám phá thêm.',
                'Try another search or clear your filters to explore more.',
              )}
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-4 min-h-11 text-sm font-semibold text-accent"
            >
              {t('Xóa tìm kiếm và bộ lọc', 'Clear search and filters')}
            </button>
          </div>
        )}
        {results.hasMore && (
          <div className="mt-3 text-center">
            <button
              type="button"
              disabled={results.loading || results.error}
              onClick={results.loadMore}
              className="min-h-11 rounded-xl border border-line bg-surface px-6 text-sm font-semibold text-foreground hover:bg-raised disabled:opacity-50"
            >
              {results.loading
                ? t('Đang tải…', 'Loading…')
                : t('Xem thêm sự kiện', 'Load more events')}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
