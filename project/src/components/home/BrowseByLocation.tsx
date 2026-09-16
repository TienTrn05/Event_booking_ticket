import { MapPin, ChevronRight } from 'lucide-react';
import { locations } from '@/data/mockData';

export default function BrowseByLocation() {
  return (
    <section className="py-14 lg:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
              Find events near you
            </span>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-ink-900 tracking-tight mt-1.5">
              Browse by Location
            </h2>
          </div>
          <button className="flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900 transition-colors">
            All cities
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {locations.map((loc) => (
            <button
              key={loc.name}
              className="group relative h-32 rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300"
            >
              <img
                src={loc.image}
                alt={loc.name}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/30 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-left">
                <div className="flex items-center gap-1.5 text-white/80 text-xs mb-1">
                  <MapPin size={12} />
                  <span className="font-medium">{loc.eventCount} events</span>
                </div>
                <h3 className="text-lg font-bold text-white">{loc.name}</h3>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
