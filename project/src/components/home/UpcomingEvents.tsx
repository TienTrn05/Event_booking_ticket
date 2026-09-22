import { useState } from 'react';
import { ArrowRight, Calendar, MapPin } from 'lucide-react';
import { upcomingEvents } from '@/data/mockData';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';
import type { Event } from '@/types';

const categoryFilters = ['All', 'Music', 'Technology', 'Sports', 'Arts', 'Workshops', 'Festivals'] as const;

export default function UpcomingEvents() {
  const [activeFilter, setActiveFilter] = useState<typeof categoryFilters[number]>('All');

  const filtered =
    activeFilter === 'All'
      ? upcomingEvents
      : upcomingEvents.filter((e) => e.category === activeFilter);

  return (
    <section className="py-14 lg:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
              Mark your calendar
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-ink-900 tracking-tight mt-2">
              Upcoming Events
            </h2>
          </div>
          <Button variant="outline" size="md">
            See all upcoming
            <ArrowRight size={16} />
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto no-scrollbar pb-1">
          {categoryFilters.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 text-sm font-semibold rounded-lg whitespace-nowrap transition-all ${
                activeFilter === filter
                  ? 'bg-ink-900 text-white'
                  : 'bg-ink-50 text-ink-600 hover:bg-ink-100'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>

        {/* Horizontal event list */}
        <div className="flex gap-5 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          {filtered.map((event: Event) => (
            <article
              key={event.id}
              className="group flex-shrink-0 w-[320px] sm:w-[380px] bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 cursor-pointer"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-ink-100">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="neutral">{event.category}</Badge>
                </div>
                <div className="absolute bottom-3 right-3">
                  <StatusBadge status={event.status} />
                </div>
              </div>
              <div className="p-5">
                <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
                  <Calendar size={14} />
                  <span className="font-medium">{event.dateLabel}</span>
                </div>
                <h3 className="text-base font-bold text-ink-900 leading-snug mb-2 line-clamp-1 group-hover:text-primary-700 transition-colors">
                  {event.title}
                </h3>
                <div className="flex items-center gap-1.5 text-sm text-ink-500 mb-4">
                  <MapPin size={14} className="flex-shrink-0" />
                  <span className="truncate">
                    {event.venue}, {event.city}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-ink-100">
                  <div className="flex flex-col">
                    <span className="text-xs text-ink-400 font-medium">From</span>
                    <span className="text-sm font-bold text-ink-900">
                      {formatPrice(event.startingPrice, event.currency)}
                    </span>
                  </div>
                  <Button variant="ghost" size="sm">
                    View details
                    <ArrowRight size={14} />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
