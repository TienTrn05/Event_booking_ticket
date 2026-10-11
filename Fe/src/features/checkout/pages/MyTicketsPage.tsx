import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { z } from 'zod';
import QRCode from 'qrcode';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { ui } from '../../../shared/styles/classes';
import { CheckoutFrame } from '../components/CheckoutFrame';
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
      alt="QR vé để kiểm tra tại cửa"
      className="rounded-xl"
    />
  ) : (
    <p>Đang tạo QR…</p>
  );
}
export function MyTicketsPage() {
  const { user } = useAuthDialog();
  return <TicketsContent key={user?.id ?? 'guest'} />;
}
function TicketsContent() {
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
        if (!ctrl.signal.aborted) setError(checkoutError(e));
      });
    return () => ctrl.abort();
  }, [accessToken]);
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
      setError(checkoutError(e));
    } finally {
      setBusy('');
    }
  }
  return (
    <CheckoutFrame title="Vé và đơn của tôi">
      <div className="space-y-6">
        {error && (
          <p role="alert" className="rounded-xl border border-red-400 p-4">
            {error}
          </p>
        )}
        <Link to="/organizer/check-in" className={ui('button-outline')}>
          Kiểm tra vé dành cho nhân viên tổ chức
        </Link>
        {bookings
          .filter(
            (b) => b.status === 'AWAITING_PAYMENT' || (b.paymentId && b.status !== 'CONFIRMED'),
          )
          .map((b) => (
            <article
              className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-300/30 p-5"
              key={b.id}
            >
              <p>
                Đơn #{b.id} · {b.items.length} vé ·{' '}
                {b.status === 'AWAITING_PAYMENT' ? 'Chưa hoàn tất thanh toán' : 'Đã hủy / hết hạn'}
              </p>
              <Link className={ui('button-outline')} to={`/checkout/${b.id}`}>
                Xem đơn và thanh toán
              </Link>
            </article>
          ))}
        {loaded && !tickets.length && <p>Bạn chưa có vé đã được xác nhận.</p>}
        {!loaded && !error && <p role="status">Đang tải vé…</p>}
        <div className="grid gap-6 md:grid-cols-2">
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="space-y-4 rounded-2xl border border-slate-300/30 p-6"
            >
              <h2 className="text-xl font-bold">{ticket.title}</h2>
              <p>
                {new Date(ticket.startsAt).toLocaleString('vi-VN', { timeZone: ticket.timezone })}
              </p>
              <p>
                {ticket.attendeeName} · Ghế {ticket.seatLabel}
              </p>
              <p>
                {ticket.status === 'USED'
                  ? 'Đã vào cửa'
                  : ticket.status === 'VALID'
                    ? 'Vé còn hiệu lực'
                    : 'Vé không còn hiệu lực'}
                {ticket.checkedInAt ? ' · Đã check-in' : ''}
              </p>
              {ticket.ticketCode && (
                <>
                  <TicketQr key={ticket.ticketCode} code={ticket.ticketCode} />
                  <code className="block break-all text-xs">{ticket.ticketCode}</code>
                  <p className="text-sm">
                    Mang CCCD thật khi vào cửa. Chỉ chia sẻ QR với đúng người tham dự.
                  </p>
                </>
              )}
              {ticket.ticketCode && !ticket.checkedInAt && (
                <button
                  className={ui('button')}
                  disabled={!!busy || !ticket.onlineCheckInOpen}
                  onClick={() => void checkIn(ticket)}
                >
                  {busy === ticket.id
                    ? 'Đang xử lý…'
                    : ticket.onlineCheckInOpen
                      ? 'Xác nhận check-in online'
                      : 'Check-in mở trước suất 24 giờ'}
                </button>
              )}
            </article>
          ))}
        </div>
      </div>
    </CheckoutFrame>
  );
}
