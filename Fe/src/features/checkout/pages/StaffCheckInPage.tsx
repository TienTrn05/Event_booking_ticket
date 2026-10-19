import { useEffect, useState } from 'react';
import { z } from 'zod';
import { ClipboardCheck, ScanLine, ShieldCheck, Ticket as TicketIcon } from 'lucide-react';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import Button from '../../../shared/ui/Button';
import { CheckoutFrame, CommerceNotice, fieldClass, panelClass } from '../components/CheckoutFrame';
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
  const { t, locale } = useLocale();
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
    [notice, setNotice] = useState(''),
    [loaded, setLoaded] = useState(false);
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
        if (!ctrl.signal.aborted) {
          setSessions(rows);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(checkoutError(e, locale));
      });
    return () => ctrl.abort();
  }, [accessToken, locale]);
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
      setError(checkoutError(e, locale));
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
      setNotice(
        t(
          'Đã check-in. Cần đối chiếu giấy tờ trước khi cho vào cửa.',
          'Checked in. Verify the original identity document before admission.',
        ),
      );
    } catch (e) {
      setError(checkoutError(e, locale));
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
      setNotice(
        t(
          'Đã xác minh và sử dụng vé. Người tham dự được phép vào cửa.',
          'Identity verified and ticket consumed. The attendee may enter.',
        ),
      );
    } catch (e) {
      setError(checkoutError(e, locale));
    } finally {
      setBusy(false);
    }
  }
  return (
    <CheckoutFrame title={t('Check-in và xác minh vào cửa', 'Check-in and admission')}>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <div className={panelClass}>
            <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
              <ScanLine size={21} className="text-accent" />
              {t('Tra cứu vé', 'Find a ticket')}
            </h2>
            <p className="mb-6 text-sm leading-6 text-muted">
              {t(
                'Dành cho nhân viên được cấp quyền của tổ chức. Chọn đúng suất và nhập mã từ vé của người tham dự.',
                'For authorized organization staff. Select the session and enter the attendee’s ticket code.',
              )}
            </p>
            {loaded && !sessions.length && (
              <div className="mb-5">
                <CommerceNotice>
                  {t(
                    'Chưa có suất nào được cấp cho tài khoản này.',
                    'No sessions are available for this account.',
                  )}
                </CommerceNotice>
              </div>
            )}
            {!loaded && !error && (
              <p role="status" className="mb-5 text-sm text-muted">
                {t('Đang tải suất được phân công…', 'Loading assigned sessions…')}
              </p>
            )}
            <form
              className="space-y-5"
              onSubmit={(e) => {
                e.preventDefault();
                void lookup();
              }}
            >
              <label className="block text-sm font-semibold">
                {t('Suất diễn', 'Session')}
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
                  <option value="">{t('Chọn suất', 'Select a session')}</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.title} ·{' '}
                      {new Date(session.startsAt).toLocaleString(
                        locale === 'vi' ? 'vi-VN' : 'en-US',
                        { timeZone: session.timezone },
                      )}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                {t('Mã QR vé', 'Ticket QR code')}
                <input
                  className={fieldClass}
                  required
                  autoComplete="off"
                  placeholder={t(
                    'Dùng máy đọc QR hoặc nhập mã EVX-…',
                    'Use a QR reader or enter EVX-…',
                  )}
                  value={code}
                  disabled={busy}
                  onChange={(e) => {
                    setCode(e.target.value);
                    reset();
                  }}
                />
              </label>
              <Button
                type="submit"
                className="w-full"
                disabled={busy || !sessionId || !code.trim()}
              >
                <ScanLine size={17} />
                {busy ? t('Đang xử lý…', 'Processing…') : t('Tra cứu vé', 'Look up ticket')}
              </Button>
            </form>
          </div>
          {error && <CommerceNotice tone="error">{error}</CommerceNotice>}
          {notice && <CommerceNotice tone="success">{notice}</CommerceNotice>}
          <div className="rounded-xl bg-raised p-5 text-sm leading-6 text-muted">
            <ShieldCheck size={21} className="mb-3 text-accent" />
            {t(
              'Check-in ghi nhận người tham dự. Xác minh giấy tờ và cho vào cửa sẽ sử dụng vé một lần. Không lưu ảnh hoặc bản sao CCCD tại thiết bị.',
              'Check-in records attendance. Identity verification and admission consume the ticket once. Do not store identity document images or copies on this device.',
            )}
          </div>
        </div>
        {ticket ? (
          <section className={`${panelClass} space-y-5`}>
            <div className="border-b border-line pb-5">
              <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
                {t('Kết quả tra cứu', 'Ticket details')}
              </p>
              <h2 className="text-xl font-bold">{ticket.attendeeName}</h2>
              <p className="mt-2 text-sm text-muted">
                {t('Vé', 'Ticket')} #{ticket.ticketId}
              </p>
              <p className="mt-3 inline-flex rounded-lg bg-raised px-3 py-2 text-sm font-semibold">
                {ticket.status === 'USED'
                  ? t('Vé đã được sử dụng', 'Ticket already used')
                  : ticket.status !== 'VALID'
                    ? t('Vé không còn hiệu lực', 'Ticket no longer valid')
                    : ticket.checkedIn
                      ? t('Đã check-in · Chờ xác minh vào cửa', 'Checked in · Awaiting admission')
                      : t('Chưa check-in', 'Not checked in')}
              </p>
            </div>
            {ticket.status === 'VALID' && (
              <>
                {!ticket.checkedIn && (
                  <Button
                    variant="outline"
                    className="w-full"
                    disabled={busy}
                    onClick={() => void counter()}
                  >
                    <ClipboardCheck size={17} />
                    {t('Check-in tại quầy', 'Check in at the counter')}
                  </Button>
                )}
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void admit();
                  }}
                >
                  <h3 className="flex items-center gap-2 font-bold">
                    <ShieldCheck size={18} />
                    {t('Đối chiếu giấy tờ thật', 'Verify original identity document')}
                  </h3>
                  <p className="text-sm leading-6 text-muted">
                    {t(
                      'Đối chiếu người cầm vé với CCCD thật, rồi nhập thông tin trên giấy tờ.',
                      'Match the attendee with their original identity document, then enter the document details.',
                    )}
                  </p>
                  <label className="block text-sm font-medium">
                    {t('Họ và tên', 'Full name')}
                    <input
                      className={fieldClass}
                      required
                      value={fullName}
                      autoComplete="off"
                      maxLength={200}
                      disabled={busy}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-medium">
                      {t('Ngày sinh', 'Date of birth')}
                      <input
                        className={fieldClass}
                        type="date"
                        required
                        value={birth}
                        disabled={busy}
                        onChange={(e) => setBirth(e.target.value)}
                      />
                    </label>
                    <label className="block text-sm font-medium">
                      {t('Số CCCD', 'Citizen identity number')}
                      <input
                        className={fieldClass}
                        required
                        pattern="[0-9]{12}"
                        maxLength={12}
                        inputMode="numeric"
                        autoComplete="off"
                        value={cccd}
                        disabled={busy}
                        onChange={(e) => setCccd(e.target.value)}
                      />
                    </label>
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-raised p-4 text-sm leading-6">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--accent)]"
                      checked={seen}
                      disabled={busy}
                      onChange={(e) => setSeen(e.target.checked)}
                    />
                    {t(
                      'Tôi đã trực tiếp đối chiếu CCCD thật với người tham dự.',
                      'I have verified the original identity document against the attendee.',
                    )}
                  </label>
                  <Button
                    type="submit"
                    className="w-full"
                    disabled={busy || !seen || !ticket.checkedIn}
                  >
                    {t('Xác minh và cho vào cửa', 'Verify and admit attendee')}
                  </Button>
                </form>
              </>
            )}
          </section>
        ) : (
          <div
            className={`${panelClass} flex min-h-64 flex-col items-center justify-center text-center`}
          >
            <TicketIcon size={44} className="mb-4 text-accent" />
            <h2 className="mb-2 text-lg font-bold">
              {t('Sẵn sàng đón khách', 'Ready to welcome guests')}
            </h2>
            <p className="max-w-xs text-sm leading-6 text-muted">
              {t(
                'Kết quả và bước xác minh sẽ hiện ở đây sau khi tra cứu vé.',
                'Ticket details and verification steps will appear here after lookup.',
              )}
            </p>
          </div>
        )}
      </div>
    </CheckoutFrame>
  );
}
