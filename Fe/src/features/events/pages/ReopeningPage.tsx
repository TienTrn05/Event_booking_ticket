import { Link, useSearchParams } from 'react-router-dom';
import { FileCheck2, ArrowRight } from 'lucide-react';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { CatalogState } from '../../catalog/components/CatalogState';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { PageHeader } from '../../../shared/ui/Page';
import { CatalogCollectionPage } from '../../catalog/pages/CatalogCollectionPage';
export function ReopeningPage() {
  const [params] = useSearchParams();
  const { catalog } = useCatalog();
  const { t } = useLocale();
  const selected = catalog.reopeningRequests.find((item) => item.id === params.get('request'));
  const types: Record<string, string> = {
    CAPACITY: t('Điều chỉnh sức chứa', 'Capacity update'),
    NEW_SALE_WAVE: t('Đợt mở bán mới', 'New sales wave'),
    SALES_CONFIG: t('Điều chỉnh bán vé', 'Sales configuration'),
    RESUME_SALES: t('Mở bán trở lại', 'Resume sales'),
  };
  if (!params.has('request')) return <CatalogCollectionPage kind="reopening" />;
  return (
    <main id="main" className="mx-auto min-h-[55vh] max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Eventix"
        title={t('Đợt mở bán lại từ nhà tổ chức', 'Reopened sales from organizers')}
        description={t(
          'Các hồ sơ đã được duyệt, kèm lý do và ảnh hưởng đến sự kiện. Đây là đợt bán chính thức của nhà tổ chức.',
          'Approved requests with their reasons and impact on the event. These are official sales by event organizers.',
        )}
      />
      <CatalogState
        empty={!catalog.reopeningRequests.length}
        title={t('Chưa có đợt mở bán lại', 'No reopened sales yet')}
      />
      {selected && (
        <section className="mb-8 overflow-hidden rounded-2xl border border-line bg-surface md:grid md:grid-cols-[280px_1fr]">
          {selected.image && (
            <img
              className="h-full max-h-96 min-h-56 w-full object-cover"
              src={selected.image}
              alt=""
              width={560}
              height={600}
            />
          )}
          <div className="p-6 sm:p-8">
            <p className="inline-flex items-center gap-2 text-sm font-semibold text-accent">
              <FileCheck2 size={18} />
              {t('Hồ sơ đã duyệt', 'Approved request')}
              {' · '}
              {types[selected.type] ?? selected.type}
            </p>
            <h2 className="mt-4 text-2xl font-bold text-foreground">{selected.eventTitle}</h2>
            <p className="mt-2 text-sm text-muted">{selected.organizer}</p>
            <p className="mt-5 whitespace-pre-line leading-7 text-foreground">{selected.reason}</p>
            <p className="mt-4 whitespace-pre-line text-sm leading-7 text-muted">
              {selected.impactSummary}
            </p>
            <Link
              to={`/events/${selected.eventId}`}
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              {t('Xem sự kiện', 'View event')}
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {catalog.reopeningRequests.map((request) => (
          <Link
            key={request.id}
            to={`/reopening?request=${request.id}`}
            className="rounded-2xl border border-line bg-surface p-6 transition hover:border-accent"
          >
            <p className="text-xs font-semibold text-accent">
              {types[request.type] ?? request.type}
            </p>
            <h2 className="mt-3 text-xl font-bold text-foreground">{request.eventTitle}</h2>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{request.reason}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-accent">
              {t('Chi tiết hồ sơ', 'Request details')}
              <ArrowRight size={16} />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
