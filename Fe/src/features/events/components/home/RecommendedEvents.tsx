import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import { apiRequest } from '../../../../shared/api/client';
import { useAuthDialog } from '../../../auth/context/AuthDialogContext';
import { eventSchema } from '../../../catalog/api/catalog.api';
import { ui } from '../../../../shared/styles/classes';
const schema = z.object({
  data: z.object({
    algorithm: z.literal('RULES_V1'),
    items: z.array(
      z.object({ event: eventSchema, reasons: z.array(z.string()), score: z.number() }),
    ),
  }),
});
const labels: Record<string, string> = {
  FOLLOWING: 'Nhà tổ chức bạn theo dõi',
  CATEGORY: 'Danh mục yêu thích',
  CITY: 'Cùng thành phố',
  SOON: 'Sắp diễn ra',
  POPULAR: 'Được quan tâm',
  DISCOVERY: 'Khám phá thêm',
};
export default function RecommendedEvents() {
  const { accessToken, profileRevision } = useAuthDialog();
  return accessToken ? (
    <RecommendationList key={`${accessToken}:${profileRevision}`} token={accessToken} />
  ) : null;
}
function RecommendationList({ token }: { token: string }) {
  const [items, setItems] = useState<z.infer<typeof schema>['data']['items']>([]);
  useEffect(() => {
    let cancelled = false;
    void apiRequest('/users/me/recommendations?limit=8', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((response) => {
        if (!cancelled) setItems(schema.parse(response).data.items);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [token]);
  if (!items.length) return null;
  return (
    <section className={ui('home-chapter')}>
      <div className={ui('home-container')}>
        <div className={ui('chapter-heading')}>
          <h2>Dành cho bạn</h2>
          <p>Theo sở thích, địa điểm và nhà tổ chức bạn quan tâm.</p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))',
            gap: 20,
          }}
        >
          {items.map(({ event, reasons }) => (
            <Link
              key={event.id}
              to={`/events/${event.id}`}
              className={ui('spotlight-card')}
              style={{ display: 'block' }}
            >
              <img
                src={event.image}
                alt=""
                loading="lazy"
                style={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover' }}
              />
              <h3>{event.title}</h3>
              <p>
                {event.city} · {event.dateLabel}
              </p>
              <p>
                {reasons
                  .map((reason) => labels[reason])
                  .filter(Boolean)
                  .join(' · ') || 'Khám phá sự kiện sắp tới'}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
