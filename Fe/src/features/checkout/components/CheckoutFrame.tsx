import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, ShieldCheck, Ticket } from 'lucide-react';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import Button from '../../../shared/ui/Button';
import { fieldClass as sharedFieldClass } from '../../../shared/ui/Field';
import { clearMutationKeys } from '../api/checkout.api';

export const fieldClass = `${sharedFieldClass} mt-2 outline-none transition focus:border-accent focus:ring-2 focus:ring-[var(--focus)]`;
export const panelClass = 'rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6';
export const outlineLinkClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--focus)]';

export function CommerceNotice({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'error' | 'success' | 'warning';
}) {
  const colors = {
    info: 'border-line bg-raised text-foreground',
    error: 'border-[var(--negative)] bg-[var(--negative-soft)] text-[var(--negative)]',
    success: 'border-[var(--positive)] bg-[var(--positive-soft)] text-[var(--positive)]',
    warning: 'border-[var(--warning)] bg-[var(--warning-soft)] text-[var(--warning)]',
  };
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border p-4 text-sm leading-6 ${colors[tone]}`}
    >
      {children}
    </div>
  );
}

export function CheckoutSteps({ current }: { current: 1 | 2 | 3 }) {
  const { t } = useLocale();
  return (
    <ol
      aria-label={t('Các bước đặt vé', 'Booking steps')}
      className="mb-8 grid grid-cols-3 gap-2 rounded-2xl border border-line bg-surface p-3 sm:gap-5 sm:p-5"
    >
      {[
        t('Chọn vé', 'Select tickets'),
        t('Thanh toán', 'Payment'),
        t('Nhận vé', 'Your tickets'),
      ].map((label, index) => (
        <li
          key={label}
          aria-current={current === index + 1 ? 'step' : undefined}
          className={`flex items-center gap-2 text-xs font-semibold sm:text-sm ${current === index + 1 ? 'text-accent' : 'text-muted'}`}
        >
          <span
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${current >= index + 1 ? 'bg-accent-soft text-accent' : 'bg-raised text-muted'}`}
          >
            {current > index + 1 ? <Check size={16} aria-hidden="true" /> : index + 1}
          </span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function CheckoutFrame({ title, children }: { title: string; children: ReactNode }) {
  const { user, openAuth } = useAuthDialog();
  const { t } = useLocale();
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    if (previousUser.current && !user) clearMutationKeys();
    previousUser.current = user?.id ?? null;
  }, [user]);
  return (
    <main
      id="main"
      className="mx-auto min-h-[65vh] w-full max-w-[1240px] px-4 py-8 text-foreground sm:px-6 sm:py-12 lg:px-8"
    >
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            to="/"
            className="mb-4 inline-flex min-h-8 items-center gap-2 text-sm text-muted hover:text-accent"
          >
            <ArrowLeft size={16} aria-hidden="true" />
            {t('Khám phá sự kiện', 'Explore events')}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        </div>
        <Link to="/my-tickets" className={outlineLinkClass}>
          <Ticket size={17} aria-hidden="true" />
          {t('Vé của tôi', 'My tickets')}
        </Link>
      </div>
      {user ? (
        children
      ) : (
        <div className={`${panelClass} mx-auto max-w-xl py-12 text-center`}>
          <span className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent-soft text-accent">
            <ShieldCheck size={30} aria-hidden="true" />
          </span>
          <h2 className="mb-3 text-xl font-bold">
            {t('Một tài khoản, mọi cuộc hẹn', 'One account, every experience')}
          </h2>
          <p className="mx-auto mb-6 max-w-sm text-sm leading-6 text-muted">
            {t(
              'Đăng nhập để giữ chỗ, thanh toán và lưu vé của bạn an toàn trong tài khoản.',
              'Sign in to reserve, pay and keep your tickets safely in your account.',
            )}
          </p>
          <Button onClick={() => openAuth('login')}>
            {t('Đăng nhập để tiếp tục', 'Sign in to continue')}
          </Button>
        </div>
      )}
    </main>
  );
}

export function Deadline({ expiresAt }: { expiresAt: string }) {
  const [time, setTime] = useState(() => Date.now());
  const { t } = useLocale();
  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.floor((Date.parse(expiresAt) - time) / 1000));
  const clock = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`;
  return (
    <div
      aria-live="off"
      className="inline-flex items-center gap-2 rounded-lg bg-[var(--warning-soft)] px-3 py-2 text-sm font-semibold text-[var(--warning)]"
    >
      <Clock3 size={16} aria-hidden="true" />
      {remaining
        ? t(`Còn ${clock} giữ chỗ`, `${clock} left on your reservation`)
        : t('Đã hết thời gian giữ chỗ', 'Reservation expired')}
    </div>
  );
}
