import { ArrowRight, ArrowUpRight, CalendarDays, MapPin, Sparkles, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { categoryLabel } from '../../../catalog/category-label';
import { formatEventDate } from '../../utils/event-time';

export default function Hero() {
  const { catalog } = useCatalog();
  const event = catalog.featuredEvents[0] ?? catalog.events[0];
  const { t, locale } = useLocale();
  return (
    <section className="home-hero relative isolate overflow-hidden">
      <div aria-hidden="true" className="home-hero-orbit motion-full:animate-ambient-drift" />
      <div className="relative mx-auto flex max-w-[1240px] flex-col items-center gap-8 px-4 py-9 sm:px-6 lg:flex-row lg:gap-14 lg:px-8 lg:py-12">
        <div className="w-full min-w-0 flex-1 motion-full:animate-reveal-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-line bg-accent-soft px-3 py-2 text-xs font-bold uppercase tracking-wider text-accent">
            <Sparkles size={14} />
            {t('Hẹn nhau ở những trải nghiệm', 'Make room for real experiences')}
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-[48px] lg:leading-[1.16]">
            {t('Ra ngoài một chút.', 'Step out.')}
            <br />
            <span className="text-accent">{t('Sống trọn một nhịp.', 'Feel every moment.')}</span>
          </h1>
          <p className="mt-4 max-w-lg text-sm leading-7 text-muted sm:text-base">
            {t(
              'Âm nhạc, nghệ thuật và những cuộc gặp đáng nhớ. Tìm sự kiện dành cho bạn, chọn vé và sẵn sàng có mặt.',
              'Music, art, and gatherings worth showing up for. Find your next event, choose your tickets, and be there.',
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/events"
              className="inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-accent px-5 py-3 text-sm font-bold text-on-accent transition hover:bg-accent-hover"
            >
              {t('Khám phá sự kiện', 'Explore events')}
              <ArrowRight size={18} />
            </Link>
            <Link
              to="/guide"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line px-5 py-3 text-sm font-semibold text-foreground hover:bg-raised"
            >
              {t('Cách đặt vé', 'How it works')}
              <ArrowUpRight size={17} />
            </Link>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs font-medium text-muted">
            <Ticket size={16} className="text-accent" />
            {t('Vé của bạn. Khoảnh khắc của bạn.', 'Your ticket. Your moment.')}
          </p>
        </div>
        {event ? (
          <Link
            to={`/events/${event.id}`}
            className="home-card group relative mx-auto block w-full max-w-[520px] flex-1 overflow-hidden rounded-3xl border border-line bg-raised shadow-elevated motion-full:animate-hero-arrive"
          >
            {event.image ? (
              <img
                src={event.image}
                alt=""
                width={680}
                height={510}
                fetchPriority="high"
                className="aspect-[4/3] w-full object-cover"
              />
            ) : (
              <div className="grid aspect-[4/3] place-items-center text-accent">
                <Ticket size={96} strokeWidth={1} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-black/20" />
            <span className="absolute left-5 top-5 rounded-full bg-surface px-3 py-2 text-xs font-bold text-foreground">
              {t('Tiêu điểm sự kiện', 'Event spotlight')}
            </span>
            <span className="absolute right-5 top-5 grid h-10 w-10 place-items-center rounded-full bg-surface text-foreground">
              <ArrowUpRight size={20} />
            </span>
            <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-white/80">
                {categoryLabel(event.category, event.categorySlug, locale)}
              </p>
              <h2 className="text-2xl font-bold leading-8 text-white sm:text-3xl">{event.title}</h2>
              <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/90">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={15} />
                  {formatEventDate(event.startsAt, locale)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin size={15} />
                  {event.city}
                </span>
              </div>
            </div>
          </Link>
        ) : (
          <div
            className="relative mx-auto grid aspect-[4/3] w-full max-w-[480px] place-items-center rounded-full border border-line bg-accent-soft"
            aria-hidden="true"
          >
            <div className="absolute inset-10 rounded-full border border-accent/20" />
            <div className="absolute inset-20 rounded-full border border-accent/20" />
            <Ticket className="-rotate-12 text-accent" size={112} strokeWidth={1} />
            <span className="absolute bottom-16 text-sm font-bold uppercase tracking-[.3em] text-accent">
              Eventix
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
