import { Link, Outlet } from 'react-router-dom';
import { ArrowLeft, LockKeyhole } from 'lucide-react';
import { useLocale } from '../../shared/i18n/LocaleContext';
import { SidebarLayout } from './SidebarLayout';

export function CheckoutLayout() {
  const { t } = useLocale();
  return (
    <SidebarLayout contentId="checkout-content">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 pt-5 sm:px-6">
        <Link
          to="/"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-muted hover:text-accent"
        >
          <ArrowLeft size={16} />
          {t('Ti?p t?c kh?m ph?', 'Back to discovery')}
        </Link>
        <span className="flex items-center gap-2 text-xs text-muted">
          <LockKeyhole size={15} />
          {t('Th?ng tin ??n ???c x?c nh?n b?i h? th?ng', 'Order status confirmed by the server')}
        </span>
      </div>
      <div id="checkout-content" tabIndex={-1}>
        <Outlet />
      </div>
    </SidebarLayout>
  );
}
