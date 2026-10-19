import { lazy, Suspense, useEffect, useRef, useState } from 'react';

const TextHoverEffect = lazy(() =>
  import('./hover-footer')
    .then((module) => ({ default: module.TextHoverEffect }))
    .catch(() => ({ default: StaticWordmark })),
);

function StaticWordmark({ text }: { text: string }) {
  return (
    <svg
      viewBox="0 0 800 180"
      width="800"
      height="180"
      aria-hidden="true"
      focusable="false"
      className="hover-footer-wordmark block h-auto w-full select-none"
    >
      <text
        className="hover-footer-outline"
        x="400"
        y="100"
        textAnchor="middle"
        dominantBaseline="middle"
        textLength="750"
        lengthAdjust="spacingAndGlyphs"
      >
        {text}
      </text>
    </svg>
  );
}

/** Load the optional animation as the footer approaches; keep its space reserved. */
export function FooterWordmark({ text }: { text: string }) {
  const root = useRef<HTMLDivElement>(null);
  const [enhanced, setEnhanced] = useState(false);

  useEffect(() => {
    const node = root.current;
    if (!node || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEnhanced(true);
          observer.disconnect();
        }
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={root}>
      {enhanced ? (
        <Suspense fallback={<StaticWordmark text={text} />}>
          <TextHoverEffect text={text} />
        </Suspense>
      ) : (
        <StaticWordmark text={text} />
      )}
    </div>
  );
}

export function FooterBackgroundGradient() {
  return (
    <div
      aria-hidden="true"
      className="hover-footer-background pointer-events-none absolute inset-0 -z-10"
    />
  );
}
