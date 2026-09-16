import { ui } from '../../../shared/styles/classes';
import { Link } from 'react-router-dom';
import { categories, formatDate, formatPrice, type DiscoveryEvent } from '../data/discovery';
import { Icon } from '../../../shared/ui/Icon';
export function EventArtwork({
  event,
  className = '',
}: {
  event: DiscoveryEvent;
  className?: string;
}) {
  return (
    <div
      className={ui(
        `event-art art-${event.artwork} ${event.image ? 'has-photo' : ''} ${className}`,
      )}
      aria-hidden="true"
    >
      {event.image && (
        <img
          className={ui('event-photo')}
          src={event.image}
          alt=""
          loading="lazy"
          onError={(error) => {
            error.currentTarget.hidden = true;
          }}
        />
      )}
      <span className={ui('art-kicker')}>{event.displayName} / 2026</span>
      <span className={ui('art-shape')} />
      <strong>{event.coverTitle}</strong>
      <span className={ui('art-bottom')}>
        {event.city} <span>↗</span>
      </span>
    </div>
  );
}
export function EventCard({ event }: { event: DiscoveryEvent }) {
  return (
    <article className={ui('event-card')}>
      <Link to={`/events/${event.id}`} className={ui('event-card-link')}>
        <EventArtwork event={event} />
        <div className={ui('event-card-body')}>
          <span className={ui('category-label')}>
            {categories.find((category) => category.id === event.category)?.label}
          </span>
          <h3>{event.title}</h3>
          <p>
            <Icon name="calendar" />
            {formatDate(event.startsAt)}
            <span className="meta-dot">·</span>
            {event.city}
          </p>
          <p className={ui('event-venue')}>
            <Icon name="pin" />
            {event.venue}
          </p>
          <div className={ui('event-organizer')}>
            <span className={ui('preview-status')}>Bản xem trước</span>
            <span>{event.displayName}</span>
          </div>
          <div className={ui('card-bottom')}>
            <span>
              Từ <strong>{formatPrice(event.priceVnd)}</strong>
            </span>
            <span className={ui('card-arrow')}>
              <Icon name="arrow" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  );
}
