import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Mail, Phone, Ticket, X } from 'lucide-react';
import { AuthDialogContext } from '../context/AuthDialogContext';
import type { AuthIntent } from '../context/AuthDialogContext';
import { ApiError, apiRequest } from '../../../shared/api/client';
import { z } from 'zod';
import { AvatarUpload } from '../../media/components/AvatarUpload';

type AuthMode = 'login' | 'register';
const methodsSchema = z.object({
  email: z.string().nullable(),
  googleLinked: z.boolean(),
  emailLinked: z.boolean(),
  phones: z.array(z.string()),
});
async function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('eventix-auth-refresh', action) : action();
}

async function csrf() {
  const result = await apiRequest('/auth/csrf');
  return z.object({ data: z.object({ csrfToken: z.string().min(1) }) }).parse(result).data
    .csrfToken;
}

const contextCopy: Record<AuthIntent, string> = {
  login: 'Đăng nhập để tiếp tục trải nghiệm cùng Eventix.',
  register: 'Tạo tài khoản để lưu vé và theo dõi những sự kiện bạn yêu thích.',
  tickets: 'Đăng nhập để xem vé và đơn hàng của bạn.',
  organizer:
    'Dùng email công ty để đăng ký tổ chức. Tài khoản cần được Admin duyệt trước khi quản lý sự kiện.',
  checkout: 'Đăng nhập trước khi giữ chỗ hoặc mua vé.',
  account: 'Quản lý phương thức đăng nhập của tài khoản.',
};

export function AuthDialogProvider({ children }: { children: ReactNode }) {
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [methods, setMethods] = useState<z.infer<typeof methodsSchema> | null>(null);
  const sessionEpoch = useRef(0);
  const logoutChannel = useRef<BroadcastChannel | null>(null);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challenge, setChallenge] = useState<{ id: string; resendAt: number } | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [user, setUser] = useState<{ id: string; displayName: string } | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
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
    if (nextIntent === 'tickets') {
      void navigate('/my-tickets');
      return;
    }
    setAuthError(null);
    setChallenge(null);
    setOtp('');
    setIdentifier(methods?.email ?? '');
    setPhone('');
    setNotice(null);
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
    setAuthError(null);
    setChallenge(null);
    setOtp('');
    setNotice(null);
    if (intent) setLocalDialog({ intent, mode: nextMode, locationKey: location.key });
  };

  const showError = (error: unknown) => {
    const messages: Record<string, string> = {
      GOOGLE_CANCELLED: 'Bạn đã hủy đăng nhập Google. Có thể thử lại hoặc dùng email.',
      GOOGLE_UNAVAILABLE: 'Chưa thể đăng nhập Google. Vui lòng thử lại.',
      INVALID_OAUTH_STATE: 'Phiên đăng nhập Google đã hết hạn. Vui lòng bắt đầu lại.',
      INVALID_CSRF: 'Phiên thao tác đã thay đổi. Vui lòng thử lại.',
      INVALID_OTP: 'Mã không đúng, đã dùng hoặc hết hạn. Hãy kiểm tra email hoặc yêu cầu mã mới.',
      OTP_RATE_LIMITED: 'Bạn đã yêu cầu hoặc nhập mã quá nhiều lần. Vui lòng thử lại sau.',
      LINK_REQUIRED: 'Đăng nhập bằng phương thức đã có, rồi mở Tài khoản để liên kết email/SĐT.',
      IDENTITY_CONFLICT:
        'Email hoặc Google đã thuộc tài khoản khác. Không thể tự gộp hai tài khoản.',
      PHONE_CONFLICT: 'SĐT này đã được dùng làm tên đăng nhập của tài khoản khác.',
      REAUTHENTICATION_REQUIRED: 'Hãy đăng xuất và đăng nhập lại trước khi liên kết phương thức.',
      EMAIL_MISMATCH: 'Nhập đúng email của tài khoản bạn vừa đăng nhập.',
      EMAIL_UNAVAILABLE: 'Chưa thể gửi email xác minh. Vui lòng thử lại sau.',
      ADMISSION_UNAVAILABLE: 'Đăng nhập tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
      RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng chờ rồi thử lại.',
      INVALID_ORIGIN: 'Hãy mở website tại địa chỉ được cấu hình cho đăng nhập.',
      ACCOUNT_DISABLED: 'Tài khoản không khả dụng.',
      VALIDATION_ERROR:
        'Kiểm tra lại email hoặc SĐT. SĐT Việt Nam gồm 10 số; số quốc tế cần mã nước.',
    };
    setAuthError(
      error instanceof ApiError
        ? (messages[error.code ?? ''] ?? 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.')
        : 'Chưa thể hoàn tất yêu cầu. Vui lòng thử lại.',
    );
  };

  const refresh = useCallback(async () => {
    const epoch = sessionEpoch.current;
    const exchange = async () => {
      const token = await csrf();
      const result = await apiRequest('/auth/refresh', {
        method: 'POST',
        headers: { 'x-csrf-token': token },
      });
      const data = z
        .object({
          data: z.object({
            accessToken: z.string().min(1),
            user: z.object({ id: z.string(), displayName: z.string() }),
          }),
        })
        .parse(result).data;
      if (epoch !== sessionEpoch.current) return;
      setMethods(null);
      setAccessToken(data.accessToken);
      setUser(data.user);
    };
    if (navigator.locks) await navigator.locks.request('eventix-auth-refresh', exchange);
    else await exchange();
  }, []);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    const epoch = sessionEpoch.current;
    void apiRequest('/auth/methods', {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    })
      .then((result) => {
        if (!controller.signal.aborted && epoch === sessionEpoch.current)
          setMethods(z.object({ data: methodsSchema }).parse(result).data);
      })
      .catch(() => {});
    const timer = navigator.locks
      ? window.setTimeout(
          () => {
            void refresh().catch(() => {
              sessionEpoch.current++;
              setAccessToken(null);
              setUser(null);
              setMethods(null);
            });
          },
          9 * 60 * 1000,
        )
      : null;
    return () => {
      controller.abort();
      if (timer !== null) window.clearTimeout(timer);
    };
  }, [accessToken, refresh]);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('eventix-auth-status');
    logoutChannel.current = channel;
    channel.onmessage = (event: MessageEvent<unknown>) => {
      if (event.data === 'logout') {
        sessionEpoch.current++;
        setAccessToken(null);
        setUser(null);
        setMethods(null);
      }
    };
    return () => {
      logoutChannel.current = null;
      channel.close();
    };
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const result = await apiRequest('/auth/config');
        const config = z
          .object({
            data: z.object({
              googleEnabled: z.boolean(),
              emailOtpEnabled: z.boolean(),
              sessionEnabled: z.boolean(),
            }),
          })
          .parse(result).data;
        const enabled = config.googleEnabled;
        if (!active) return;
        setGoogleEnabled(enabled);
        setEmailEnabled(config.emailOtpEnabled);
        const googleResult = new URLSearchParams(window.location.search).get('auth');
        if (googleResult === 'error') {
          openAuth('login');
          showError(
            new ApiError(
              401,
              new URLSearchParams(window.location.search).get('authReason') ?? 'GOOGLE_UNAVAILABLE',
            ),
          );
          return;
        }
        const completedGoogleLogin =
          new URLSearchParams(window.location.search).get('auth') === 'success';
        if (config.sessionEnabled && (navigator.locks || completedGoogleLogin)) await refresh();
      } catch {
        if (active && new URLSearchParams(window.location.search).get('auth') === 'error') {
          openAuth('login');
          setAuthError('Đăng nhập Google không thành công. Vui lòng thử lại.');
        }
      } finally {
        const url = new URL(window.location.href);
        if (active && url.searchParams.has('auth')) {
          url.searchParams.delete('auth');
          url.searchParams.delete('authReason');
          window.history.replaceState(
            window.history.state,
            '',
            url.pathname + url.search + url.hash,
          );
        }
      }
    })();
    return () => {
      active = false;
    };
    // Initial session restoration runs once per page load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginGoogle = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const token = await csrf();
      const result = await apiRequest('/auth/google/start', {
        method: 'POST',
        headers: {
          'x-csrf-token': token,
          'Content-Type': 'application/json',
          ...(user && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ link: Boolean(user) }),
      });
      const authorizationUrl = z
        .object({ data: z.object({ authorizationUrl: z.url() }) })
        .parse(result).data.authorizationUrl;
      const url = new URL(authorizationUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com')
        throw new Error('Invalid authorization URL');
      window.location.assign(url.toString());
    } catch (error) {
      showError(error);
      setAuthBusy(false);
    }
  };

  useEffect(() => {
    if (!challenge) return;
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((challenge.resendAt - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [challenge]);

  const requestEmailOtp = async () => {
    setAuthBusy(true);
    setAuthError(null);
    try {
      const token = await csrf();
      const result = await apiRequest('/auth/otp/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
          ...(user && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          identifier,
          ...(phone.trim() ? { phone } : {}),
          purpose: user ? 'LINK_IDENTITY' : 'LOGIN',
        }),
      });
      const data = z
        .object({ data: z.object({ challengeId: z.string(), resendAfter: z.number() }) })
        .parse(result).data;
      setOtp('');
      setChallenge({ id: data.challengeId, resendAt: Date.now() + data.resendAfter * 1000 });
      setNotice(
        'Nếu thông tin hợp lệ, mã xác minh đã được gửi tới email của tài khoản. Kiểm tra cả thư rác.',
      );
    } catch (error) {
      showError(error);
    } finally {
      setAuthBusy(false);
    }
  };

  const verifyEmailOtp = async () => {
    if (!challenge) return;
    setAuthBusy(true);
    setAuthError(null);
    try {
      const epoch = sessionEpoch.current;
      const data = await withSessionLock(async () => {
        const token = await csrf();
        const result = await apiRequest('/auth/otp/verify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-csrf-token': token,
            ...(user && accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({ challengeId: challenge.id, code: otp }),
        });
        return z
          .object({
            data: z.object({
              accessToken: z.string(),
              user: z.object({ id: z.string(), displayName: z.string() }),
            }),
          })
          .parse(result).data;
      });
      if (epoch !== sessionEpoch.current) return;
      setMethods(null);
      setAccessToken(data.accessToken);
      setUser(data.user);
      closeAuth();
      setChallenge(null);
      setOtp('');
    } catch (error) {
      showError(error);
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    sessionEpoch.current++;
    try {
      await withSessionLock(async () => {
        const token = await csrf();
        await apiRequest('/auth/logout', { method: 'POST', headers: { 'x-csrf-token': token } });
      });
      sessionEpoch.current++;
      setAccessToken(null);
      setUser(null);
      setMethods(null);
      logoutChannel.current?.postMessage('logout');
    } catch {
      openAuth('login');
      setAuthError('Chưa thể đăng xuất. Vui lòng thử lại.');
    }
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
    <AuthDialogContext.Provider value={{ openAuth, user, accessToken, logout }}>
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
              {user
                ? 'Liên kết tài khoản'
                : challenge
                  ? 'Kiểm tra email của bạn'
                  : intent === 'organizer'
                    ? 'Dành cho nhà tổ chức'
                    : mode === 'login'
                      ? 'Chào mừng trở lại'
                      : 'Bắt đầu cùng Eventix'}
            </h2>
            <p id="eventix-auth-description" className="auth-description">
              {user
                ? 'Bật đăng nhập email/SĐT hoặc liên kết Google trên cùng tài khoản. Dùng đúng email của tài khoản bạn vừa đăng nhập.'
                : intent !== 'organizer' && mode === 'register'
                  ? contextCopy.register
                  : contextCopy[intent]}
            </p>
            {user && methods && !challenge && (
              <p className="auth-hint">
                Đã liên kết:{' '}
                {[methods.googleLinked ? 'Google' : '', methods.emailLinked ? 'Email OTP' : '']
                  .filter(Boolean)
                  .join(' · ')}
                {methods.phones.length ? ` · SĐT: ${methods.phones.join(', ')}` : ''}
              </p>
            )}
            {user && accessToken && intent === 'account' && !challenge && (
              <AvatarUpload key={user.id} accessToken={accessToken} />
            )}
            {!user && !challenge && intent !== 'organizer' && (
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
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void (challenge ? verifyEmailOtp() : requestEmailOtp());
              }}
            >
              {challenge ? (
                <>
                  <label className="auth-label" htmlFor="auth-otp">
                    Mã xác minh gồm 6 số
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={18} aria-hidden="true" />
                    <input
                      id="auth-otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={otp}
                      onChange={(event) =>
                        setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      required
                      disabled={authBusy}
                      autoFocus
                    />
                  </div>
                  <button className="auth-primary" disabled={authBusy || otp.length !== 6}>
                    {authBusy
                      ? 'Đang xác minh…'
                      : user
                        ? 'Xác minh và liên kết'
                        : 'Xác minh và tiếp tục'}
                    <ArrowRight size={17} />
                  </button>
                  <div className="auth-otp-actions">
                    <button
                      type="button"
                      disabled={authBusy || remaining > 0}
                      onClick={() => void requestEmailOtp()}
                    >
                      {remaining > 0 ? `Gửi lại sau ${remaining}s` : 'Gửi lại mã'}
                    </button>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        setChallenge(null);
                        setOtp('');
                        setNotice(null);
                        setAuthError(null);
                      }}
                    >
                      Đổi thông tin
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <label className="auth-label" htmlFor="auth-identity">
                    {user || mode === 'register'
                      ? 'Email nhận mã xác minh'
                      : 'Email hoặc số điện thoại'}
                  </label>
                  <div className="auth-input-wrap">
                    <Mail size={18} aria-hidden="true" />
                    <input
                      id="auth-identity"
                      type={user || mode === 'register' ? 'email' : 'text'}
                      autoComplete={user || mode === 'register' ? 'email' : 'username'}
                      placeholder={
                        user || mode === 'register'
                          ? 'ban@gmail.com'
                          : 'Nhập email hoặc SĐT đã đăng ký'
                      }
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      maxLength={254}
                      required
                      disabled={authBusy}
                    />
                  </div>
                  {(user || mode === 'register') && (
                    <>
                      <label className="auth-label auth-phone-label" htmlFor="auth-phone">
                        Số điện thoại (không bắt buộc)
                      </label>
                      <div className="auth-input-wrap">
                        <Phone size={18} aria-hidden="true" />
                        <input
                          id="auth-phone"
                          type="tel"
                          autoComplete="tel"
                          inputMode="tel"
                          placeholder="0912345678"
                          value={phone}
                          onChange={(event) => setPhone(event.target.value)}
                          maxLength={32}
                          disabled={authBusy}
                        />
                      </div>
                    </>
                  )}
                  <p className="auth-hint">
                    Mã xác minh được gửi qua email. SĐT đã đăng ký dùng để tìm tài khoản.
                  </p>
                  <button
                    className="auth-primary"
                    disabled={!emailEnabled || authBusy || !identifier.trim()}
                  >
                    {authBusy ? 'Đang gửi mã…' : 'Gửi mã xác minh qua email'}
                    <ArrowRight size={17} />
                  </button>
                </>
              )}
            </form>
            {!challenge && (!user || methods?.googleLinked === false) && (
              <>
                <div className="auth-separator">
                  <span>hoặc</span>
                </div>
                <button
                  type="button"
                  className="auth-google"
                  disabled={!googleEnabled || authBusy}
                  onClick={() => void loginGoogle()}
                >
                  {authBusy ? 'Đang xử lý…' : user ? 'Liên kết Google' : 'Tiếp tục với Google'}
                </button>
              </>
            )}
            {notice && (
              <p className="auth-hint" role="status">
                {notice}
              </p>
            )}
            {authError && (
              <p className="auth-error" role="alert">
                {authError}
              </p>
            )}
          </section>
        </div>
      )}
    </AuthDialogContext.Provider>
  );
}
