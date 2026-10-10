import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { getHomeCatalog } from '../api/catalog.api';
import { CatalogContext } from '../context/CatalogContext';
import type { HomeCatalog } from '../types';

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
      .then(setCatalog)
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return;
        setError(true);
      });
    return () => controller.abort();
  }, [revision]);

  if (error)
    return (
      <main className="reference-site grid min-h-screen place-items-center bg-home-page px-6 text-center text-home-text">
        <div>
          <h1 className="text-2xl font-extrabold">Không tải được dữ liệu sự kiện</h1>
          <p className="mt-3 text-home-muted">
            Kiểm tra API và kết nối PostgreSQL, sau đó thử lại.
          </p>
          <button
            className="mt-6 rounded-xl bg-home-button px-5 py-3 font-bold text-home-button-text"
            onClick={reload}
          >
            Thử lại
          </button>
        </div>
      </main>
    );
  if (!catalog)
    return (
      <div className="reference-site grid min-h-screen place-items-center bg-home-page text-sm font-bold text-home-muted">
        Đang tải dữ liệu sự kiện…
      </div>
    );
  return <CatalogContext.Provider value={{ catalog, reload }}>{children}</CatalogContext.Provider>;
}
