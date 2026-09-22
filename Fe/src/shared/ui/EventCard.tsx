import { ui } from '../styles/classes';
import { useState } from 'react';
import { Heart, MapPin, Calendar } from 'lucide-react';
import type { Event } from '../../features/events/types/index';
import Badge from './Badge';
import StatusBadge from './StatusBadge';
import { formatPrice } from '../utils/format';

interface EventCardProps {
  event: Event;
  onToggleFavorite?: (id: string) => void;
  isFavorite?: boolean;
}

export default function EventCard({ event, onToggleFavorite, isFavorite = false }: EventCardProps) {
  const [favorite, setFavorite] = useState(isFavorite);

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorite((prev) => !prev);
    onToggleFavorite?.(event.id);
  };

  return (
    <article
      data-reveal
      className={ui(
        'group bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 cursor-pointer',
      )}
    >
      <div className={ui('relative aspect-[4/3] overflow-hidden bg-ink-100')}>
        <img
          src={event.image}
          alt={event.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div
          className={ui(
            'absolute inset-0 bg-gradient-to-t from-ink-900/70 via-ink-900/5 to-transparent',
          )}
        />
        <div className={ui('absolute top-3 right-3')}>
          <button
            onClick={handleFavorite}
            aria-label="Toggle favorite"
            aria-pressed={favorite}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all hover:bg-white hover:scale-110"
          >
            <Heart
              className={ui(
                `w-4.5 h-4.5 transition-colors ${favorite ? 'fill-primary-500 text-primary-500' : 'text-ink-600'}`,
              )}
              size={18}
            />
          </button>
        </div>
        <div
          className={ui('absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2')}
        >
          <Badge variant="neutral" className={ui('bg-white/90 text-ink-800 backdrop-blur-sm')}>
            {event.category}
          </Badge>
          <StatusBadge status={event.status} />
        </div>
      </div>

      <div className={ui('p-5')}>
        <div className={ui('flex items-center gap-2 text-xs text-ink-400 mb-2')}>
          <Calendar size={14} />
          <span className="font-medium">{event.dateLabel}</span>
        </div>
        <h3
          className={ui(
            'text-base font-bold text-ink-900 leading-snug mb-2 line-clamp-2 group-hover:text-primary-700 transition-colors',
          )}
        >
          {event.title}
        </h3>
        <div className={ui('flex items-center gap-1.5 text-sm text-ink-500 mb-4')}>
          <MapPin size={14} className="flex-shrink-0" />
          <span className="truncate">
            {event.venue}, {event.city}
          </span>
        </div>
        <div className={ui('flex items-end justify-between pt-3 border-t border-ink-100')}>
          <div className="flex flex-col">
            <span className={ui('text-xs text-ink-400 font-medium')}>Starting from</span>
            <span className={ui('text-base font-bold text-ink-900')}>
              {formatPrice(event.startingPrice, event.currency)}
            </span>
          </div>
          <span className={ui('text-xs text-ink-400 font-medium')}>{event.organizer}</span>
        </div>
      </div>
    </article>
  );
}
