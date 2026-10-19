import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getHomeCatalog } from '../api/catalog.api';
import { CatalogContext } from '../context/CatalogContext';
import type { HomeCatalog } from '../types';

const emptyCatalog: HomeCatalog = {
  categories: [],
  featuredEvents: [],
  events: [],
  spotlightEvents: [],
  organizers: [],
  merchandise: [],
  articles: [],
  reopeningRequests: [],
  locations: [],
};

export function CatalogProvider({ children }: { children: ReactNode }) {
  const [catalog, setCatalog] = useState<HomeCatalog | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setCatalog(null);
    setError(false);
    setRevision((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void getHomeCatalog(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) setCatalog(result);
      })
      .catch((reason: unknown) => {
        if (
          controller.signal.aborted ||
          (reason instanceof DOMException && reason.name === 'AbortError')
        )
          return;
        setError(true);
      });
    return () => controller.abort();
  }, [revision]);

  return (
    <CatalogContext.Provider
      value={{ catalog: catalog ?? emptyCatalog, loading: !catalog && !error, error, reload }}
    >
      {children}
    </CatalogContext.Provider>
  );
}
