import { ui } from '../../../../shared/styles/classes';
import { SectionEmblem } from './SectionEmblem';
import { ArrowRight, BarChart3, Users, Ticket } from 'lucide-react';
import Button from '../../../../shared/ui/Button';

export default function OrganizerCTA() {
  return (
    <section
      id="organizers"
      className={ui(
        'home-chapter chapter-organizers py-16 lg:py-24 bg-ink-900 relative overflow-hidden',
      )}
    >
      {/* Decorative gradient */}
      <div
        className={ui(
          'absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-primary-600/20 blur-[120px] -translate-y-1/3 translate-x-1/3',
        )}
      />
      <div
        className={ui(
          'absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-primary-600/10 blur-[100px] translate-y-1/3 -translate-x-1/3',
        )}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-12">
          <div className="max-w-xl">
            <span className="text-sm font-bold text-primary-400 uppercase tracking-wide">
              For Organizers
            </span>
            <SectionEmblem kind="organizers" />
            <h2
              data-reveal="heading"
              className={ui(
                'text-3xl lg:text-5xl font-extrabold text-white tracking-tight mt-3 mb-5 leading-tight',
              )}
            >
              Every Great Night Starts with an Idea
            </h2>
            <p className="text-white/70 text-lg leading-relaxed mb-8">
              Set the stage. Bring your people together. Give them a story to take home.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Button size="lg" className="w-full sm:w-auto">
                Set the stage
                <ArrowRight size={18} />
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10 hover:border-white/30"
              >
                Learn more
              </Button>
            </div>
          </div>

          {/* Stats cards */}
          <div
            className={ui(
              'grid grid-cols-1 sm:grid-cols-3 gap-4 w-full lg:w-auto lg:flex-shrink-0',
            )}
          >
            {[
              { icon: Users, value: '1.2M+', label: 'Active buyers' },
              { icon: Ticket, value: '8.5M', label: 'Tickets sold' },
              { icon: BarChart3, value: '99.2%', label: 'Checkout success' },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  data-reveal
                  key={stat.label}
                  className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 flex flex-col gap-3 w-full sm:w-44"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-500/20 flex items-center justify-center">
                    <Icon size={20} className="text-primary-400" />
                  </div>
                  <span className={ui('text-2xl font-extrabold text-white')}>{stat.value}</span>
                  <span className="text-sm text-white/60 font-medium">{stat.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
