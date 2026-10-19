import { Link } from 'react-router-dom';
import { ShoppingBag, ArrowUpRight, Image } from 'lucide-react';
import { formatPrice } from '../../../../shared/utils/format';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { useLocale } from '../../../../shared/i18n/LocaleContext';
import { HorizontalRail } from '../../../../shared/ui/HorizontalRail';
import { SectionHeader } from '../../../../shared/ui/SectionHeader';
import { ExpressiveIcon } from '../../../../shared/ui/ExpressiveIcon';
import { ViewAllLink } from '../../../../shared/ui/ViewAllLink';
export default function MerchandiseSection() {
  const { catalog } = useCatalog();
  const { t } = useLocale();
  const title = t('Mang kỷ niệm về nhà', 'Take the feeling home');
  if (!catalog.merchandise.length) return null;
  return (
    <section id="merchandise" className="home-section home-merchandise">
      <div className="home-section-inner">
        <HorizontalRail
          label={title}
          density="product"
          heading={
            <SectionHeader
              title={title}
              compact
              eyebrow={t('Sản phẩm sự kiện', 'Event merchandise')}
              icon={<ExpressiveIcon icon={ShoppingBag} tone="amber" />}
            />
          }
          actions={<ViewAllLink to="/merchandise" />}
        >
          {catalog.merchandise.slice(0, 12).map((product) => (
            <Link
              data-reveal
              key={product.id}
              to={`/merchandise/${product.id}`}
              className="home-card group flex flex-col overflow-hidden rounded-2xl border border-line bg-surface"
            >
              <div className="relative aspect-square overflow-hidden bg-raised">
                {product.image ? (
                  <img
                    src={product.image}
                    alt=""
                    loading="lazy"
                    width={440}
                    height={440}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted">
                    <Image size={32} />
                  </div>
                )}
                {product.requiresTicket && (
                  <span className="absolute bottom-2 left-2 rounded-lg bg-surface px-2 py-1 text-[10px] font-semibold text-foreground">
                    {t('Cần có vé', 'Ticket required')}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <p className="truncate text-[11px] text-muted">{product.eventTitle}</p>
                <h3 className="mt-2 line-clamp-2 min-h-12 text-sm font-bold leading-6 text-foreground">
                  {product.name}
                </h3>
                <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                  <span className="text-sm font-bold tabular-nums text-foreground">
                    {formatPrice(product.price, product.currency)}
                  </span>
                  <ArrowUpRight size={17} className="shrink-0 text-accent" />
                </div>
              </div>
            </Link>
          ))}
        </HorizontalRail>
      </div>
    </section>
  );
}
