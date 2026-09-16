import { ui } from '../../../../shared/styles/classes';
import { ShieldCheck, Clock, MapPin, Calendar, ArrowRight, TicketCheck, Flame } from 'lucide-react';
import { resaleTickets } from '../../data/mockData';
import Badge from '../../../../shared/ui/Badge';
import Button from '../../../../shared/ui/Button';
import { formatPrice } from '../../../../shared/utils/format';

export default function ResaleTickets() {
  return (
    <section
      id="resale"
      className={ui(
        'home-chapter chapter-resale py-16 lg:py-24 bg-ink-900 relative overflow-hidden',
      )}
    >
      <div
        className={ui(
          'absolute -top-32 -right-20 w-[500px] h-[500px] rounded-full bg-primary-600/20 blur-[110px] pointer-events-none',
        )}
      />
      <div
        className={ui(
          'absolute -bottom-48 left-1/4 w-[420px] h-[420px] rounded-full bg-primary-400/10 blur-[100px] pointer-events-none',
        )}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-500/15 border border-primary-400/20 mb-4">
              <Flame size={14} className="text-primary-300 animate-pulse" />
              <span className={ui('text-xs font-bold text-primary-200 uppercase tracking-wide')}>
                One more chance
              </span>
            </div>
            <div className="flex items-center gap-4 lg:gap-6">
              <div className={ui('resale-ticket-art')} aria-hidden="true">
                <TicketCheck size={48} strokeWidth={1.4} />
                <span>
                  <ShieldCheck size={22} />
                </span>
              </div>

              <h2
                data-reveal="heading"
                className={ui(
                  'text-3xl lg:text-5xl font-extrabold text-primary-400 tracking-tight leading-tight',
                )}
              >
                Resale tickets.
              </h2>
            </div>
          </div>
        </div>
        <div
          className={ui(
            'flex gap-5 overflow-x-auto no-scrollbar pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 snap-x snap-mandatory',
          )}
        >
          {resaleTickets.map((ticket) => (
            <article
              data-reveal
              key={ticket.id}
              className={ui(
                'group flex-shrink-0 w-[310px] sm:w-[350px] bg-white rounded-2xl overflow-hidden shadow-elevated transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_20px_50px_rgba(232,93,44,0.25)] animate-slide-up snap-start',
              )}
            >
              <div className={ui('relative aspect-[16/10] overflow-hidden bg-ink-100')}>
                <img
                  src={ticket.image}
                  alt={ticket.eventTitle}
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  loading="lazy"
                />
                <div
                  className={ui(
                    'absolute inset-0 bg-gradient-to-t from-ink-900/75 via-transparent to-transparent',
                  )}
                />
                <div className={ui('absolute top-3 left-3')}>
                  <Badge variant="success" className="shadow-lg">
                    <ShieldCheck size={12} /> Verified resale
                  </Badge>
                </div>
                <div
                  className={ui(
                    'absolute bottom-3 left-3 right-3 flex items-center justify-between text-white',
                  )}
                >
                  <span className={ui('flex items-center gap-1.5 text-xs font-bold')}>
                    <Clock size={14} className="text-primary-300" />
                    {ticket.timeLeft}
                  </span>
                  <span
                    className={ui(
                      'text-[11px] font-semibold text-white/70 uppercase tracking-wide',
                    )}
                  >
                    Secondary market
                  </span>
                </div>
              </div>
              <div className={ui('p-5')}>
                <div className={ui('flex items-center gap-2 text-xs text-ink-400 mb-2')}>
                  <Calendar size={14} className="text-primary-500" />
                  <span className="font-semibold">{ticket.dateLabel}</span>
                </div>
                <h3
                  className={ui(
                    'text-base font-extrabold text-ink-900 leading-snug mb-2 line-clamp-2 group-hover:text-primary-700 transition-colors',
                  )}
                >
                  {ticket.eventTitle}
                </h3>
                <div className={ui('flex items-center gap-1.5 text-sm text-ink-500 mb-3')}>
                  <MapPin size={14} className="flex-shrink-0" />
                  <span className="truncate">
                    {ticket.venue}, {ticket.city}
                  </span>
                </div>
                <div
                  className={ui(
                    'flex items-center justify-between gap-3 bg-ink-50 rounded-xl px-3 py-2.5 mb-4',
                  )}
                >
                  <div className="min-w-0">
                    <span
                      className={ui(
                        'block text-[11px] text-ink-400 font-semibold uppercase tracking-wide',
                      )}
                    >
                      Your seat
                    </span>
                    <span className={ui('block text-xs text-ink-700 font-bold truncate')}>
                      {ticket.seatInfo}
                    </span>
                  </div>
                  {ticket.sellerVerified && (
                    <ShieldCheck size={18} className="text-emerald-500 flex-shrink-0" />
                  )}
                </div>
                <div className={ui('flex items-end justify-between pt-3 border-t border-ink-100')}>
                  <div className="flex flex-col">
                    <span className={ui('text-xs text-ink-400 font-medium line-through')}>
                      Original {formatPrice(ticket.originalPrice, ticket.currency)}
                    </span>
                    <span className={ui('text-xl font-extrabold text-primary-600')}>
                      {formatPrice(ticket.resalePrice, ticket.currency)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    className="group-hover:shadow-lg group-hover:shadow-primary-500/20"
                  >
                    Buy ticket <ArrowRight size={14} />
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
