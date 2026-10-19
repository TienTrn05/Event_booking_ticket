import { useEffect, useRef } from 'react';

import { useReducedMotion } from './useReducedMotion';

/** Content stays visible unless the observer can stage a motion preference safely. */
export function useScrollReveal() {
  const root = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  useEffect(() => {
    const container = root.current;
    if (!container || !('IntersectionObserver' in window) || reduced) return;
    const tracked = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).dataset.motion = 'visible';
            observer.unobserve(entry.target);
          }
      },
      { threshold: 0.06, rootMargin: '0px 0px 40px 0px' },
    );
    const collect = () => {
      for (const element of tracked)
        if (!container.contains(element)) {
          observer.unobserve(element);
          tracked.delete(element);
        }
      for (const element of container.querySelectorAll<HTMLElement>('[data-reveal]')) {
        if (tracked.has(element)) continue;
        tracked.add(element);
        const position = element.parentElement?.classList.contains('rail-item')
          ? element.parentElement
          : element;
        const siblings = [...(position.parentElement?.children ?? [])];
        const index = Math.max(0, siblings.indexOf(position));
        element.style.setProperty('--reveal-delay', `${Math.min(index, 3) * 60}ms`);
        element.dataset.motion = 'pending';
        observer.observe(element);
      }
    };
    collect();
    const mutations = new MutationObserver(collect);
    mutations.observe(container, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      mutations.disconnect();
      for (const element of tracked) {
        delete element.dataset.motion;
        element.style.removeProperty('--reveal-delay');
      }
    };
  }, [reduced]);
  return root;
}
