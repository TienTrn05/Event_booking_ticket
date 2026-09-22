import { ui } from '../../../../shared/styles/classes';
import { useState } from 'react';
import { Heart, MapPin, Calendar, ArrowRight } from 'lucide-react';
import { featuredEvents } from '../../data/mockData';
import StatusBadge from '../../../../shared/ui/StatusBadge';
import { formatPrice } from '../../../../shared/utils/format';
import { SectionEmblem } from './SectionEmblem';
export default function FeaturedEvents() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  return (
    <section id="featured" className={ui('home-chapter featured-chapter')}>
      <div className={ui('home-container')}>
        <div className={ui('chapter-heading')}>
          <div>
            <SectionEmblem kind="featured" />
            <span className={ui('chapter-eyebrow')}>Worth the hype</span>
            <h2 data-reveal="heading">Trending</h2>
            <p>Good nights become great stories.</p>
          </div>
          <a className={ui('home-link')} href="#discover">
            View all events <ArrowRight size={18} />
          </a>
        </div>
        <div className={ui('featured-hover-rail')}>
          {featuredEvents.map((event) => (
            <article data-reveal key={event.id} className={ui('spotlight-card')}>
              <div className={ui('spotlight-image')}>
                <img src={event.image} alt={event.title} loading="lazy" />
                <span className={ui('spotlight-category')}>{event.category}</span>
                <button
                  className={ui('favorite-button')}
                  aria-label={'Favorite ' + event.title}
                  aria-pressed={favorites.has(event.id)}
                  onClick={() =>
                    setFavorites((prev) => {
                      const next = new Set(prev);
                      if (next.has(event.id)) next.delete(event.id);
                      else next.add(event.id);
                      return next;
                    })
                  }
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
                  <a href="#discover" className={ui('home-cta')}>
                    Explore event <ArrowRight size={16} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
