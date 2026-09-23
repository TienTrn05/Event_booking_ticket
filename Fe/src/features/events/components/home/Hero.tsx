import { ui } from '../../../../shared/styles/classes';
import { ArrowRight, ArrowUpRight, Search, MapPin, Sparkles, Calendar } from 'lucide-react';
import { featuredEvents } from '../../data/mockData';
import { useQuickPreview } from '../../../preview/hooks/useQuickPreview';
export default function Hero() {
  const event = featuredEvents[0];
  const { openPreview } = useQuickPreview();
  return (
    <section className={ui('editorial-hero')}>
      <div className={ui('hero-backdrop !animate-ambient-drift')} aria-hidden="true" />
      <div className={ui('home-container hero-editorial-grid')}>
        <div
          className={ui(
            'hero-copy [&>*]:!animate-reveal-up [&>*:nth-child(2)]:![animation-delay:80ms] [&>*:nth-child(3)]:![animation-delay:160ms] [&>*:nth-child(4)]:![animation-delay:240ms] [&>*:nth-child(5)]:![animation-delay:320ms]',
          )}
        >
          <span className={ui('hero-kicker')}>
            <span className="!animate-glow-pulse" /> Life sounds better live
          </span>
          <h1>
            Find your next
            <br />
            <em>unforgettable</em>
            <br />
            experience.
          </h1>
          <p>
            Live music, unexpected discoveries, and moments worth showing up for. Find your people.
            Be there.
          </p>
          <div className={ui('hero-actions')}>
            <a href="#discover" className={ui('home-cta')}>
              Explore events <ArrowRight size={18} />
            </a>
            <a className={ui('hero-secondary')} href="#featured">
              See what’s on <ArrowUpRight size={18} />
            </a>
          </div>
          <div className={ui('hero-note')}>
            <Sparkles size={17} />
            <span>Collect moments. Keep the feeling.</span>
          </div>
        </div>
        {event && (
          <button
            type="button"
            className={ui(
              'hero-event-preview text-left !animate-hero-arrive ![animation-delay:180ms]',
            )}
            onClick={() => openPreview('event', event.id)}
          >
            <img src={event.image} alt={event.title} />
            <div className={ui('hero-preview-top')}>
              <span>IN THE SPOTLIGHT</span>
              <ArrowUpRight size={22} />
            </div>
            <div className={ui('hero-preview-bottom')}>
              <span className={ui('hero-preview-category')}>Live music · A night to remember</span>
              <h2>{event.title}</h2>
              <p>
                <MapPin size={16} />
                {event.city}
                <span>·</span>
                <Calendar size={16} />
                {event.dateLabel.split('·')[0]}
              </p>
            </div>
          </button>
        )}
      </div>
      <div className={ui('home-container hero-discovery-strip')}>
        <span>
          <Search size={19} /> A little inspiration?
        </span>
        <a href="#featured">
          Concerts <ArrowUpRight size={14} />
        </a>
        <a href="#discover">
          Tech talks <ArrowUpRight size={14} />
        </a>
        <a href="#locations">
          Near you <MapPin size={14} />
        </a>
        <a href="#merchandise">
          Beyond the ticket <ArrowRight size={14} />
        </a>
      </div>
    </section>
  );
}
