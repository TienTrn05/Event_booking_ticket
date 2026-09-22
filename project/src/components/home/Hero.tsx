import { Search, MapPin, Calendar, ArrowRight, Sparkles, TrendingUp } from 'lucide-react';
import Button from '@/components/ui/Button';

export default function Hero() {
  return (
    <section className="relative min-h-[680px] flex items-center overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src="https://images.pexels.com/photos/4218027/pexels-photo-4218027.jpeg?auto=compress&cs=tinysrgb&h=650&w=940"
          alt="Concert crowd"
          className="w-full h-full object-cover scale-105 animate-[slowZoom_20s_ease-in-out_infinite_alternate]"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-900/70 via-ink-900/50 to-ink-900/85" />
        <div className="absolute inset-0 bg-gradient-to-r from-ink-900/70 via-ink-900/30 to-transparent" />
        {/* Ambient color glow */}
        <div className="absolute top-1/4 right-0 w-[500px] h-[500px] rounded-full bg-primary-500/20 blur-[120px] pointer-events-none" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 w-full">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/15 mb-6 animate-fade-in">
            <span className="relative flex w-2 h-2">
              <span className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-75" />
              <span className="relative rounded-full w-2 h-2 bg-primary-400" />
            </span>
            <span className="text-sm font-medium text-white/90">Over 3,000 events live now</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-[1.05] tracking-tight text-balance mb-5 animate-slide-up">
            Find your next{' '}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-primary-300 via-sky-200 to-primary-300 bg-clip-text text-transparent">
                unforgettable
              </span>
              <span className="absolute bottom-1 left-0 right-0 h-3 bg-primary-500/30 -z-0 rounded-full blur-sm" />
            </span>{' '}
            experience
          </h1>

          <p className="text-lg text-white/80 leading-relaxed max-w-2xl mb-10 animate-slide-up" style={{ animationDelay: '100ms', animationFillMode: 'both' }}>
            Discover concerts, conferences, sports matches, workshops and festivals —
            all in one place. Book tickets in seconds and get ready to make memories.
          </p>

          {/* Search bar */}
          <div className="bg-white rounded-2xl shadow-elevated p-2 flex flex-col sm:flex-row gap-2 max-w-3xl animate-slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-ink-50 transition-colors group">
              <Search className="text-ink-400 flex-shrink-0 group-hover:text-primary-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Event keyword"
                className="w-full bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
            <div className="hidden sm:block w-px bg-ink-100" />
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-ink-50 transition-colors group">
              <MapPin className="text-ink-400 flex-shrink-0 group-hover:text-primary-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Location"
                className="w-full bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
            <div className="hidden sm:block w-px bg-ink-100" />
            <div className="flex-1 flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-ink-50 transition-colors group">
              <Calendar className="text-ink-400 flex-shrink-0 group-hover:text-primary-500 transition-colors" size={18} />
              <input
                type="text"
                placeholder="Date"
                className="w-full bg-transparent text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none"
              />
            </div>
            <Button size="md" className="sm:px-6 flex-shrink-0 hover:shadow-lg hover:shadow-primary-500/30 transition-shadow">
              <Search size={18} />
              Search
            </Button>
          </div>

          {/* Quick tags */}
          <div className="flex flex-wrap items-center gap-2 mt-6 animate-fade-in" style={{ animationDelay: '300ms', animationFillMode: 'both' }}>
            <span className="text-sm text-white/60 font-medium">Popular:</span>
            {['Concerts', 'Tech Talks', 'Football', 'Art Shows', 'Food Festivals'].map((tag) => (
              <button
                key={tag}
                className="px-3 py-1.5 text-sm text-white/90 font-medium rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/10 transition-all hover:scale-105 hover:border-white/20"
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats bar */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-ink-900/40 backdrop-blur-md border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-8 sm:gap-12">
            {[
              { value: '3,000+', label: 'Live Events', icon: Sparkles },
              { value: '1.2M', label: 'Tickets Sold', icon: TrendingUp },
              { value: '450+', label: 'Organizers', icon: ArrowRight },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="flex items-center gap-2.5 group cursor-default">
                  <Icon size={18} className="text-primary-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                  <div className="flex flex-col">
                    <span className="text-xl font-bold text-white">{stat.value}</span>
                    <span className="text-xs text-white/60 font-medium">{stat.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <a
            href="#trending"
            className="hidden sm:flex items-center gap-2 text-sm font-semibold text-white/90 hover:text-white transition-colors group"
          >
            Explore trending events
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </div>
      </div>

      {/* Keyframes for slow zoom */}
      <style>{`
        @keyframes slowZoom {
          0% { transform: scale(1.05); }
          100% { transform: scale(1.15); }
        }
      `}</style>
    </section>
  );
}
