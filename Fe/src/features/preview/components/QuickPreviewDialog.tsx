import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, Info, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPreviewItem } from '../data/previewCatalog';
import { useQuickPreview } from '../hooks/useQuickPreview';
import type { PreviewKind } from '../types';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { usePublicEvent } from '../../events/hooks/usePublicEvent';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { articleSchema, merchandiseSchema, organizerSchema } from '../../catalog/api/catalog.api';
import { useCatalogResource } from '../../catalog/hooks/useCatalogResource';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { EmptyState, ErrorState, Skeleton } from '../../../shared/ui/Page';
const previewKinds = new Set<PreviewKind>(['event', 'product', 'article', 'organizer', 'resale']);

export function QuickPreviewDialog() {
  const [params] = useSearchParams();
  const { closePreview } = useQuickPreview();
  const { catalog } = useCatalog();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const requestedKind = params.get('preview');
  const id = params.get('previewId');
  const kind = previewKinds.has(requestedKind as PreviewKind)
    ? (requestedKind as PreviewKind)
    : null;
  const open = Boolean(kind && id);
  const { accessToken } = useAuthDialog();
  const { t, locale } = useLocale();
  const remote = usePublicEvent(kind === 'event' ? id : null, accessToken);
  const product = useCatalogResource(
    kind === 'product' && id ? `/merchandise/${encodeURIComponent(id)}` : null,
    merchandiseSchema,
    accessToken,
  );
  const organizer = useCatalogResource(
    kind === 'organizer' && id ? `/organizers/${encodeURIComponent(id)}` : null,
    organizerSchema,
    accessToken,
  );
  const article = useCatalogResource(
    kind === 'article' && id ? `/articles/${encodeURIComponent(id)}` : null,
    articleSchema,
  );
  const item = useMemo(
    () =>
      getPreviewItem(
        {
          ...catalog,
          events: remote.event ? [remote.event] : [],
          merchandise: product.data ? [product.data] : [],
          organizers: organizer.data ? [organizer.data] : [],
          articles: article.data ? [article.data] : [],
        },
        kind,
        id,
        t,
        locale,
      ),
    [catalog, kind, id, remote.event, product.data, organizer.data, article.data, t, locale],
  );
  const request =
    kind === 'event'
      ? remote
      : kind === 'product'
        ? product
        : kind === 'organizer'
          ? organizer
          : kind === 'article'
            ? article
            : null;
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    };
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="quick-preview-title"
      onCancel={(event) => {
        event.preventDefault();
        closePreview();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            closePreview();
        }
      }}
      className="relative max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-2xl overflow-y-auto rounded-3xl border border-line bg-surface p-0 text-foreground shadow-elevated backdrop:bg-black/60 backdrop:backdrop-blur-sm"
    >
      <button
        type="button"
        onClick={closePreview}
        aria-label={t('Đóng xem nhanh', 'Close preview')}
        className="absolute right-3 top-3 z-10 grid min-h-11 min-w-11 place-items-center rounded-full border border-line bg-surface text-foreground hover:bg-raised"
        autoFocus
      >
        <X size={20} />
      </button>
      {item ? (
        <>
          {item.image && (
            <div className="max-h-72 overflow-hidden bg-raised">
              <img
                src={item.image}
                alt=""
                width={800}
                height={450}
                className="max-h-72 w-full object-contain"
              />
            </div>
          )}
          <div className="p-6 sm:p-8">
            <p className="pr-8 text-xs font-semibold uppercase tracking-widest text-accent">
              {item.eyebrow}
            </p>
            <h2
              id="quick-preview-title"
              className="mt-3 text-2xl font-bold leading-8 tracking-tight"
            >
              {item.title}
            </h2>
            <p className="mt-4 line-clamp-5 whitespace-pre-line text-sm leading-7 text-muted">
              {item.description}
            </p>
            <dl className="mt-6 space-y-4 border-y border-line py-5">
              {item.facts.map((fact) => (
                <div key={`${fact.label}-${fact.value}`} className="flex items-start gap-3">
                  <Info size={17} className="mt-0.5 shrink-0 text-accent" />
                  <div>
                    <dt className="text-xs text-muted">{fact.label}</dt>
                    <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
                  </div>
                </div>
              ))}
            </dl>
            <Link
              to={item.detailPath}
              className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              {kind === 'event'
                ? t('Xem chi tiết sự kiện', 'View event details')
                : t('Xem toàn bộ', 'View details')}
              <ArrowRight size={17} />
            </Link>
          </div>
        </>
      ) : (
        <div className="px-6 pb-6 pt-20">
          <h2 id="quick-preview-title" className="sr-only">
            {t('Xem nhanh', 'Quick preview')}
          </h2>
          {request?.loading ? (
            <Skeleton className="h-72" />
          ) : request?.error ? (
            <ErrorState onRetry={request.retry} />
          ) : (
            <EmptyState title={t('Nội dung không còn công khai', 'This content is unavailable')} />
          )}
        </div>
      )}
    </dialog>
  );
}
