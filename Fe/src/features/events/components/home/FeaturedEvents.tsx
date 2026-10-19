import { Sparkles } from 'lucide-react';
import { ExpressiveIcon } from '../../../../shared/ui/ExpressiveIcon';
import { ViewAllLink } from '../../../../shared/ui/ViewAllLink';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { HorizontalRail } from '../../../../shared/ui/HorizontalRail';
import { SectionHeader } from '../../../../shared/ui/SectionHeader';
import { selectHomeFeatured } from '../../utils/home-curation';
import EventCard from './DiscoveryEventCard';
export default function FeaturedEvents() {
  const { catalog } = useCatalog();
  const { t } = useLocale();
  const events = selectHomeFeatured(catalog);
  const title = t('Sự kiện nổi bật', 'Featured events');
  if (!events.length) return null;
  return (
    <section id="featured" className="home-section home-featured">
      <div className="home-section-inner">
        <HorizontalRail
          label={title}
          density="featured"
          heading={
            <SectionHeader
              title={title}
              eyebrow={t('Đáng để có mặt', 'Worth showing up for')}
              icon={<ExpressiveIcon icon={Sparkles} tone="violet" />}
              description={t(
                'Những điểm hẹn nổi bật, gom trong một lựa chọn dành cho bạn.',
                'Standout experiences, brought together in one collection.',
              )}
            />
          }
          actions={<ViewAllLink to="/events?collection=featured" />}
        >
          {events.map((event) => (
            <EventCard event={event} featured key={event.id} />
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
