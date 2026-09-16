import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { trendingEvents } from '@/data/mockData';
import EventCard from '@/components/ui/EventCard';
import Button from '@/components/ui/Button';

export default function TrendingEvents() {
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
    <section id="trending" className="py-14 lg:py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
              Hot right now
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-ink-900 tracking-tight mt-2">
              Trending Events
            </h2>
          </div>
          <Button variant="outline" size="md">
            View all events
            <ArrowRight size={16} />
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {trendingEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onToggleFavorite={toggleFavorite}
              isFavorite={favorites.has(event.id)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
