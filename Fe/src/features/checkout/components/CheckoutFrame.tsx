import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { ui } from '../../../shared/styles/classes';
import { clearMutationKeys } from '../api/checkout.api';
export const fieldClass =
  'w-full rounded-xl border border-slate-300/50 bg-transparent px-3 py-2 text-inherit';
export function CheckoutFrame({ title, children }: { title: string; children: ReactNode }) {
  const { user, openAuth } = useAuthDialog();
  const previousUser = useRef<string | null>(null);
  useEffect(() => {
    if (previousUser.current && !user) clearMutationKeys();
    previousUser.current = user?.id ?? null;
  }, [user]);
  return (
    <main id="main" className={ui('container content-page')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">{title}</h1>
        <Link to="/my-tickets" className={ui('button-outline')}>
          Vé của tôi
        </Link>
      </div>
      {user ? (
        children
      ) : (
        <div className="rounded-2xl border border-slate-300/30 p-8">
          <p className="mb-4">Đăng nhập để đặt vé và quản lý vé của bạn.</p>
          <button className={ui('button')} onClick={() => openAuth('login')}>
            Đăng nhập
          </button>
        </div>
      )}
    </main>
  );
}
export function Deadline({ expiresAt }: { expiresAt: string }) {
  const [time, setTime] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Math.floor((Date.parse(expiresAt) - time) / 1000));
  return (
    <p aria-live="off" className="font-semibold">
      {remaining
        ? `Giữ chỗ còn ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`
        : 'Giữ chỗ đã hết hạn'}
    </p>
  );
}
