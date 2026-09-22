import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { officialEvents } from '@/data/mockData';
import Badge from '@/components/ui/Badge';

export default function OfficialPartnerEvents() {
  return (
    <section className="py-14 lg:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-8">
          <div>
            <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
              Trusted partnerships
            </span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-ink-900 tracking-tight mt-1.5">
              Official & Partner Events
            </h2>
          </div>
          <button className="flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900 transition-colors">
            All official events
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {officialEvents.map((event) => (
            <article
              key={event.id}
              className="group bg-white rounded-2xl border border-ink-100 shadow-card overflow-hidden transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 cursor-pointer"
            >
              <div className="relative aspect-[4/3] overflow-hidden bg-ink-100">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-3 left-3">
                  <Badge variant="neutral" className="bg-ink-900 text-white">
                    {event.badge}
                  </Badge>
                </div>
              </div>
              <div className="p-5">
                <span className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
                  {event.category}
                </span>
                <h3 className="text-base font-bold text-ink-900 leading-snug mt-1.5 mb-3 line-clamp-2 group-hover:text-primary-700 transition-colors">
                  {event.title}
                </h3>
                <div className="flex items-center gap-2 text-xs text-ink-400 mb-2">
                  <Calendar size={14} />
                  <span className="font-medium">{event.dateLabel}</span>
                </div>
                <div className="flex items-center gap-1.5 text-sm text-ink-500 mb-3">
                  <MapPin size={14} className="flex-shrink-0" />
                  <span className="truncate">{event.venue}</span>
                </div>
                <div className="pt-3 border-t border-ink-100">
                  <span className="text-xs text-ink-400 font-medium">Organizer</span>
                  <p className="text-sm font-semibold text-ink-700 mt-0.5 truncate">{event.organizer}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
