import type { ReactNode } from 'react';
import { useLocale } from '../../shared/i18n/LocaleContext';
import { Sidebar } from './Sidebar';

export function SidebarLayout({
  children,
  contentId,
  className = '',
}: {
  children: ReactNode;
  contentId: string;
  className?: string;
}) {
  const { t } = useLocale();
  return (
    <div className={`app-navigation min-h-screen bg-page text-foreground ${className}`}>
      <a href={`#${contentId}`} className="skip-link">
        {t('Đến nội dung chính', 'Skip to content')}
      </a>
      <Sidebar />
      <div className="sidebar-page min-w-0">{children}</div>
    </div>
  );
}
