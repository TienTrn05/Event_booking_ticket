import { eventSchema } from '../../catalog/api/catalog.api';
import { useCatalogResource } from '../../catalog/hooks/useCatalogResource';
export function usePublicEvent(id: string | null | undefined, token: string | null) {
  const { data, ...state } = useCatalogResource(
    id ? '/events/' + encodeURIComponent(id) : null,
    eventSchema,
    token,
  );
  return { ...state, event: data };
}
