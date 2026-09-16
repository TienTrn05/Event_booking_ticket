import { useState } from 'react';
import { Heart, MapPin, Calendar, Flame, ArrowRight, TrendingUp, Sparkles, Zap } from 'lucide-react';
import { featuredEvents } from '@/data/mockData';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';

const hotBadgeIcon: Record<string, React.ReactNode> = {
  'Hot': <Flame size={13} className="fill-current" />,
  'Trending': <TrendingUp size={13} />,
  'Editor\'s Pick': <Sparkles size={13} />,
};

const hotBadgeStyle: Record<string, string> = {
  'Hot': 'bg-gradient-to-r from-primary-500 to-primary-700 text-white shadow-lg shadow-primary-500/30',
  'Trending': 'bg-gradient-to-r from-sky-400 to-primary-600 text-white shadow-lg shadow-sky-500/30',
  'Editor\'s Pick': 'bg-gradient-to-r from-cyan-500 to-primary-700 text-white shadow-lg shadow-cyan-500/30',
};

export default function FeaturedEvents() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <section id="featured" className="signature-section py-16 lg:py-24 bg-ink-900 relative overflow-hidden">
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] rounded-full bg-primary-600/15 blur-[120px] pointer-events-none" />
      <div className="signature-grid absolute inset-0 opacity-40 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-primary-400/10 blur-[100px] pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <span className="section-index">01</span>
              <span className="h-px w-10 bg-primary-400/60" />
              <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-primary-300">Eventix signature</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/15 border border-primary-500/20 mb-3">
              <Zap size={14} className="text-primary-400" />
              <span className="text-xs font-bold text-primary-300 uppercase tracking-wide">
                Hand-picked · Selling Fast
              </span>
            </div>
            <h2 className="text-2xl lg:text-4xl font-extrabold text-white tracking-tight">
              Hot Upcoming Events
            </h2>
            <p className="text-sm text-white/50 mt-2 max-w-md">
              The events everyone is talking about. Grab yours before they're gone.
            </p>
          </div>
          <Button variant="outline" size="md" className="hidden sm:flex border-white/15 text-white hover:bg-white/10 hover:border-white/25">
            View all events
            <ArrowRight size={16} />
          </Button>
        </div>

        {/* Cards */}
        <div className="relative featured-event-rail">
          {featuredEvents.map((event, idx) => {
            const isFav = favorites.has(event.id);
            return (
              <div key={event.id} className="featured-event-slot">
                <span className="event-number" aria-hidden="true">{String(idx + 1).padStart(2, '0')}</span>
                <article
                className="featured-event-card group relative bg-white rounded-3xl overflow-hidden transition-all duration-500 hover:shadow-elevated hover:-translate-y-2 cursor-pointer animate-slide-up"
                style={{ animationDelay: `${idx * 80}ms`, animationFillMode: 'both' }}
              >
                {/* Image */}
                <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
                  <img
                    src={event.image}
                    alt={event.title}
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                    loading="lazy"
                  />
                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-ink-900/50 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* Hot badge with glow */}
                  {event.hotBadge && (
                    <div className="absolute top-3 left-3 z-10">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold rounded-full ${hotBadgeStyle[event.hotBadge]} animate-fade-in`}>
                        {hotBadgeIcon[event.hotBadge]}
                        {event.hotBadge}
                      </span>
                    </div>
                  )}

                  {/* Favorite */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite(event.id);
                    }}
                    aria-label="Toggle favorite"
                    className="absolute top-3 right-3 z-10 w-9 h-9 flex items-center justify-center rounded-full bg-white/90 backdrop-blur-sm shadow-sm transition-all hover:bg-white hover:scale-110"
                  >
                    <Heart
                      size={18}
                      className={`transition-all duration-300 ${isFav ? 'fill-primary-500 text-primary-500 scale-110' : 'text-ink-600'}`}
                    />
                  </button>

                  {/* Category */}
                  <div className="absolute bottom-3 left-3">
                    <Badge variant="neutral" className="bg-ink-900/80 backdrop-blur-sm">
                      {event.category}
                    </Badge>
                  </div>
                </div>

                {/* Body */}
                <div className="p-5">
                  <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
                    <Calendar size={14} className="text-primary-500" />
                    <span className="font-semibold">{event.dateLabel}</span>
                  </div>
                  <h3 className="text-base font-bold text-ink-900 leading-snug mb-2 line-clamp-2 group-hover:text-primary-700 transition-colors">
                    {event.title}
                  </h3>
                  <div className="flex items-center gap-1.5 text-sm text-ink-500 mb-3">
                    <MapPin size={14} className="flex-shrink-0 text-ink-400" />
                    <span className="truncate">{event.venue}, {event.city}</span>
                  </div>

                  {/* Status + organizer */}
                  <div className="flex items-center justify-between mb-3">
                    <StatusBadge status={event.status} />
                    <span className="text-xs text-ink-400 font-medium truncate ml-2">{event.organizer}</span>
                  </div>

                  {/* Price + CTA */}
                  <div className="flex items-center justify-between pt-3 border-t border-ink-100">
                    <div className="flex flex-col">
                      <span className="text-xs text-ink-400 font-medium">From</span>
                      <span className="text-lg font-extrabold text-ink-900">
                        {formatPrice(event.startingPrice, event.currency)}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="group-hover:shadow-lg group-hover:shadow-primary-500/20 transition-shadow"
                    >
                      Get Tickets
                      <ArrowRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </Button>
                  </div>
                </div>

                {/* Top accent line on hover */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary-400 to-primary-600 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />
              </article>
              </div>
            );
          })}
        </div>

        {/* Mobile view-all */}
        <div className="mt-6 sm:hidden">
          <Button variant="outline" size="md" className="w-full border-white/15 text-white hover:bg-white/10 hover:border-white/25">
            View all events
            <ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </section>
  );
}
