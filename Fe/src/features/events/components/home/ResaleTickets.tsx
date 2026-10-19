import { ArrowRight, FileCheck2, RotateCcw, Ticket } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { HorizontalRail } from '../../../../shared/ui/HorizontalRail';
import { SectionHeader } from '../../../../shared/ui/SectionHeader';
import { ExpressiveIcon } from '../../../../shared/ui/ExpressiveIcon';
import { ViewAllLink } from '../../../../shared/ui/ViewAllLink';
export default function ResaleTickets() {
  const { catalog } = useCatalog();
  const { t } = useLocale();
  const title = t('Một cơ hội nữa để có mặt', 'Another chance to be there');
  if (!catalog.reopeningRequests.length) return null;
  return (
    <section id="resale" className="home-section home-resale">
      <div className="home-section-inner">
        <HorizontalRail
          label={title}
          density="ticket"
          heading={
            <SectionHeader
              title={title}
              compact
              eyebrow={t('Đợt mở bán lại', 'Reopened ticket sales')}
              icon={<ExpressiveIcon icon={RotateCcw} tone="coral" />}
              description={t(
                'Các đợt mở bán bổ sung đã được duyệt từ nhà tổ chức.',
                'Additional sales approved for publication by organizers.',
              )}
            />
          }
          actions={<ViewAllLink to="/reopening" />}
        >
          {catalog.reopeningRequests.map((request) => (
            <Link
              data-reveal
              key={request.id}
              to={`/reopening?request=${request.id}`}
              className="home-ticket home-card"
              aria-label={`${t('Xem đợt mở bán lại', 'View reopened sale')}: ${request.eventTitle}`}
            >
              <div className="home-ticket-stub" aria-hidden="true">
                <Ticket size={36} strokeWidth={1.4} />
                <span className="text-center text-[10px] font-bold uppercase tracking-[.16em]">
                  {t('Hẹn lại', 'Encore')}
                </span>
                <span className="mt-2 flex h-8 gap-1">
                  {Array.from({ length: 9 }, (_, i) => (
                    <span
                      key={i}
                      className={
                        i % 3 === 0 ? 'w-0.5 bg-current opacity-40' : 'w-px bg-current opacity-40'
                      }
                    />
                  ))}
                </span>
              </div>
              <div className="min-w-0 flex-1 p-5">
                <span className="home-sticker">
                  <FileCheck2 size={13} />
                  {t('Đã duyệt', 'Approved')}
                </span>
                <h3 className="mt-4 line-clamp-2 text-base font-bold leading-6 text-foreground">
                  {request.eventTitle}
                </h3>
                <p className="mt-2 truncate text-xs text-muted">{request.organizer}</p>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-muted">{request.reason}</p>
                <span className="mt-4 inline-flex min-h-8 items-center gap-2 text-xs font-bold text-[var(--resale-accent)]">
                  {t('Chi tiết đợt bán', 'Sale details')}
                  <ArrowRight size={14} />
                </span>
              </div>
            </Link>
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
