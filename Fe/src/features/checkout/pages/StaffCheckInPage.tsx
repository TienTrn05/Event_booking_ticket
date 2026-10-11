import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { ui } from '../../../shared/styles/classes';
import { CheckoutFrame, fieldClass } from '../components/CheckoutFrame';
import { checkoutRequest, checkoutError, stableKey } from '../api/checkout.api';
const staffSession = z.object({
  id: z.string(),
  title: z.string(),
  startsAt: z.string(),
  timezone: z.string(),
});
const lookupSchema = z.object({
  ticketId: z.string(),
  attendeeName: z.string(),
  status: z.string(),
  checkedIn: z.boolean(),
});
type Lookup = z.infer<typeof lookupSchema>;
export function StaffCheckInPage() {
  const { user } = useAuthDialog();
  return <StaffContent key={user?.id ?? 'guest'} />;
}
function StaffContent() {
  const { user, accessToken } = useAuthDialog(),
    [sessions, setSessions] = useState<z.infer<typeof staffSession>[]>([]),
    [sessionId, setSessionId] = useState(''),
    [code, setCode] = useState(''),
    [ticket, setTicket] = useState<Lookup | null>(null),
    [fullName, setFullName] = useState(''),
    [birth, setBirth] = useState(''),
    [cccd, setCccd] = useState(''),
    [seen, setSeen] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  useEffect(() => {
    if (!accessToken) return;
    const ctrl = new AbortController();
    void checkoutRequest(
      '/organizer/ticket-sessions',
      z.array(staffSession),
      accessToken,
      'GET',
      undefined,
      undefined,
      ctrl.signal,
    )
      .then((rows) => {
        if (!ctrl.signal.aborted) setSessions(rows);
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(checkoutError(e));
      });
    return () => ctrl.abort();
  }, [accessToken]);
  function reset() {
    setTicket(null);
    setFullName('');
    setBirth('');
    setCccd('');
    setSeen(false);
    setNotice('');
    setError('');
  }
  async function lookup() {
    if (!accessToken || !sessionId || busy) return;
    setBusy(true);
    reset();
    try {
      setTicket(
        await checkoutRequest(
          `/sessions/${sessionId}/ticket-lookup`,
          lookupSchema,
          accessToken,
          'POST',
          { ticketCode: code.trim() },
        ),
      );
    } catch (e) {
      setError(checkoutError(e));
    } finally {
      setBusy(false);
    }
  }
  async function counter() {
    if (!accessToken || !user || !ticket || busy) return;
    setBusy(true);
    setError('');
    try {
      await checkoutRequest(
        `/sessions/${sessionId}/check-ins`,
        z.unknown(),
        accessToken,
        'POST',
        { ticketCode: code.trim(), attendeeName: ticket.attendeeName },
        stableKey(user.id, 'counter-check-in', ticket.ticketId),
      );
      setTicket({ ...ticket, checkedIn: true });
      setNotice('Đã check-in. Cần đối chiếu giấy tờ trước khi cho vào cửa.');
    } catch (e) {
      setError(checkoutError(e));
    } finally {
      setBusy(false);
    }
  }
  async function admit() {
    if (!accessToken || !user || !ticket || busy || !seen) return;
    setBusy(true);
    setError('');
    try {
      await checkoutRequest(
        `/sessions/${sessionId}/admissions`,
        z.unknown(),
        accessToken,
        'POST',
        { ticketCode: code.trim(), fullName, dateOfBirth: birth, cccd, physicalDocumentSeen: seen },
        stableKey(user.id, 'admit', ticket.ticketId),
      );
      setTicket({ ...ticket, status: 'USED' });
      setCccd('');
      setBirth('');
      setFullName('');
      setSeen(false);
      setCode('');
      setNotice('Đã xác minh và sử dụng vé. Người tham dự được phép vào cửa.');
    } catch (e) {
      setError(checkoutError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <CheckoutFrame title="Kiểm tra vé và vào cửa">
      <div className="max-w-3xl space-y-6">
        <p>Chỉ nhân viên có phiên công ty và quyền kiểm tra vé của tổ chức được dùng trang này.</p>
        {error && (
          <p role="alert" className="rounded-xl border border-red-400 p-4">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-xl border border-emerald-500 p-4">
            {notice}
          </p>
        )}
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void lookup();
          }}
        >
          <label className="block">
            Suất diễn
            <select
              className={fieldClass}
              required
              disabled={busy}
              value={sessionId}
              onChange={(e) => {
                setSessionId(e.target.value);
                setCode('');
                reset();
              }}
            >
              <option value="">Chọn suất</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ·{' '}
                  {new Date(s.startsAt).toLocaleString('vi-VN', { timeZone: s.timezone })}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Mã QR vé
            <input
              className={fieldClass}
              required
              autoComplete="off"
              placeholder="Quét bằng máy đọc QR hoặc nhập mã EVX-…"
              value={code}
              disabled={busy}
              onChange={(e) => {
                setCode(e.target.value);
                reset();
              }}
            />
          </label>
          <button className={ui('button')} disabled={busy || !sessionId}>
            Tra cứu vé
          </button>
        </form>
        {ticket && (
          <section className="space-y-5 rounded-2xl border border-slate-300/30 p-6">
            <h2 className="text-xl font-bold">
              {ticket.attendeeName} · Vé #{ticket.ticketId}
            </h2>
            <p>
              {ticket.status === 'USED'
                ? 'Vé đã được sử dụng'
                : ticket.checkedIn
                  ? 'Đã check-in'
                  : 'Chưa check-in'}
            </p>
            {ticket.status === 'VALID' && (
              <>
                {!ticket.checkedIn && (
                  <button
                    className={ui('button-outline')}
                    disabled={busy}
                    onClick={() => void counter()}
                  >
                    Check-in tại quầy
                  </button>
                )}
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void admit();
                  }}
                >
                  <p>Đối chiếu người cầm vé với CCCD thật, rồi nhập thông tin trên giấy tờ.</p>
                  <label className="block">
                    Họ và tên
                    <input
                      className={fieldClass}
                      required
                      value={fullName}
                      autoComplete="off"
                      maxLength={200}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Ngày sinh
                    <input
                      className={fieldClass}
                      type="date"
                      required
                      value={birth}
                      onChange={(e) => setBirth(e.target.value)}
                    />
                  </label>
                  <label className="block">
                    Số CCCD
                    <input
                      className={fieldClass}
                      required
                      pattern="[0-9]{12}"
                      maxLength={12}
                      inputMode="numeric"
                      autoComplete="off"
                      value={cccd}
                      onChange={(e) => setCccd(e.target.value)}
                    />
                  </label>
                  <label className="flex gap-3">
                    <input
                      type="checkbox"
                      checked={seen}
                      onChange={(e) => setSeen(e.target.checked)}
                    />
                    Tôi đã trực tiếp đối chiếu CCCD thật với người tham dự.
                  </label>
                  <button className={ui('button')} disabled={busy || !seen || !ticket.checkedIn}>
                    Xác minh và cho vào cửa
                  </button>
                </form>
              </>
            )}
          </section>
        )}
      </div>
    </CheckoutFrame>
  );
}
