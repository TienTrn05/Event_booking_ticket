import { Link } from 'react-router-dom';
import { useLocale } from '../i18n/LocaleContext';

export function Brand({ compact = false }: { compact?: boolean }) {
  const { t } = useLocale();
  return (
    <Link
      to="/"
      data-brand-home
      aria-label={t('Eventix — Trang chủ', 'Eventix — Home')}
      className="inline-flex shrink-0 items-center gap-2.5 rounded-xl text-foreground"
    >
      <span className="brand-image" aria-hidden="true">
        <img src="/logo.png" alt="" width="48" height="48" />
      </span>
      {!compact && (
        <span className="brand-wordmark max-[380px]:hidden">
          <strong className="block text-2xl font-extrabold leading-none tracking-[-1px]">
            eventix<span className="text-accent">.</span>
          </strong>
          <span className="mt-1 block text-[10px] font-semibold tracking-wide text-muted">
            {t('Chạm vào trải nghiệm', 'Find your next moment')}
          </span>
        </span>
      )}
    </Link>
  );
}
