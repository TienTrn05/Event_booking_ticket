import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, CalendarDays, Info, MapPin, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPreviewItem } from '../data/previewCatalog';
import { useQuickPreview } from '../hooks/useQuickPreview';
import type { PreviewKind } from '../types';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { usePublicEvent } from '../../events/hooks/usePublicEvent';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';

const previewKinds = new Set<PreviewKind>(['event', 'product', 'article', 'organizer', 'resale']);

export function QuickPreviewDialog() {
  const [params] = useSearchParams();
  const { closePreview } = useQuickPreview();
  const { catalog } = useCatalog();
  const closeButton = useRef<HTMLButtonElement>(null);
  const requestedKind = params.get('preview');
  const requestedId = params.get('previewId');
  const kind = previewKinds.has(requestedKind as PreviewKind)
    ? (requestedKind as PreviewKind)
    : null;
  const { accessToken } = useAuthDialog();
  const remote = usePublicEvent(kind === 'event' ? requestedId : null, accessToken);
  const item = useMemo(
    () =>
      getPreviewItem(
        kind === 'event' ? { ...catalog, events: remote.event ? [remote.event] : [] } : catalog,
        kind,
        requestedId,
      ),
    [catalog, kind, requestedId, remote.event],
  );

  useEffect(() => {
    if (!item && kind !== 'event') return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePreview();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closePreview, item, kind]);

  if (!item)
    return kind === 'event' ? (
      <div className="quick-preview-overlay">
        <section
          className="quick-preview-dialog"
          role="dialog"
          aria-modal="true"
          aria-label="Event preview"
        >
          <button
            ref={closeButton}
            type="button"
            className="quick-preview-close"
            aria-label="Close preview"
            onClick={closePreview}
          >
            <X size={20} />
          </button>
          <p className="p-8" role="status">
            {remote.loading ? 'Loading event…' : 'This event is no longer available.'}
          </p>
        </section>
      </div>
    ) : null;

  return (
    <div
      className="quick-preview-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) closePreview();
      }}
    >
      <section
        className="quick-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-preview-title"
      >
        <button
          ref={closeButton}
          type="button"
          className="quick-preview-close"
          aria-label="Close preview"
          onClick={closePreview}
        >
          <X size={20} />
        </button>
        {item.image && (
          <div className="quick-preview-media">
            <img src={item.image} alt="" />
            <span>{item.eyebrow}</span>
          </div>
        )}
        <div className="quick-preview-copy">
          {!item.image && <span className="quick-preview-eyebrow">{item.eyebrow}</span>}
          <h2 id="quick-preview-title">{item.title}</h2>
          <p>{item.description}</p>
          <dl>
            {item.facts.map((fact, index) => (
              <div key={`${fact.label}-${fact.value}`}>
                {index === 0 ? (
                  <CalendarDays size={16} />
                ) : index === 1 ? (
                  <MapPin size={16} />
                ) : (
                  <Info size={16} />
                )}
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
          </dl>
          <Link className="quick-preview-action" to={item.detailPath}>
            {kind === 'event' ? 'View event' : 'Xem toàn bộ'} <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
