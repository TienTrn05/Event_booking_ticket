import { ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleContext';

export function ViewAllLink({ to }: { to: string }) {
  const { t } = useLocale();
  return (
    <Link
      to={to}
      className="view-all-link inline-flex min-h-11 items-center gap-2 rounded-full border border-line bg-surface px-4 text-xs font-bold text-accent hover:bg-accent-soft sm:text-sm"
    >
      {t('Xem tất cả', 'View all')}
      <ArrowUpRight size={17} aria-hidden="true" />
    </Link>
  );
}
