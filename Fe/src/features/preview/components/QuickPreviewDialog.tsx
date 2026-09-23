import { useEffect, useMemo, useRef } from 'react';
import { ArrowRight, CalendarDays, Info, MapPin, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { getPreviewItem } from '../data/previewCatalog';
import { useQuickPreview } from '../hooks/useQuickPreview';
import type { PreviewKind } from '../types';

const previewKinds = new Set<PreviewKind>(['event', 'product', 'article', 'organizer', 'resale']);

export function QuickPreviewDialog() {
  const [params] = useSearchParams();
  const { closePreview } = useQuickPreview();
  const closeButton = useRef<HTMLButtonElement>(null);
  const requestedKind = params.get('preview');
  const requestedId = params.get('previewId');
  const kind = previewKinds.has(requestedKind as PreviewKind)
    ? (requestedKind as PreviewKind)
    : null;
  const item = useMemo(() => getPreviewItem(kind, requestedId), [kind, requestedId]);

  useEffect(() => {
    if (!item) return;
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
  }, [closePreview, item]);

  if (!item) return null;

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
          aria-label="Đóng xem nhanh"
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
            Xem toàn bộ <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </div>
  );
}
