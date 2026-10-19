import { AlertCircle, Inbox } from 'lucide-react';
import type { HTMLAttributes, ReactNode } from 'react';
import Button from './Button';
import { useLocale } from '../i18n/LocaleContext';
export function Card({ className = '', children, ...props }: HTMLAttributes<HTMLElement>) {
  return (
    <section
      {...props}
      className={`rounded-2xl border border-line bg-surface p-5 text-foreground shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow && (
          <p className="mb-2 text-xs font-bold uppercase tracking-[.14em] text-accent">{eyebrow}</p>
        )}
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-[32px]">
          {title}
        </h1>
        {description && <p className="mt-3 text-sm leading-6 text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="grid justify-items-center rounded-2xl border border-dashed border-line bg-surface px-5 py-12 text-center">
      <span className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent">
        <Inbox size={26} />
      </span>
      <h2 className="font-bold">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
export function ErrorState({
  title,
  description,
  onRetry,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
}) {
  const { t } = useLocale();
  return (
    <div
      role="alert"
      className="rounded-2xl border border-[var(--negative)] bg-[var(--negative-soft)] p-6 text-[var(--negative)]"
    >
      <div className="flex items-center gap-2">
        <AlertCircle size={20} />
        <h2 className="font-bold">{title ?? t('Chưa thể tải dữ liệu', 'Unable to load data')}</h2>
      </div>
      <p className="mt-2 text-sm">
        {description ??
          t('Vui lòng kiểm tra kết nối và thử lại.', 'Please check your connection and try again.')}
      </p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          {t('Thử lại', 'Try again')}
        </Button>
      )}
    </div>
  );
}
export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-xl bg-raised motion-reduced:animate-none ${className}`}
    />
  );
}
