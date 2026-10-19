import { Compass } from 'lucide-react';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { HorizontalRail } from '../../../../shared/ui/HorizontalRail';
import { SectionHeader } from '../../../../shared/ui/SectionHeader';
import { ExpressiveIcon } from '../../../../shared/ui/ExpressiveIcon';
import { ViewAllLink } from '../../../../shared/ui/ViewAllLink';
import EventCard from './DiscoveryEventCard';

export default function HomeDiscovery() {
  const { catalog } = useCatalog();
  const { t } = useLocale();
  if (!catalog.events.length) return null;
  return (
    <section id="discover" className="home-section home-discover">
      <div className="home-section-inner">
        <HorizontalRail
          label={t('Khám phá sự kiện', 'Discover events')}
          heading={
            <SectionHeader
              title={t('Khám phá sự kiện', 'Discover events')}
              eyebrow={t('Chọn một cuộc hẹn', 'Find your next experience')}
              icon={<ExpressiveIcon icon={Compass} />}
            />
          }
          actions={<ViewAllLink to="/events" />}
        >
          {catalog.events.slice(0, 12).map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
