import { useCatalog } from '../hooks/useCatalog';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { EmptyState, ErrorState, Skeleton } from '../../../shared/ui/Page';

/** Discovery failures never block authentication or transaction screens. */
export function CatalogState({
  empty,
  title,
  compact = false,
}: {
  empty: boolean;
  title?: string;
  compact?: boolean;
}) {
  const { loading, error, reload } = useCatalog();
  const { t } = useLocale();
  if (compact && loading)
    return (
      <p role="status" className="home-section-inner py-4 text-sm text-muted">
        {t('Đang chuẩn bị những cuộc hẹn cho bạn…', 'Getting your next experiences ready…')}
      </p>
    );
  if (compact && error)
    return (
      <div className="home-section-inner py-6">
        <ErrorState onRetry={reload} />
      </div>
    );
  if (loading)
    return (
      <div
        className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
        aria-label={t('Đang tải nội dung', 'Loading content')}
        role="status"
      >
        {[0, 1, 2, 3].map((key) => (
          <div className="overflow-hidden rounded-2xl border border-line bg-surface" key={key}>
            <Skeleton className="aspect-[4/3] rounded-none" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-6" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  if (error) return <ErrorState onRetry={reload} />;
  return empty ? (
    <EmptyState
      title={title ?? t('Chưa có nội dung được công bố', 'Nothing published yet')}
      description={t(
        'Nội dung mới sẽ xuất hiện tại đây sau khi được công bố.',
        'New content will appear here when it is published.',
      )}
    />
  ) : null;
}
