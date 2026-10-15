import { useEffect, useMemo, useState } from 'react';
import {
  searchEvents,
  type EventSearchInput,
  type EventSearchResult,
} from '../api/event-search.api';
export function useEventSearch(
  filters: Omit<EventSearchInput, 'page' | 'pageSize'>,
  token: string | null,
) {
  const key = JSON.stringify([filters, token]);
  const [pageState, setPage] = useState({ key: '', page: 1 });
  const page = pageState.key === key ? pageState.page : 1;
  const query = useMemo(() => ({ ...filters, page, pageSize: 8 }), [filters, page]);
  const [state, setState] = useState<{
    key: string;
    filterKey: string;
    result: EventSearchResult | null;
    error: boolean;
  }>({ key: '', filterKey: '', result: null, error: false });
  const [retry, setRetry] = useState(0);
  const requestKey = key + ':' + page + ':' + retry;
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => {
        void searchEvents(query, token, controller.signal)
          .then((result) => {
            if (!controller.signal.aborted)
              setState((previous) => ({
                key: requestKey,
                filterKey: key,
                error: false,
                result: {
                  ...result,
                  items:
                    page > 1 && previous.filterKey === key && previous.result
                      ? [...previous.result.items, ...result.items]
                      : result.items,
                },
              }));
          })
          .catch(() => {
            if (!controller.signal.aborted)
              setState((previous) => ({
                key: requestKey,
                filterKey: key,
                error: true,
                result: previous.filterKey === key ? previous.result : null,
              }));
          });
      },
      page > 1 ? 0 : 350,
    );
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, token, key, requestKey, page, retry]);
  const current = state.filterKey === key ? state.result : null;
  return {
    items: current?.items ?? [],
    total: current?.total ?? 0,
    hasMore: current?.pagination.hasMore ?? false,
    degraded: current?.degraded ?? false,
    loading: state.key !== requestKey,
    error: state.key === requestKey && state.error,
    loadMore: () => setPage({ key, page: page + 1 }),
    retry: () => setRetry((value) => value + 1),
  };
}
export function useEventSuggestions(
  filters: Omit<EventSearchInput, 'page' | 'pageSize'>,
  token: string | null,
  open: boolean,
) {
  const key = JSON.stringify([filters, token]);
  const [state, setState] = useState<{ key: string; items: EventSearchResult['items'] }>({
    key: '',
    items: [],
  });
  const query = useMemo(() => ({ ...filters, page: 1, pageSize: 6 }), [filters]);
  useEffect(() => {
    if (!open || !filters.q || filters.q.length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      void searchEvents(query, token, controller.signal, true)
        .then((result) => {
          if (!controller.signal.aborted) setState({ key, items: result.items });
        })
        .catch(() => {
          if (!controller.signal.aborted) setState({ key, items: [] });
        });
    }, 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [filters.q, key, query, token, open]);
  return open && filters.q && filters.q.length >= 2 && state.key === key ? state.items : [];
}
