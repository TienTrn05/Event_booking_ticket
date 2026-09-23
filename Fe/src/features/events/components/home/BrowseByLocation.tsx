import { ui } from '../../../../shared/styles/classes';
import { SectionEmblem } from '../../../../shared/ui/SectionEmblem';
import { MapPin, ChevronRight } from 'lucide-react';
import { locations } from '../../data/mockData';
import { useNavigate } from 'react-router-dom';

const cityQuery: Record<string, string> = {
  'Hồ Chí Minh': 'Ho Chi Minh City',
  'Hà Nội': 'Ha Noi',
  'Đà Nẵng': 'Da Nang',
  Huế: 'Hue',
  'Hải Phòng': 'Hai Phong',
};

export default function BrowseByLocation() {
  const navigate = useNavigate();

  const selectCity = (city?: string) => {
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    void navigate(`/${query}#discover`);
  };

  return (
    <section id="locations" className={ui('home-chapter chapter-locations py-14 lg:py-20')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <SectionEmblem kind="locations" />
            <h2
              data-reveal="heading"
              className={ui(
                'text-2xl lg:text-3xl font-extrabold text-ink-900 tracking-tight mt-1.5',
              )}
            >
              Somewhere Worth Going
            </h2>
          </div>
          <button
            type="button"
            onClick={() => selectCity()}
            className={ui(
              'flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900 transition-colors',
            )}
          >
            All cities
            <ChevronRight size={16} />
          </button>
        </div>

        <div className={ui('grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4')}>
          {locations.map((loc) => (
            <button
              data-reveal
              key={loc.name}
              type="button"
              onClick={() => selectCity(cityQuery[loc.name] ?? loc.name)}
              className={ui(
                'group relative h-32 rounded-2xl overflow-hidden shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300',
              )}
            >
              <img
                src={loc.image}
                alt={loc.name}
                className={ui(
                  'absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-110',
                )}
                loading="lazy"
              />
              <div
                className={ui(
                  'absolute inset-0 bg-gradient-to-t from-ink-900/80 via-ink-900/30 to-transparent',
                )}
              />
              <div className={ui('absolute bottom-0 left-0 right-0 p-4 text-left')}>
                <div className={ui('flex items-center gap-1.5 text-white/80 text-xs mb-1')}>
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
