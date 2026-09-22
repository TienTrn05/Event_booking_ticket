import { useEffect, useRef } from 'react';

// Literal utilities let Tailwind discover every state at build time.
const revealClasses = {
  heading: '!animate-reveal-left',
  card: '!animate-reveal-scale',
} as const;
const delays = [
  '![animation-delay:0ms]',
  '![animation-delay:70ms]',
  '![animation-delay:140ms]',
  '![animation-delay:210ms]',
];

/** Reveal once per element, including cards added by filters or load-more. */
export function useScrollReveal() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = root.current;
    if (!container || !('IntersectionObserver' in window)) return;
    const tracked = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (intersections) => {
        for (const entry of intersections) {
          if (!entry.isIntersecting) continue;
          const kind =
            (entry.target as HTMLElement).dataset.reveal === 'heading' ? 'heading' : 'card';
          entry.target.classList.add(revealClasses[kind]);
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.08 },
    );
    const collect = () => {
      container.querySelectorAll<HTMLElement>('[data-reveal]').forEach((element) => {
        if (tracked.has(element)) return;
        tracked.add(element);
        const siblings = [...(element.parentElement?.children ?? [])];
        element.classList.add(
          delays[Math.min(siblings.indexOf(element), 3)]!,
          'focus-within:!animate-none',
        );
        observer.observe(element);
      });
    };
    collect();
    const mutations = new MutationObserver(collect);
    mutations.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
      for (const element of tracked)
        element.classList.remove(
          ...Object.values(revealClasses),
          ...delays,
          'focus-within:!animate-none',
        );
    };
  }, []);
  return root;
}
