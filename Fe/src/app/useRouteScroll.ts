import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { scrollToHash } from '../shared/motion/scroll';

/** Keep hash navigation consistent across the home sections and detail routes. */
export function useRouteScroll() {
  const { pathname, hash, search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const followHashLink = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>('a[href^="#"]')
          : null;
      const nextHash = link?.hash;
      if (!nextHash || nextHash === '#' || !document.getElementById(nextHash.slice(1))) return;
      event.preventDefault();
      if (nextHash === hash) {
        scrollToHash(nextHash);
        return;
      }
      void navigate({ pathname, search, hash: nextHash });
    };
    document.addEventListener('click', followHashLink);
    return () => document.removeEventListener('click', followHashLink);
  }, [hash, navigate, pathname, search]);

  useEffect(() => {
    if (hash) scrollToHash(hash);
    else window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname, hash, search]);
}
