import { Calendar, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { featuredEvent } from '@/data/mockData';
import Badge from '@/components/ui/Badge';
import StatusBadge from '@/components/ui/StatusBadge';
import Button from '@/components/ui/Button';
import { formatPrice } from '@/utils/format';

export default function FeaturedEvent() {
  return (
    <section className="py-20 lg:py-28">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden shadow-elevated">
          {/* Background */}
          <div className="absolute inset-0">
            <img
              src={featuredEvent.image}
              alt={featuredEvent.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink-900/90 via-ink-900/70 to-ink-900/30" />
          </div>

          {/* Content */}
          <div className="relative z-10 p-8 sm:p-12 lg:p-16 max-w-2xl">
            <div className="flex items-center gap-2 mb-5">
              <Badge variant="primary" className="bg-primary-500 text-white">
                <Sparkles size={14} /> Featured Event
              </Badge>
              <StatusBadge status={featuredEvent.status} />
            </div>

            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight mb-5">
              {featuredEvent.title}
            </h2>

            <div className="flex flex-col gap-3 mb-8">
              <div className="flex items-center gap-2.5 text-white/90">
                <Calendar size={18} className="text-primary-300" />
                <span className="font-medium">{featuredEvent.dateLabel}</span>
              </div>
              <div className="flex items-center gap-2.5 text-white/90">
                <MapPin size={18} className="text-primary-300" />
                <span className="font-medium">
                  {featuredEvent.venue}, {featuredEvent.city}
                </span>
              </div>
            </div>

            <p className="text-white/70 text-base leading-relaxed mb-8 max-w-lg">
              An immersive live experience featuring stunning visuals, a world-class stage
              production, and the full Music of the Spheres setlist. Don't miss one of the
              most anticipated concerts of the year.
            </p>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
              <div className="flex flex-col">
                <span className="text-sm text-white/60 font-medium">Starting from</span>
                <span className="text-2xl font-bold text-white">
                  {formatPrice(featuredEvent.startingPrice, featuredEvent.currency)}
                </span>
              </div>
              <Button size="lg" className="w-full sm:w-auto">
                Get Tickets
                <ArrowRight size={18} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
