import { useEffect, useState } from 'react';
import { z } from 'zod';
import { ApiError, apiRequest } from '../../../shared/api/client';

/** Public detail requests remain usable beyond the bounded Home catalog. */
export function useCatalogResource<T>(
  path: string | null,
  schema: z.ZodType<T>,
  token: string | null = null,
) {
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([path, token, revision]);
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: boolean;
    notFound: boolean;
  }>({ key: '', data: null, error: false, notFound: false });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    void apiRequest(path, {
      signal: controller.signal,
      ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    })
      .then((response) => {
        const data = z.object({ data: schema }).parse(response).data;
        if (!controller.signal.aborted) setState({ key, data, error: false, notFound: false });
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setState({
            key,
            data: null,
            error: !(reason instanceof ApiError && reason.status === 404),
            notFound: reason instanceof ApiError && reason.status === 404,
          });
      });
    return () => controller.abort();
  }, [path, schema, token, key]);
  return {
    data: state.key === key ? state.data : null,
    loading: Boolean(path) && state.key !== key,
    error: state.key === key && state.error,
    notFound: state.key === key && state.notFound,
    retry: () => setRevision((value) => value + 1),
  };
}
