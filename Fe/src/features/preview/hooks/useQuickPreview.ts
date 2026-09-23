import { useCallback } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { PreviewKind } from '../types';

export function useQuickPreview() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const openPreview = useCallback(
    (kind: PreviewKind, id: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('preview', kind);
      next.set('previewId', id);
      void navigate(
        { pathname: location.pathname, search: next.toString(), hash: location.hash },
        { preventScrollReset: true },
      );
    },
    [location.hash, location.pathname, navigate, searchParams],
  );

  const closePreview = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('preview');
    next.delete('previewId');
    void navigate(
      { pathname: location.pathname, search: next.toString(), hash: location.hash },
      { replace: true, preventScrollReset: true },
    );
  }, [location.hash, location.pathname, navigate, searchParams]);

  return { openPreview, closePreview };
}
