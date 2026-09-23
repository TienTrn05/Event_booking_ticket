import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole, Mail, Phone, Ticket, X } from 'lucide-react';
import { AuthDialogContext } from '../context/AuthDialogContext';
import type { AuthIntent } from '../context/AuthDialogContext';

type AuthMode = 'login' | 'register';

const contextCopy: Record<AuthIntent, string> = {
  login: 'Đăng nhập để tiếp tục trải nghiệm cùng Eventix.',
  register: 'Tạo tài khoản để lưu vé và theo dõi những sự kiện bạn yêu thích.',
  tickets: 'Đăng nhập để xem vé và đơn hàng của bạn.',
  organizer:
    'Dùng email công ty để đăng ký tổ chức. Tài khoản cần được Admin duyệt trước khi quản lý sự kiện.',
  checkout: 'Đăng nhập trước khi giữ chỗ hoặc mua vé.',
};

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [localDialog, setLocalDialog] = useState<{
    intent: AuthIntent;
    mode: AuthMode;
    locationKey: string;
  } | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lastFocused = useRef<HTMLElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const requestedIntent = (location.state as { authIntent?: AuthIntent } | null)?.authIntent;
  const routeIntent = requestedIntent && requestedIntent in contextCopy ? requestedIntent : null;
  const activeDialog = localDialog?.locationKey === location.key ? localDialog : null;
  const intent = activeDialog?.intent ?? routeIntent;
  const mode = activeDialog?.mode ?? (routeIntent === 'register' ? 'register' : 'login');

  const openAuth = (nextIntent: AuthIntent) => {
    lastFocused.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setLocalDialog({
      intent: nextIntent,
      mode: nextIntent === 'register' ? 'register' : 'login',
      locationKey: location.key,
    });
  };

  const closeAuth = useCallback(() => {
    setLocalDialog(null);
    lastFocused.current?.focus();
    if (routeIntent) {
      void navigate(`${location.pathname}${location.search}${location.hash}`, {
        replace: true,
        state: null,
      });
    }
  }, [location.hash, location.pathname, location.search, navigate, routeIntent]);

  const selectMode = (nextMode: AuthMode) => {
    if (intent) setLocalDialog({ intent, mode: nextMode, locationKey: location.key });
  };

  useEffect(() => {
    if (!intent) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeAuth();
      if (event.key !== 'Tab') return;
      const dialog = document.getElementById('eventix-auth-dialog');
      const focusable = Array.from(
        dialog?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), a[href]',
        ) ?? [],
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [intent, closeAuth]);

  return (
    <AuthDialogContext.Provider value={{ openAuth }}>
      {children}
      {intent && (
        <div
          className="auth-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeAuth();
          }}
        >
          <section
            id="eventix-auth-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="eventix-auth-title"
            aria-describedby="eventix-auth-description"
            className="auth-dialog"
          >
            <button
              ref={closeButton}
              type="button"
              className="auth-close"
              aria-label="Đóng"
              onClick={closeAuth}
            >
              <X size={20} />
            </button>
            <span className="auth-emblem">
              <Ticket size={21} />
            </span>
            <p className="auth-eyebrow">EVENTIX ACCOUNT</p>
            <h2 id="eventix-auth-title">
              {intent === 'organizer'
                ? 'Dành cho nhà tổ chức'
                : mode === 'login'
                  ? 'Chào mừng trở lại'
                  : 'Bắt đầu cùng Eventix'}
            </h2>
            <p id="eventix-auth-description" className="auth-description">
              {intent !== 'organizer' && mode === 'register'
                ? contextCopy.register
                : contextCopy[intent]}
            </p>
            {intent !== 'organizer' && (
              <div className="auth-tabs" role="tablist" aria-label="Tài khoản">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'login'}
                  onClick={() => selectMode('login')}
                >
                  Đăng nhập
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'register'}
                  onClick={() => selectMode('register')}
                >
                  Đăng ký
                </button>
              </div>
            )}
            <label className="auth-label" htmlFor="auth-identity">
              {intent === 'organizer' ? 'Email công ty' : 'Số điện thoại'}
            </label>
            <div className="auth-input-wrap">
              {intent === 'organizer' ? <Mail size={18} /> : <Phone size={18} />}
              <input
                id="auth-identity"
                type={intent === 'organizer' ? 'email' : 'tel'}
                autoComplete={intent === 'organizer' ? 'email' : 'tel'}
                inputMode={intent === 'organizer' ? 'email' : 'tel'}
                placeholder={intent === 'organizer' ? 'ten@congty.vn' : 'Nhập số điện thoại'}
              />
            </div>
            <button type="button" className="auth-primary" disabled>
              {intent === 'organizer' ? 'Tiếp tục với email công ty' : 'Tiếp tục với mã xác thực'}
              <ArrowRight size={17} />
            </button>
            <div className="auth-separator">
              <span>hoặc</span>
            </div>
            <button type="button" className="auth-google" disabled>
              {intent === 'organizer' ? 'Tiếp tục với Google Workspace' : 'Tiếp tục với Google'}
            </button>
            <p className="auth-availability">
              <LockKeyhole size={16} /> Tính năng xác thực đang được kết nối. Hiện chưa thể đăng
              nhập hoặc tạo tài khoản.
            </p>
          </section>
        </div>
      )}
    </AuthDialogContext.Provider>
  );
}
