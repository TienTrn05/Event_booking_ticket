import { useEffect, useState } from 'react';
import { z } from 'zod';
import { apiRequest } from '../../../../shared/api/client';
import { useAuthDialog } from '../../../auth/context/AuthDialogContext';
import { eventSchema } from '../../../catalog/api/catalog.api';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import EventCard from './DiscoveryEventCard';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { selectHomeFeatured } from '../../utils/home-curation';
import { HorizontalRail } from '../../../../shared/ui/HorizontalRail';
import { SectionHeader } from '../../../../shared/ui/SectionHeader';
import { HeartHandshake } from 'lucide-react';
import { ExpressiveIcon } from '../../../../shared/ui/ExpressiveIcon';
import { ViewAllLink } from '../../../../shared/ui/ViewAllLink';
const schema = z.object({
  data: z.object({
    algorithm: z.literal('RULES_V1'),
    items: z.array(
      z.object({ event: eventSchema, reasons: z.array(z.string()), score: z.number() }),
    ),
  }),
});
export default function RecommendedEvents() {
  const { accessToken, profileRevision } = useAuthDialog();
  return accessToken ? (
    <RecommendationList key={`${accessToken}:${profileRevision}`} token={accessToken} />
  ) : null;
}
function RecommendationList({ token }: { token: string }) {
  const [items, setItems] = useState<z.infer<typeof schema>['data']['items']>([]);
  const { t } = useLocale();
  const { catalog } = useCatalog();
  useEffect(() => {
    const controller = new AbortController();
    void apiRequest('/users/me/recommendations?limit=4', {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!controller.signal.aborted) setItems(schema.parse(response).data.items);
      })
      .catch(() => {
        /* Optional recommendations never replace discovery or invent results. */
      });
    return () => controller.abort();
  }, [token]);
  const excluded = new Set([
    ...selectHomeFeatured(catalog).map((event) => event.id),
    (catalog.featuredEvents[0] ?? catalog.events[0])?.id,
  ]);
  const unique = items.filter(({ event }) => !excluded.has(event.id));
  if (!unique.length) return null;
  return (
    <section className="home-section home-recommendations">
      <div className="home-section-inner">
        <HorizontalRail
          label={t('Dành cho bạn', 'Picked for you')}
          heading={
            <SectionHeader
              compact
              title={t('Dành cho bạn', 'Picked for you')}
              eyebrow={t('Thêm một chút hợp gu', 'A little more your style')}
              icon={<ExpressiveIcon icon={HeartHandshake} tone="coral" />}
              description={t(
                'Theo sở thích, địa điểm và nhà tổ chức bạn quan tâm.',
                'Based on your interests, location, and the organizers you follow.',
              )}
            />
          }
          actions={<ViewAllLink to="/for-you" />}
        >
          {unique.map(({ event }) => (
            <EventCard key={event.id} event={event} />
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
