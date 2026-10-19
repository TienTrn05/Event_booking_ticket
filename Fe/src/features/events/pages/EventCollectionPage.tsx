import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import ExploreEvents from '../components/home/ExploreEvents';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { useScrollReveal } from '../../../shared/motion/useScrollReveal';

export function EventCollectionPage() {
  const [params, setParams] = useSearchParams();
  const { t } = useLocale();
  const reveal = useScrollReveal();
  return (
    <main id="main" ref={reveal} className="home-motion min-w-0">
      <div className="home-section-inner pt-8">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
        >
          <ArrowLeft size={16} />
          {t('Trang chủ', 'Home')}
        </Link>
      </div>
      <h1 className="sr-only">{t('Danh sách sự kiện', 'Event collection')}</h1>
      <ExploreEvents
        category={params.get('category') ?? 'All'}
        onCategoryChange={(value) => {
          const next = new URLSearchParams(params);
          if (value === 'All') next.delete('category');
          else next.set('category', value);
          void setParams(next, { preventScrollReset: true });
        }}
      />
    </main>
  );
}
