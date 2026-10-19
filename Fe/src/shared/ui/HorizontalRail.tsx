import { Children, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useLocale } from '../i18n/LocaleContext';
import { isMotionReduced } from '../motion/preference';

interface HorizontalRailProps {
  label: string;
  heading?: ReactNode;
  actions?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  density?: 'featured' | 'event' | 'ticket' | 'product' | 'organizer' | 'story';
  busy?: boolean;
  resetKey?: string;
  followAppend?: boolean;
}

/** Native touch/wheel scrolling + explicit keyboard and button navigation, without a scrollbar. */
export function HorizontalRail({
  label,
  heading,
  actions,
  toolbar,
  children,
  density = 'event',
  busy = false,
  resetKey = '',
  followAppend = false,
}: HorizontalRailProps) {
  const { t } = useLocale();
  const id = useId();
  const viewport = useRef<HTMLUListElement>(null);
  const [edges, setEdges] = useState({ previous: false, next: false });
  const items = Children.toArray(children);
  const previousItems = useRef({ key: resetKey, count: items.length });
  useEffect(() => {
    const previous = previousItems.current;
    const element = viewport.current;
    if (
      followAppend &&
      !busy &&
      previous.key === resetKey &&
      previous.count > 0 &&
      items.length > previous.count &&
      element
    ) {
      const added = element.children[previous.count];
      if (added)
        element.scrollTo({
          left:
            added.getBoundingClientRect().left -
            element.getBoundingClientRect().left +
            element.scrollLeft,
          behavior: isMotionReduced() ? 'instant' : 'smooth',
        });
    }
    if (!busy) previousItems.current = { key: resetKey, count: items.length };
  }, [items.length, resetKey, followAppend, busy]);
  const measure = () => {
    const element = viewport.current;
    if (!element) return;
    const previous = element.scrollLeft > 3;
    const next = element.scrollLeft + element.clientWidth < element.scrollWidth - 3;
    setEdges((current) =>
      current.previous === previous && current.next === next ? current : { previous, next },
    );
  };
  useEffect(() => {
    const element = viewport.current;
    if (!element) return;
    let frame = requestAnimationFrame(measure);
    const resize = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    });
    resize.observe(element);
    return () => {
      resize.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [items.length]);
  useEffect(() => {
    viewport.current?.scrollTo({ left: 0, behavior: 'instant' });
  }, [resetKey]);
  const move = (direction: number) => {
    const element = viewport.current;
    if (!element) return;
    const first = element.firstElementChild;
    const step = first ? first.getBoundingClientRect().width + 20 : element.clientWidth * 0.85;
    const reduced = isMotionReduced();
    element.scrollBy({ left: direction * step, behavior: reduced ? 'instant' : 'smooth' });
  };
  return (
    <div className={`section-rail rail-${density}`}>
      <div className="section-rail-heading mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-3 sm:mb-6">
        {heading}
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {actions}
          <div
            className="flex items-center gap-2"
            aria-label={t('Điều khiển danh sách', 'List navigation')}
          >
            <button
              type="button"
              className="rail-control"
              aria-label={t(`Cuộn trái: ${label}`, `Previous: ${label}`)}
              aria-controls={id}
              disabled={!edges.previous}
              onClick={() => move(-1)}
            >
              <ArrowLeft size={17} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="rail-control"
              aria-label={t(`Cuộn phải: ${label}`, `Next: ${label}`)}
              aria-controls={id}
              disabled={!edges.next}
              onClick={() => move(1)}
            >
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {toolbar}
      <ul
        ref={viewport}
        id={id}
        aria-label={label}
        aria-busy={busy}
        className="horizontal-rail no-scrollbar"
        tabIndex={0}
        onScroll={measure}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            move(event.key === 'ArrowLeft' ? -1 : 1);
          }
          if (event.key === 'Home' || event.key === 'End') {
            event.preventDefault();
            event.currentTarget.scrollTo({
              left: event.key === 'Home' ? 0 : event.currentTarget.scrollWidth,
              behavior: isMotionReduced() ? 'instant' : 'smooth',
            });
          }
        }}
      >
        {items.map((item) => (
          <li
            key={
              typeof item === 'object' && item && 'key' in item ? String(item.key) : String(item)
            }
            className="rail-item"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
