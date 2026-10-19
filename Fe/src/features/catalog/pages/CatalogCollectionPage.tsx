import { z } from 'zod';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight, Image } from 'lucide-react';
import { articleSchema, merchandiseSchema, organizerSchema } from '../api/catalog.api';
import { useCatalogResource } from '../hooks/useCatalogResource';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { OrbInput } from '../../../components/ui/animated-input';
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../../shared/ui/Page';
import { formatPrice } from '../../../shared/utils/format';

type Kind = 'merchandise' | 'organizers' | 'articles' | 'reopening';
interface CollectionItem {
  id: string;
  title: string;
  image: string;
  subtitle: string;
  description: string;
  group: string;
  href: string;
  price?: string;
  currency?: string;
}
const reopeningSchema = z.object({
  id: z.string(),
  eventTitle: z.string(),
  image: z.string(),
  organizer: z.string(),
  reason: z.string(),
  type: z.string(),
});
const schemas: Record<Kind, z.ZodType<CollectionItem[]>> = {
  merchandise: z.array(merchandiseSchema).transform((items) =>
    items.map((item) => ({
      id: item.id,
      title: item.name,
      image: item.image,
      subtitle: item.organizer,
      description: item.eventTitle,
      group: item.organizer,
      href: `/merchandise/${item.id}`,
      price: item.price,
      currency: item.currency,
    })),
  ),
  organizers: z.array(organizerSchema).transform((items) =>
    items.map((item) => ({
      id: item.id,
      title: item.name,
      image: item.avatar,
      subtitle: '',
      description: item.summary,
      group: item.category,
      href: `/organizers/${item.id}`,
    })),
  ),
  articles: z.array(articleSchema).transform((items) =>
    items.map((item) => ({
      id: item.id,
      title: item.title,
      image: item.image,
      subtitle: item.date,
      description: item.excerpt,
      group: item.category,
      href: `/blog/${item.id}`,
    })),
  ),
  reopening: z.array(reopeningSchema).transform((items) =>
    items.map((item) => ({
      id: item.id,
      title: item.eventTitle,
      image: item.image,
      subtitle: item.organizer,
      description: item.reason,
      group: item.organizer,
      href: `/reopening?request=${item.id}`,
    })),
  ),
};
const paths: Record<Kind, string> = {
  merchandise: '/merchandise',
  organizers: '/organizers',
  articles: '/articles',
  reopening: '/event-change-requests',
};
const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLocaleLowerCase();

/** Complete public collection endpoints; filters stay inside the selected collection. */
export function CatalogCollectionPage({ kind }: { kind: Kind }) {
  const { t } = useLocale();
  const { accessToken } = useAuthDialog();
  const [params, setParams] = useSearchParams();
  const resource = useCatalogResource(
    paths[kind],
    schemas[kind],
    kind === 'articles' ? null : accessToken,
  );
  const query = params.get('q') ?? '';
  const group = params.get('group') ?? '';
  const titles = {
    merchandise: t('Mang kỷ niệm về nhà', 'Take the feeling home'),
    organizers: t('Nhà tổ chức', 'Organizers'),
    articles: t('Chuyện trước giờ diễn', 'Stories before the show'),
    reopening: t('Đợt mở bán lại từ nhà tổ chức', 'Reopened sales from organizers'),
  };
  const groups = [...new Set((resource.data ?? []).map((item) => item.group).filter(Boolean))];
  const filtered = (resource.data ?? []).filter(
    (item) =>
      (!group || item.group === group) &&
      normalize(`${item.title} ${item.subtitle} ${item.description}`).includes(
        normalize(query.trim()),
      ),
  );
  const update = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    void setParams(next, { replace: name === 'q', preventScrollReset: true });
  };
  return (
    <main
      id="main"
      className="mx-auto min-h-[55vh] max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8"
      data-collection={kind}
    >
      <Link
        to="/"
        className="mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
      >
        <ArrowLeft size={16} />
        {t('Trang chủ', 'Home')}
      </Link>
      <PageHeader
        eyebrow="Eventix"
        title={titles[kind]}
        description={
          kind === 'reopening'
            ? t(
                'Các đợt bán chính thức đã được duyệt từ nhà tổ chức.',
                'Official, approved sales from event organizers.',
              )
            : t('Tìm kiếm và lọc trong bộ sưu tập này.', 'Search and filter this collection.')
        }
      />
      <div className="mb-8 grid items-center gap-4 rounded-2xl border border-line bg-surface p-4 md:grid-cols-[1fr_220px]">
        <OrbInput
          type="search"
          value={query}
          maxLength={120}
          aria-label={`${t('Tìm trong', 'Search in')} ${titles[kind]}`}
          placeholders={[`${t('Tìm trong', 'Search in')} ${titles[kind].toLocaleLowerCase()}…`]}
          onChange={(event) => update('q', event.target.value)}
        />
        <label className="space-y-2 text-sm text-muted">
          <span>
            {kind === 'merchandise' || kind === 'reopening'
              ? t('Nhà tổ chức', 'Organizer')
              : t('Chuyên mục', 'Category')}
          </span>
          <select
            value={group}
            onChange={(event) => update('group', event.target.value)}
            className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-foreground"
          >
            <option value="">{t('Tất cả', 'All')}</option>
            {[...new Set([...groups, ...(group ? [group] : [])])].map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {(query || group) && (
        <button
          type="button"
          className="mb-4 min-h-11 text-sm font-semibold text-accent"
          onClick={() => {
            const next = new URLSearchParams(params);
            next.delete('q');
            next.delete('group');
            void setParams(next);
          }}
        >
          {t('Bỏ bộ lọc', 'Clear filters')}
        </button>
      )}
      {resource.loading ? (
        <div
          role="status"
          aria-label={t('Đang tải', 'Loading')}
          className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
        >
          {[0, 1, 2].map((key) => (
            <Skeleton key={key} className="h-80" />
          ))}
        </div>
      ) : resource.error ? (
        <ErrorState onRetry={resource.retry} />
      ) : (
        <>
          <p role="status" className="mb-4 text-sm text-muted">
            {t(`${filtered.length} kết quả`, `${filtered.length} results`)}
          </p>
          {!filtered.length ? (
            <EmptyState
              title={t('Chưa có kết quả phù hợp', 'No matching results')}
              description={t(
                'Thử từ khóa khác hoặc bỏ bớt bộ lọc.',
                'Try another search or clear your filters.',
              )}
            />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <Link
                  key={item.id}
                  to={item.href}
                  className="home-card overflow-hidden rounded-2xl border border-line bg-surface"
                >
                  <div
                    className={`grid place-items-center overflow-hidden bg-raised ${kind === 'organizers' ? 'h-44 p-6' : 'aspect-[16/10]'}`}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt=""
                        loading="lazy"
                        width={640}
                        height={400}
                        className={
                          kind === 'organizers'
                            ? 'h-28 w-28 rounded-full object-cover'
                            : 'h-full w-full object-cover'
                        }
                      />
                    ) : (
                      <Image size={32} className="text-muted" />
                    )}
                  </div>
                  <div className="p-5">
                    <p className="text-xs font-semibold text-accent">{item.group}</p>
                    <h2 className="mt-2 text-lg font-bold leading-7">{item.title}</h2>
                    <p className="mt-2 text-xs text-muted">{item.subtitle}</p>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">
                      {item.description}
                    </p>
                    <span className="mt-5 flex items-center justify-between gap-2 text-sm font-bold text-accent">
                      {item.price && item.currency
                        ? formatPrice(item.price, item.currency)
                        : t('Xem chi tiết', 'View details')}
                      <ArrowUpRight size={18} />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  );
}
