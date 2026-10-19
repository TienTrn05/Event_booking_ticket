import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import QRCode from 'qrcode';
import {
  CalendarDays,
  CheckCircle2,
  CircleCheck,
  QrCode,
  Ticket as TicketIcon,
  UserRound,
} from 'lucide-react';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import Button from '../../../shared/ui/Button';
import {
  CheckoutFrame,
  CommerceNotice,
  panelClass,
  outlineLinkClass,
  Deadline,
} from '../components/CheckoutFrame';
import {
  bookingSchema,
  checkoutRequest,
  checkoutError,
  stableKey,
  type Booking,
} from '../api/checkout.api';

const ticketSchema = z.object({
  id: z.string(),
  bookingId: z.string(),
  sessionId: z.string(),
  title: z.string(),
  status: z.string(),
  attendeeName: z.string(),
  seatLabel: z.string(),
  startsAt: z.string(),
  timezone: z.string(),
  checkedInAt: z.string().nullable(),
  admittedAt: z.string().nullable(),
  onlineCheckInOpen: z.boolean(),
  ticketCode: z.string().nullable(),
});
type Ticket = z.infer<typeof ticketSchema>;
function TicketQr({ code }: { code: string }) {
  const [image, setImage] = useState('');
  const { t } = useLocale();
  useEffect(() => {
    let active = true;
    void QRCode.toDataURL(code, { width: 256, margin: 2, errorCorrectionLevel: 'M' })
      .then((url) => {
        if (active) setImage(url);
      })
      .catch(() => {
        if (active) setImage('');
      });
    return () => {
      active = false;
    };
  }, [code]);
  return image ? (
    <img
      src={image}
      width={256}
      height={256}
      alt={t('QR vé để kiểm tra tại cửa', 'Ticket QR code for admission')}
      className="mx-auto rounded-xl"
    />
  ) : (
    <p>{t('Đang tạo QR…', 'Preparing QR…')}</p>
  );
}
export function MyTicketsPage() {
  const { user } = useAuthDialog();
  return <TicketsContent key={user?.id ?? 'guest'} />;
}
function TicketsContent() {
  const { t, locale } = useLocale();
  const [filter, setFilter] = useState<'ALL' | 'VALID' | 'USED' | 'ENDED'>('ALL');
  const { user, accessToken } = useAuthDialog(),
    [tickets, setTickets] = useState<Ticket[]>([]),
    [bookings, setBookings] = useState<Booking[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (!accessToken) return;
    const ctrl = new AbortController();
    void Promise.all([
      checkoutRequest(
        '/users/me/tickets',
        z.array(ticketSchema),
        accessToken,
        'GET',
        undefined,
        undefined,
        ctrl.signal,
      ),
      checkoutRequest(
        '/bookings?page=1&pageSize=50',
        z.array(bookingSchema),
        accessToken,
        'GET',
        undefined,
        undefined,
        ctrl.signal,
      ),
    ])
      .then(([owned, orders]) => {
        if (!ctrl.signal.aborted) {
          setTickets(owned);
          setBookings(orders);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(checkoutError(e, locale));
      });
    return () => ctrl.abort();
  }, [accessToken, locale]);
  async function checkIn(ticket: Ticket) {
    if (!accessToken || !user || !ticket.ticketCode || busy) return;
    setBusy(ticket.id);
    setError('');
    try {
      await checkoutRequest(
        `/tickets/${ticket.id}/check-in`,
        z.unknown(),
        accessToken,
        'POST',
        { ticketCode: ticket.ticketCode, attendeeName: ticket.attendeeName },
        stableKey(user.id, 'online-check-in', ticket.id),
      );
      setTickets(await checkoutRequest('/users/me/tickets', z.array(ticketSchema), accessToken));
    } catch (e) {
      setError(checkoutError(e, locale));
    } finally {
      setBusy('');
    }
  }
  const visible = tickets.filter(
    (ticket) =>
      filter === 'ALL' ||
      (filter === 'ENDED' ? !['VALID', 'USED'].includes(ticket.status) : ticket.status === filter),
  );
  const unfinished = bookings.filter(
    (booking) =>
      booking.status === 'AWAITING_PAYMENT' ||
      (booking.paymentId && booking.status !== 'CONFIRMED'),
  );
  return (
    <CheckoutFrame title={t('Những cuộc hẹn của bạn', 'Your upcoming experiences')}>
      <div className="space-y-8">
        <Link className={outlineLinkClass} to="/my-orders">
          {t('Xem đơn sản phẩm của tôi', 'View my merchandise orders')}
        </Link>
        {error && <CommerceNotice tone="error">{error}</CommerceNotice>}
        {unfinished.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-lg font-bold">{t('Đơn cần xem lại', 'Bookings to review')}</h2>
            {unfinished.map((booking) => (
              <article
                key={booking.id}
                className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}
              >
                <div>
                  <p className="font-semibold">
                    {t('Đơn', 'Booking')} #{booking.id} · {booking.items.length}{' '}
                    {t('vé', 'tickets')}
                  </p>
                  <p className="mt-1 text-sm text-muted">
                    {booking.status === 'AWAITING_PAYMENT' && !booking.expired
                      ? t('Chưa hoàn tất thanh toán', 'Payment not completed')
                      : t('Đã hủy / hết hạn', 'Cancelled / expired')}
                  </p>
                  {booking.status === 'AWAITING_PAYMENT' && !booking.expired && (
                    <div className="mt-3">
                      <Deadline expiresAt={booking.expiresAt} />
                    </div>
                  )}
                </div>
                <Link className={outlineLinkClass} to={`/checkout/${booking.id}`}>
                  {t('Xem đơn và thanh toán', 'View booking and payment')}
                </Link>
              </article>
            ))}
          </section>
        )}
        <section>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="flex items-center gap-2 text-xl font-bold">
              <TicketIcon size={21} className="text-accent" />
              {t('Bộ sưu tập vé', 'Your tickets')}
            </h2>
            <div
              className="flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-surface p-1"
              aria-label={t('Lọc vé theo trạng thái', 'Filter tickets by status')}
            >
              {(
                [
                  { value: 'ALL', label: t('Tất cả', 'All') },
                  { value: 'VALID', label: t('Còn hiệu lực', 'Valid') },
                  { value: 'USED', label: t('Đã vào cửa', 'Admitted') },
                  { value: 'ENDED', label: t('Đã kết thúc', 'Ended') },
                ] as const
              ).map((tab) => (
                <button
                  type="button"
                  key={tab.value}
                  aria-pressed={filter === tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`min-h-11 rounded-lg px-3 text-xs font-semibold transition ${filter === tab.value ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {!loaded && !error && (
            <div role="status" className={`${panelClass} animate-pulse text-muted`}>
              {t('Đang tải vé…', 'Loading tickets…')}
            </div>
          )}
          {loaded && !visible.length && (
            <div className={`${panelClass} py-12 text-center`}>
              <TicketIcon size={40} className="mx-auto mb-4 text-accent" />
              <h3 className="mb-2 text-xl font-bold">
                {tickets.length
                  ? t('Chưa có vé trong nhóm này', 'No tickets in this category')
                  : t('Cuộc hẹn đầu tiên đang chờ bạn', 'Your first experience awaits')}
              </h3>
              <p className="mb-6 text-sm text-muted">
                {tickets.length
                  ? t(
                      'Thử chọn một trạng thái khác để xem vé của bạn.',
                      'Select another status to see your tickets.',
                    )
                  : t(
                      'Vé đã được xác nhận sẽ xuất hiện tại đây.',
                      'Confirmed tickets will appear here.',
                    )}
              </p>
              <Link to="/" className={outlineLinkClass}>
                {t('Khám phá sự kiện', 'Explore events')}
              </Link>
            </div>
          )}
          <div className="grid items-start gap-6 md:grid-cols-2">
            {visible.map((ticket) => (
              <article
                key={ticket.id}
                className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card"
              >
                <div className="border-b border-dashed border-line p-5 sm:p-6">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${ticket.status === 'VALID' ? 'bg-[var(--positive-soft)] text-[var(--positive)]' : ticket.status === 'USED' ? 'bg-accent-soft text-accent' : 'bg-raised text-muted'}`}
                    >
                      {ticket.status === 'VALID' ? (
                        <CircleCheck size={13} />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      {ticket.status === 'USED'
                        ? t('Đã vào cửa', 'Admitted')
                        : ticket.status === 'VALID'
                          ? t('Vé còn hiệu lực', 'Valid ticket')
                          : t('Vé không còn hiệu lực', 'No longer valid')}
                    </span>
                    <span className="text-xs text-muted">#{ticket.id}</span>
                  </div>
                  <h3 className="mb-4 text-xl font-bold leading-7">{ticket.title}</h3>
                  <p className="mb-3 flex items-start gap-2 text-sm text-muted">
                    <CalendarDays size={17} className="shrink-0" />
                    {new Date(ticket.startsAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US', {
                      timeZone: ticket.timezone,
                    })}
                  </p>
                  <p className="flex items-start gap-2 text-sm">
                    <UserRound size={17} className="shrink-0 text-muted" />
                    <span>
                      {ticket.attendeeName}
                      <span className="mt-1 block text-xs text-muted">{ticket.seatLabel}</span>
                    </span>
                  </p>
                </div>
                <div className="space-y-4 p-5 sm:p-6">
                  <p className="text-sm text-muted">
                    {ticket.admittedAt
                      ? t('Đã xác minh và vào cửa.', 'Identity verified and admitted.')
                      : ticket.checkedInAt
                        ? t(
                            'Đã check-in. Mang CCCD thật để được xác minh tại cửa.',
                            'Checked in. Bring your original identity document for admission.',
                          )
                        : t(
                            'Check-in và xác minh vào cửa là hai bước riêng.',
                            'Check-in and identity verification for admission are separate steps.',
                          )}
                  </p>
                  {ticket.ticketCode && (
                    <details className="rounded-xl border border-line bg-raised p-4">
                      <summary className="min-h-7 cursor-pointer text-sm font-semibold text-accent">
                        <span className="ml-1 inline-flex items-center gap-2">
                          <QrCode size={17} />
                          {t('Mở QR và mã vé', 'Show QR and ticket code')}
                        </span>
                      </summary>
                      <div className="mt-4 space-y-4">
                        <TicketQr key={ticket.ticketCode} code={ticket.ticketCode} />
                        <code className="block break-all rounded-lg bg-surface p-3 text-center text-xs">
                          {ticket.ticketCode}
                        </code>
                        <p className="text-xs leading-5 text-muted">
                          {t(
                            'Mã này cho phép sử dụng vé. Chỉ chia sẻ với đúng người tham dự.',
                            'This code grants access to your ticket. Share it only with the intended attendee.',
                          )}
                        </p>
                      </div>
                    </details>
                  )}
                  {ticket.ticketCode && !ticket.checkedInAt && (
                    <Button
                      className="w-full"
                      disabled={!!busy || !ticket.onlineCheckInOpen}
                      onClick={() => void checkIn(ticket)}
                    >
                      {busy === ticket.id
                        ? t('Đang xử lý…', 'Processing…')
                        : ticket.onlineCheckInOpen
                          ? t('Xác nhận check-in online', 'Check in online')
                          : t(
                              'Check-in mở trước suất 24 giờ',
                              'Check-in opens 24 hours before the session',
                            )}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </CheckoutFrame>
  );
}
