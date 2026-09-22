import { ui } from '../../../../shared/styles/classes';
import { SectionEmblem } from './SectionEmblem';
import { BadgeCheck, ChevronRight } from 'lucide-react';
import { organizers } from '../../data/mockData';

export default function FeaturedOrganizers() {
  return (
    <section id="stars" className={ui('home-chapter chapter-stars py-14 lg:py-20')}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-sm font-bold text-primary-600 uppercase tracking-wide">
              Find your people
            </span>
            <SectionEmblem kind="stars" />
            <h2
              data-reveal="heading"
              className={ui(
                'text-2xl lg:text-3xl font-extrabold text-ink-900 tracking-tight mt-1.5',
              )}
            >
              Feature Stars
            </h2>
          </div>
          <button
            className={ui(
              'flex items-center gap-1 text-sm font-semibold text-ink-600 hover:text-ink-900 transition-colors',
            )}
          >
            All organizers
            <ChevronRight size={16} />
          </button>
        </div>

        <div
          className={ui('flex gap-3 overflow-x-auto no-scrollbar pb-2 -mx-4 px-4 sm:mx-0 sm:px-0')}
        >
          {organizers.map((org) => (
            <button
              data-reveal
              key={org.id}
              className={ui(
                'group flex-shrink-0 w-[200px] bg-white rounded-2xl border border-ink-100 shadow-card p-4 flex flex-col items-center text-center hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-300',
              )}
            >
              <div className="relative mb-3">
                <div
                  className={ui(
                    'w-16 h-16 rounded-full overflow-hidden ring-2 ring-ink-100 group-hover:ring-primary-200 transition-all',
                  )}
                >
                  <img
                    src={org.avatar}
                    alt={org.name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                {org.verified && (
                  <span
                    className={ui(
                      'absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-sm',
                    )}
                  >
                    <BadgeCheck size={18} className="text-primary-600 fill-primary-100" />
                  </span>
                )}
              </div>
              <h3
                className={ui(
                  'text-sm font-bold text-ink-900 mb-1 line-clamp-1 group-hover:text-primary-700 transition-colors',
                )}
              >
                {org.name}
              </h3>
              <div className={ui('flex items-center gap-2 text-xs text-ink-400')}>
                <span className="font-medium">{org.eventCount} events</span>
                <span className="w-1 h-1 rounded-full bg-ink-300" />
                <span>{org.category}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
