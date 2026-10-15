import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiRequest } from '../../../shared/api/client';
import { eventSchema } from '../../catalog/api/catalog.api';
export function usePublicEvent(id: string | null | undefined, token: string | null) {
  const key = JSON.stringify([id, token]);
  const [state, setState] = useState<{ key: string; event: z.infer<typeof eventSchema> | null }>({
    key: '',
    event: null,
  });
  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    void apiRequest('/events/' + encodeURIComponent(id), {
      signal: controller.signal,
      ...(token ? { headers: { Authorization: 'Bearer ' + token } } : {}),
    })
      .then((value) => {
        const event = z.object({ data: eventSchema }).parse(value).data;
        if (!controller.signal.aborted) setState({ key, event });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ key, event: null });
      });
    return () => controller.abort();
  }, [id, token, key]);
  return {
    event: state.key === key ? state.event : null,
    loading: Boolean(id) && state.key !== key,
  };
}
