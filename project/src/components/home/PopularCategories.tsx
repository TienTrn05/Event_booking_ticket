import { Music, Cpu, Trophy, Palette, Lightbulb, PartyPopper, ArrowUpRight, type LucideIcon } from 'lucide-react';
import { categories } from '@/data/mockData';

const iconMap: Record<string, LucideIcon> = {
  Music,
  Cpu,
  Trophy,
  Palette,
  Lightbulb,
  PartyPopper,
};

export default function PopularCategories() {
  return (
    <section id="categories" className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
              Browse by interest
            </span>
            <h2 className="text-3xl lg:text-4xl font-extrabold text-ink-900 tracking-tight mt-2">
              Popular Categories
            </h2>
          </div>
          <p className="text-ink-500 max-w-sm">
            Explore events by category and find exactly what excites you — from live music to cutting-edge tech.
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.map((cat) => {
            const Icon = iconMap[cat.icon] ?? Music;
            return (
              <button
                key={cat.name}
                className="group relative bg-white rounded-2xl border border-ink-100 p-5 flex flex-col items-center gap-3 shadow-card hover:shadow-card-hover hover:-translate-y-1 transition-all duration-300 overflow-hidden"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${cat.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                <div className="relative z-10 w-14 h-14 rounded-2xl bg-ink-50 group-hover:bg-white/20 flex items-center justify-center transition-colors duration-300">
                  <Icon size={26} className="text-ink-700 group-hover:text-white transition-colors duration-300" />
                </div>
                <span className="relative z-10 text-sm font-bold text-ink-900 group-hover:text-white transition-colors duration-300">
                  {cat.name}
                </span>
                <span className="relative z-10 text-xs text-ink-400 group-hover:text-white/80 transition-colors duration-300">
                  {cat.eventCount.toLocaleString()} events
                </span>
                <ArrowUpRight
                  size={16}
                  className="relative z-10 text-ink-300 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all duration-300 absolute top-3 right-3"
                />
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
