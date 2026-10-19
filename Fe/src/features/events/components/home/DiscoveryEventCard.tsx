import { ArrowUpRight, CalendarDays, Image, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Event } from '../../types';
import StatusBadge from '../StatusBadge';
import { formatPrice } from '../../../../shared/utils/format';
import { useQuickPreview } from '../../../preview/hooks/useQuickPreview';
import { categoryLabel } from '../../../catalog/category-label';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { formatEventDate } from '../../utils/event-time';

export default function EventCard({
  event,
  featured = false,
}: {
  event: Event;
  featured?: boolean;
}) {
  const { openPreview } = useQuickPreview();
  const { t, locale } = useLocale();
  return (
    <article
      data-reveal
      data-event-id={event.id}
      className="home-card group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
    >
      <Link
        to={`/events/${event.id}`}
        className="relative block aspect-[4/3] overflow-hidden bg-raised"
        aria-label={t(`Xem sự kiện ${event.title}`, `View ${event.title}`)}
      >
        {event.image ? (
          <img
            src={event.image}
            alt=""
            width={640}
            height={480}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105 motion-reduced:transform-none"
          />
        ) : (
          <div className="grid h-full place-items-center text-muted">
            <Image size={40} aria-hidden="true" />
          </div>
        )}
        <span className="absolute bottom-3 left-3 rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold text-foreground">
          {categoryLabel(event.category, event.categorySlug, locale)}
        </span>
      </Link>
      <div className={`flex flex-1 flex-col ${featured ? 'p-5' : 'p-4'}`}>
        <p className="flex items-center gap-2 text-xs font-medium text-muted">
          <CalendarDays size={14} aria-hidden="true" />
          {formatEventDate(event.startsAt, locale)}
        </p>
        <h3
          className={`mt-3 line-clamp-2 min-h-12 font-bold leading-6 text-foreground ${featured ? 'text-lg' : 'text-base'}`}
        >
          <Link to={`/events/${event.id}`} className="transition hover:text-accent">
            {event.title}
          </Link>
        </h3>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <MapPin size={14} className="shrink-0" aria-hidden="true" />
          <span className="truncate">
            {event.venue}, {event.city}
          </span>
        </p>
        <div className="mt-2">
          <StatusBadge status={event.status} />
        </div>
        <div className="mt-auto pt-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs text-muted">{t('Giá vé từ', 'Tickets from')}</p>
              <p className="mt-1 font-bold tabular-nums text-foreground">
                {formatPrice(event.startingPrice, event.currency)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => openPreview('event', event.id)}
              className="grid min-h-11 min-w-11 place-items-center rounded-full border border-line text-accent transition hover:bg-accent-soft"
              aria-label={t(`Xem nhanh ${event.title}`, `Preview ${event.title}`)}
            >
              <ArrowUpRight size={20} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
