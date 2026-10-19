import { BadgeCheck, Building2, Users } from 'lucide-react';
import { ExpressiveIcon } from '../../../../shared/ui/ExpressiveIcon';
import { ViewAllLink } from '../../../../shared/ui/ViewAllLink';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { HorizontalRail } from '../../../../shared/ui/HorizontalRail';
import { SectionHeader } from '../../../../shared/ui/SectionHeader';
export default function FeaturedOrganizers() {
  const { catalog } = useCatalog();
  const { t } = useLocale();
  const title = t('Những người tạo nên cuộc hẹn', 'The people behind the experience');
  if (!catalog.organizers.length) return null;
  return (
    <section id="stars" className="home-section home-community">
      <div className="home-section-inner">
        <HorizontalRail
          label={title}
          density="organizer"
          heading={
            <SectionHeader
              title={title}
              compact
              eyebrow={t('Nhà tổ chức', 'Organizers')}
              icon={<ExpressiveIcon icon={Users} tone="green" />}
            />
          }
          actions={<ViewAllLink to="/organizers" />}
        >
          {catalog.organizers.map((org) => (
            <Link
              data-reveal
              key={org.id}
              to={`/organizers/${org.id}`}
              className="home-card group flex min-h-28 items-center gap-4 rounded-2xl border border-line bg-surface p-4"
            >
              <div className="relative shrink-0">
                {org.avatar ? (
                  <img
                    src={org.avatar}
                    alt=""
                    loading="lazy"
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded-full border border-line object-cover"
                  />
                ) : (
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft text-accent">
                    <Building2 size={26} />
                  </span>
                )}
                {org.verified && (
                  <BadgeCheck
                    className="absolute -bottom-1 -right-1 rounded-full bg-surface text-accent"
                    size={22}
                    aria-label={t('Đã xác minh', 'Verified')}
                  />
                )}
              </div>
              <div className="min-w-0">
                <h3 className="line-clamp-2 text-sm font-bold leading-6 text-foreground">
                  {org.name}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  {t(`${org.eventCount} sự kiện`, `${org.eventCount} events`)}
                </p>
              </div>
            </Link>
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
