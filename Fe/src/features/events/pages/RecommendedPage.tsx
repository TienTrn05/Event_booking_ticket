import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { eventSchema } from '../../catalog/api/catalog.api';
import { useCatalogResource } from '../../catalog/hooks/useCatalogResource';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../../shared/ui/Page';
import { OrbInput } from '../../../components/ui/animated-input';
import EventCard from '../components/home/DiscoveryEventCard';

const schema = z.object({ items: z.array(z.object({ event: eventSchema })) });
export function RecommendedPage() {
  const { accessToken, profileRevision, openAuth } = useAuthDialog();
  const { t } = useLocale();
  return accessToken ? (
    <RecommendationCollection key={`${accessToken}:${profileRevision}`} token={accessToken} />
  ) : (
    <main id="main" className="home-section-inner py-12">
      <EmptyState
        title={t('Khám phá những sự kiện hợp gu', 'Discover events picked for you')}
        action={
          <button
            type="button"
            onClick={() => openAuth('login')}
            className="min-h-11 rounded-xl bg-accent px-5 font-semibold text-on-accent"
          >
            {t('Đăng nhập', 'Sign in')}
          </button>
        }
      />
    </main>
  );
}
function RecommendationCollection({ token }: { token: string }) {
  const { t } = useLocale();
  const [params, setParams] = useSearchParams();
  const resource = useCatalogResource('/users/me/recommendations?limit=40', schema, token);
  const query = params.get('q') ?? '';
  const items = (resource.data?.items ?? []).filter(({ event }) =>
    `${event.title} ${event.organizer} ${event.venue}`
      .toLocaleLowerCase()
      .includes(query.trim().toLocaleLowerCase()),
  );
  return (
    <main id="main" className="home-section-inner py-10">
      <Link
        to="/"
        className="mb-5 inline-flex min-h-11 items-center text-sm font-semibold text-accent"
      >
        {t('Về trang chủ', 'Back to home')}
      </Link>
      <PageHeader
        title={t('Dành cho bạn', 'Picked for you')}
        description={t(
          'Tối đa 40 gợi ý theo sở thích, địa điểm và nhà tổ chức bạn quan tâm.',
          'Up to 40 suggestions based on your interests, location, and organizers you follow.',
        )}
      />
      <div className="mb-8">
        <OrbInput
          type="search"
          aria-label={t('Tìm trong gợi ý', 'Search recommendations')}
          value={query}
          maxLength={120}
          placeholders={[t('Tìm trong những gợi ý dành cho bạn…', 'Search your recommendations…')]}
          onChange={(event) => {
            const next = new URLSearchParams(params);
            if (event.target.value) next.set('q', event.target.value);
            else next.delete('q');
            void setParams(next, { replace: true, preventScrollReset: true });
          }}
        />
      </div>
      {resource.loading ? (
        <Skeleton className="h-80" />
      ) : resource.error ? (
        <ErrorState onRetry={resource.retry} />
      ) : !items.length ? (
        <EmptyState title={t('Chưa có gợi ý phù hợp', 'No matching recommendations')} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {items.map(({ event }) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </main>
  );
}
