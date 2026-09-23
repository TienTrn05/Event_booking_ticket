import { ui } from '../../../../shared/styles/classes';
import { useEffect, useState } from 'react';
import { Heart, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { featuredEvents } from '../../data/mockData';
import StatusBadge from '../StatusBadge';
import { formatPrice } from '../../../../shared/utils/format';
import { SectionEmblem } from '../../../../shared/ui/SectionEmblem';
import { useQuickPreview } from '../../../preview/hooks/useQuickPreview';
export default function FeaturedEvents() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copyReady, setCopyReady] = useState(true);
  const { openPreview } = useQuickPreview();

  useEffect(() => {
    if (copyReady) return;
    const timer = window.setTimeout(() => setCopyReady(true), 340);
    return () => window.clearTimeout(timer);
  }, [copyReady, expandedId]);

  const showCard = (id: string | null) => {
    if (expandedId === id) return;
    setCopyReady(false);
    setExpandedId(id);
  };

  return (
    <section id="featured" className={ui('home-chapter featured-chapter')}>
      <div className={ui('home-container')}>
        <div className={ui('chapter-heading')}>
          <div>
            <SectionEmblem kind="featured" />

            <h2 data-reveal="fade-card">Trending</h2>
          </div>
          <a className={ui('home-link')} href="#discover">
            View all events <ArrowRight size={18} />
          </a>
        </div>
        <div
          className={ui('featured-hover-rail')}
          data-expanded={expandedId !== null}
          data-copy-ready={copyReady}
          onMouseLeave={() => showCard(null)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) showCard(null);
          }}
        >
          {featuredEvents.map((event) => (
            <article
              data-reveal="fade-card"
              data-active={expandedId === event.id}
              role="button"
              tabIndex={0}
              key={event.id}
              className={ui('spotlight-card')}
              onMouseEnter={() => showCard(event.id)}
              onFocus={() => showCard(event.id)}
              onClick={() => openPreview('event', event.id)}
              onKeyDown={(eventKey) => {
                if (eventKey.key === 'Enter' || eventKey.key === ' ') {
                  eventKey.preventDefault();
                  openPreview('event', event.id);
                }
              }}
            >
              <div className={ui('spotlight-image')}>
                <img src={event.image} alt={event.title} loading="lazy" />
                <span className={ui('spotlight-category')}>{event.category}</span>
                <button
                  className={ui('favorite-button')}
                  aria-label={'Favorite ' + event.title}
                  aria-pressed={favorites.has(event.id)}
                  onClick={(clickEvent) => {
                    clickEvent.stopPropagation();
                    setFavorites((prev) => {
                      const next = new Set(prev);
                      if (next.has(event.id)) next.delete(event.id);
                      else next.add(event.id);
                      return next;
                    });
                  }}
                >
                  <Heart size={19} fill={favorites.has(event.id) ? 'currentColor' : 'none'} />
                </button>
              </div>
              <div className={ui('spotlight-body')}>
                <p className={ui('spotlight-meta')}>
                  <Calendar size={15} />
                  {event.dateLabel}
                </p>
                <h3>{event.title}</h3>
                <p className={ui('spotlight-meta')}>
                  <MapPin size={15} />
                  <span>
                    {event.venue}, {event.city}
                  </span>
                </p>
                <div className={ui('spotlight-status')}>
                  <StatusBadge status={event.status} />
                  <span>{event.organizer}</span>
                </div>
                <div className={ui('spotlight-bottom')}>
                  <div>
                    <span className={ui('price-label')}>From</span>
                    <strong>{formatPrice(event.startingPrice, event.currency)}</strong>
                  </div>
                  <button
                    type="button"
                    className={ui('home-cta')}
                    onClick={(clickEvent) => {
                      clickEvent.stopPropagation();
                      openPreview('event', event.id);
                    }}
                  >
                    Xem nhanh <ArrowRight size={16} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
