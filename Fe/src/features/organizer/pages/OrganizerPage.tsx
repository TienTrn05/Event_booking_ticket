import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Building2, ShoppingBag } from 'lucide-react';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { organizerSchema } from '../../catalog/api/catalog.api';
import { useCatalogResource } from '../../catalog/hooks/useCatalogResource';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { EmptyState, ErrorState, Skeleton } from '../../../shared/ui/Page';
import EventCard from '../../events/components/home/DiscoveryEventCard';

export function OrganizerPage() {
  const { organizerId } = useParams();
  const { catalog } = useCatalog();
  const { accessToken } = useAuthDialog();
  const {
    data: organizer,
    loading,
    error,
    retry,
  } = useCatalogResource(
    organizerId ? `/organizers/${encodeURIComponent(organizerId)}` : null,
    organizerSchema,
    accessToken,
  );
  const { t } = useLocale();
  if (!organizer)
    return (
      <main id="main" className="mx-auto min-h-[55vh] max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <Skeleton className="h-80" />
        ) : error ? (
          <ErrorState onRetry={retry} />
        ) : (
          <EmptyState
            title={t('Không tìm thấy nhà tổ chức', 'Organizer unavailable')}
            action={
              <Link to="/#stars" className="font-semibold text-accent">
                {t('Khám phá nhà tổ chức', 'Explore organizers')}
              </Link>
            }
          />
        )}
      </main>
    );
  const events = catalog.events.filter((event) => event.organizerId === organizer.id);
  const products = catalog.merchandise.filter((product) => product.organizerId === organizer.id);
  return (
    <main id="main" className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8">
      <nav className="mb-6 flex gap-2 text-sm text-muted" aria-label={t('Đường dẫn', 'Breadcrumb')}>
        <Link to="/" className="hover:text-accent">
          {t('Trang chủ', 'Home')}
        </Link>
        <span>/</span>
        <span>{t('Nhà tổ chức', 'Organizer')}</span>
      </nav>
      <section className="relative overflow-hidden rounded-3xl border border-line bg-surface p-6 sm:p-8">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-28 h-80 w-80 rounded-full bg-accent-soft"
        />
        <div className="relative flex flex-col items-start gap-6 sm:flex-row sm:items-center">
          {organizer.avatar ? (
            <img
              src={organizer.avatar}
              alt=""
              width={128}
              height={128}
              className="h-32 w-32 shrink-0 rounded-2xl border border-line object-cover"
            />
          ) : (
            <div className="grid h-32 w-32 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent">
              <Building2 size={44} />
            </div>
          )}
          <div className="min-w-0">
            {organizer.verified && (
              <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
                <BadgeCheck size={18} />
                {t('Nhà tổ chức đã xác minh', 'Verified organizer')}
              </p>
            )}
            <h1 className="mt-3 break-words text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              {organizer.name}
            </h1>
            <p className="mt-3 text-sm text-muted">
              {organizer.category}
              {organizer.category ? ' · ' : ''}
              {t(`${organizer.eventCount} sự kiện`, `${organizer.eventCount} events`)}
            </p>
          </div>
        </div>
        {organizer.summary && (
          <p className="relative mt-6 max-w-3xl whitespace-pre-line text-base leading-8 text-muted">
            {organizer.summary}
          </p>
        )}
      </section>
      <section className="mt-10">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-2xl font-bold text-foreground">
            {t('Sự kiện trên trang khám phá', 'Events in discovery')}
          </h2>
          {organizer.upcomingEventId && (
            <Link
              to={`/events/${organizer.upcomingEventId}`}
              className="inline-flex min-h-11 items-center text-sm font-semibold text-accent"
            >
              {t('Xem sự kiện sắp tới', 'View upcoming event')}
            </Link>
          )}
        </div>
        {events.length ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={t(
              'Chưa có sự kiện trong danh sách hiện tại',
              'No events in the current discovery list',
            )}
          />
        )}
      </section>
      {products.length > 0 && (
        <section className="mt-10 rounded-2xl border border-line bg-surface p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
            <ShoppingBag size={22} className="text-accent" />
            {t('Sản phẩm từ nhà tổ chức', 'Organizer merchandise')}
          </h2>
          <p className="mt-3 text-sm text-muted">
            {t(
              `${products.length} sản phẩm trên trang khám phá.`,
              `${products.length} products in discovery.`,
            )}
          </p>
          <Link
            to={`/?organizer=${organizer.id}#merchandise`}
            className="mt-4 inline-flex min-h-11 items-center font-semibold text-accent"
          >
            {t('Xem bộ sưu tập', 'View collection')}
          </Link>
        </section>
      )}
    </main>
  );
}
