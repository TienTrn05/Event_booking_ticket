import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { CheckCircle2, CreditCard, LockKeyhole, ShieldCheck, Ticket } from 'lucide-react';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import Button from '../../../shared/ui/Button';
import { formatPrice } from '../../../shared/utils/format';
import {
  CheckoutFrame,
  CheckoutSteps,
  CommerceNotice,
  Deadline,
  fieldClass,
  panelClass,
  outlineLinkClass,
} from '../components/CheckoutFrame';
import {
  checkoutRequest,
  checkoutError,
  bookingSchema,
  paymentSchema,
  attendeeSchema,
  stableKey,
  type Booking,
  type Payment,
  type AttendeeForm,
} from '../api/checkout.api';
import { MerchandiseOrderPage } from './MerchandiseOrderPage';
export function CheckoutPage() {
  const route = useParams(),
    [search] = useSearchParams(),
    bookingId = route.bookingId ?? search.get('bookingId') ?? '',
    { user } = useAuthDialog();
  if (search.has('merchandiseOrderId')) return <MerchandiseOrderPage />;
  return <CheckoutContent key={`${user?.id ?? 'guest'}:${bookingId}`} bookingId={bookingId} />;
}
function CheckoutContent({ bookingId }: { bookingId: string }) {
  const { user, accessToken } = useAuthDialog();
  const { t, locale } = useLocale();
  const [booking, setBooking] = useState<Booking | null>(null),
    [payment, setPayment] = useState<Payment | null>(null),
    [rows, setRows] = useState<AttendeeForm[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loadedOwner, setLoadedOwner] = useState(''),
    [confirmCancel, setConfirmCancel] = useState(false);
  const dirty = useRef(false),
    paymentKey = useRef('');
  useEffect(() => {
    if (!user || !accessToken || !/^[1-9][0-9]*$/.test(bookingId)) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let initialized = false;
    let loading = false;
    async function load() {
      if (loading || ctrl.signal.aborted) return;
      loading = true;
      try {
        const data = await checkoutRequest(
          `/bookings/${bookingId}`,
          bookingSchema,
          accessToken,
          'GET',
          undefined,
          undefined,
          ctrl.signal,
        );
        if (ctrl.signal.aborted) return;
        setBooking(data);
        setLoadedOwner(user!.id);
        if (!initialized) {
          const stored = await checkoutRequest(
            `/bookings/${bookingId}/attendees`,
            z.array(attendeeSchema),
            accessToken,
            'GET',
            undefined,
            undefined,
            ctrl.signal,
          );
          if (!dirty.current && !ctrl.signal.aborted)
            setRows(
              data.items.map((item) => {
                const a = stored.find((r) => r.bookingItemId === item.id);
                return {
                  bookingItemId: item.id,
                  fullName: a?.fullName ?? item.attendeeName,
                  dateOfBirth: a?.dateOfBirth ?? '',
                  phone: a?.phone ?? '',
                  cccd: '',
                  maskedCccd: a?.maskedCccd,
                };
              }),
            );
          initialized = true;
        }
        let unresolvedPayment = false;
        if (data.paymentId) {
          const current = await checkoutRequest(
            `/payments/${data.paymentId}`,
            paymentSchema,
            accessToken,
            'GET',
            undefined,
            undefined,
            ctrl.signal,
          );
          if (!ctrl.signal.aborted) setPayment(current);
          unresolvedPayment = current.outcome === null;
        }
        if (data.status === 'AWAITING_PAYMENT' || unresolvedPayment)
          timer = setTimeout(() => void load(), 5000 + Math.random() * 2000);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(checkoutError(e, locale));
          timer = setTimeout(() => void load(), 10000);
        }
      } finally {
        loading = false;
      }
    }
    void load();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        if (timer) clearTimeout(timer);
        void load();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [bookingId, accessToken, user, locale]);
  function edit(index: number, field: keyof AttendeeForm, value: string) {
    dirty.current = true;
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  async function pay() {
    if (!accessToken || !user || !booking || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!payment || payment.canRetry) {
        const mustSave = dirty.current || rows.some((row) => !row.maskedCccd);
        if (mustSave) {
          if (rows.some((r) => !/^\d{12}$/.test(r.cccd))) throw new Error('CCCD_REQUIRED');
          const saved = await checkoutRequest(
            `/bookings/${booking.id}/attendees`,
            z.array(attendeeSchema),
            accessToken,
            'PUT',
            {
              attendees: rows.map((row) => ({
                bookingItemId: row.bookingItemId,
                fullName: row.fullName,
                dateOfBirth: row.dateOfBirth,
                phone: row.phone,
                cccd: row.cccd,
              })),
            },
          );
          dirty.current = false;
          setRows((current) =>
            current.map((row) => ({
              ...row,
              cccd: '',
              maskedCccd: saved.find((a) => a.bookingItemId === row.bookingItemId)?.maskedCccd,
            })),
          );
        }
      }
      paymentKey.current = stableKey(
        user.id,
        'payment',
        `${booking.id}:${payment?.canRetry ? payment.id : 'initial'}`,
      );
      const result = await checkoutRequest(
        `/bookings/${booking.id}/payments`,
        paymentSchema,
        accessToken,
        'POST',
        {},
        paymentKey.current,
      );
      setPayment(result);
      if (result.status === 'PENDING' && result.checkoutUrl) {
        const url = new URL(result.checkoutUrl);
        if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn')
          throw new Error('INVALID_PAYMENT_URL');
        window.location.assign(url.href);
      }
    } catch (e) {
      setError(
        e instanceof Error && e.message === 'CCCD_REQUIRED'
          ? t(
              'Nhập đủ 12 số CCCD cho từng người tham dự. Khi sửa thông tin đã lưu, cần nhập lại CCCD cho tất cả vé.',
              'Enter a 12-digit identity number for every attendee. Editing saved details requires entering identity numbers again for all tickets.',
            )
          : checkoutError(e, locale),
      );
    } finally {
      setBusy(false);
    }
  }
  async function cancel() {
    if (!booking || !user || !accessToken || busy) return;
    setBusy(true);
    try {
      const updated = await checkoutRequest(
        `/bookings/${booking.id}/cancel`,
        bookingSchema,
        accessToken,
        'POST',
        { reason: 'Người mua hủy đơn' },
        stableKey(user.id, 'cancel', booking.id),
      );
      setBooking(updated);
      setConfirmCancel(false);
    } catch (e) {
      setError(checkoutError(e, locale));
    } finally {
      setBusy(false);
    }
  }
  const editable =
    booking?.status === 'AWAITING_PAYMENT' && !booking.expired && (!payment || payment.canRetry);
  return (
    <CheckoutFrame title={t('Thông tin vé và thanh toán', 'Attendees and payment')}>
      <CheckoutSteps current={booking?.status === 'CONFIRMED' ? 3 : 2} />
      {error && (
        <div className="mb-5">
          <CommerceNotice tone="error">{error}</CommerceNotice>
        </div>
      )}
      {booking && loadedOwner === user?.id ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            {booking.status === 'CONFIRMED' ? (
              <section className={`${panelClass} py-10 text-center`}>
                <CheckCircle2
                  size={52}
                  className="mx-auto mb-5 text-[var(--positive)]"
                  aria-hidden="true"
                />
                <h2 className="mb-3 text-2xl font-bold">
                  {t('Đặt vé thành công', 'Booking confirmed')}
                </h2>
                <p className="mb-6 text-sm leading-6 text-muted">
                  {t(
                    'Đơn của bạn đã được xác nhận. Vé và QR được lưu trong tài khoản.',
                    'Your booking is confirmed. Your tickets and QR codes are ready in your account.',
                  )}
                </p>
                <Link className={outlineLinkClass} to="/my-tickets">
                  <Ticket size={17} />
                  {t('Xem vé và QR', 'View tickets and QR')}
                </Link>
              </section>
            ) : payment?.reconciliationStatus === 'REQUIRED' ? (
              <CommerceNotice tone="warning">
                <h2 className="mb-2 text-lg font-bold">
                  {t('Đang xác nhận khoản thanh toán', 'We are reviewing your payment')}
                </h2>
                <p>
                  {t(
                    `Hệ thống đã ghi nhận ${formatPrice(payment.receivedMinor, payment.currency)}. Đơn chưa được xác nhận hoặc có khoản tiền chênh lệch. Vui lòng không thanh toán thêm.`,
                    `We have recorded ${formatPrice(payment.receivedMinor, payment.currency)}. Your booking is not confirmed, or the amount needs review. Please do not pay again.`,
                  )}
                </p>
              </CommerceNotice>
            ) : booking.status !== 'AWAITING_PAYMENT' || booking.expired ? (
              <section className={`${panelClass} space-y-5`}>
                <h2 className="text-xl font-bold">
                  {t('Đơn đã kết thúc', 'This booking has ended')}
                </h2>
                <p className="text-sm leading-6 text-muted">
                  {t(
                    'Đơn đã hủy hoặc hết thời gian giữ chỗ. Nếu bạn đã chuyển tiền, hệ thống sẽ tiếp tục kiểm tra kết quả.',
                    'This booking was cancelled or the reservation expired. If you have paid, the system will continue checking the payment result.',
                  )}
                </p>
                <Link to="/" className={outlineLinkClass}>
                  {t('Chọn sự kiện khác', 'Explore more events')}
                </Link>
              </section>
            ) : (
              <>
                {payment?.outcome === 'FAILED' && (
                  <CommerceNotice tone="warning">
                    <h2 className="mb-1 font-bold">
                      {t('Thanh toán chưa thành công', 'Payment was unsuccessful')}
                    </h2>
                    <p>
                      {payment.canRetry
                        ? t(
                            'Bạn có thể thử lại trong thời hạn giữ vé ban đầu.',
                            'You can retry before the original reservation deadline.',
                          )
                        : t(
                            'Hiện chưa thể tạo lần thanh toán mới. Hệ thống sẽ tiếp tục kiểm tra kết quả.',
                            'A new payment attempt is not available. The system will continue checking the result.',
                          )}
                    </p>
                  </CommerceNotice>
                )}
                {payment?.outcome === null && (
                  <CommerceNotice>
                    <h2 className="mb-1 font-bold">
                      {t('Đang chờ kết quả thanh toán', 'Waiting for payment confirmation')}
                    </h2>
                    <p>
                      {t(
                        'Trang tự cập nhật từ hệ thống. Việc quay về từ payOS chưa xác nhận thanh toán thành công.',
                        'This page updates from the server. Returning from payOS alone does not confirm a successful payment.',
                      )}
                    </p>
                  </CommerceNotice>
                )}
                <section className={panelClass}>
                  <h2 className="mb-2 flex items-center gap-2 text-lg font-bold">
                    <Ticket size={19} className="text-accent" aria-hidden="true" />
                    {t('Thông tin người tham dự', 'Attendee details')}
                  </h2>
                  <p className="mb-6 text-sm leading-6 text-muted">
                    {t(
                      'Mỗi vé cần thông tin của đúng người tham dự. Tuổi tính theo ngày diễn ra suất. Mang CCCD thật để đối chiếu khi vào cửa.',
                      'Enter the details of the person attending for each ticket. Age is checked on the session date. Bring the original identity document for admission.',
                    )}
                  </p>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void pay();
                    }}
                    className="space-y-6"
                  >
                    {rows.map((row, index) => (
                      <fieldset
                        key={row.bookingItemId}
                        disabled={!editable || busy}
                        className="grid gap-4 rounded-xl border border-line bg-raised/40 p-4 sm:grid-cols-2 sm:p-5"
                      >
                        <legend className="px-2 text-sm font-bold">
                          {t('Vé', 'Ticket')} {index + 1} · {booking.items[index]?.seatLabel}
                        </legend>
                        <label className="text-sm font-medium">
                          {t('Họ và tên trên CCCD', 'Full name on identity document')}
                          <input
                            className={fieldClass}
                            required
                            maxLength={200}
                            autoComplete="off"
                            value={row.fullName}
                            onChange={(e) => edit(index, 'fullName', e.target.value)}
                          />
                        </label>
                        <label className="text-sm font-medium">
                          {t('Ngày sinh', 'Date of birth')}
                          <input
                            className={fieldClass}
                            type="date"
                            required
                            value={row.dateOfBirth}
                            onChange={(e) => edit(index, 'dateOfBirth', e.target.value)}
                          />
                        </label>
                        <label className="text-sm font-medium">
                          {t('Số điện thoại', 'Phone number')}
                          <input
                            className={fieldClass}
                            type="tel"
                            required
                            maxLength={40}
                            autoComplete="off"
                            value={row.phone}
                            onChange={(e) => edit(index, 'phone', e.target.value)}
                          />
                        </label>
                        <label className="text-sm font-medium">
                          {t('Số CCCD', 'Citizen identity number')}
                          <input
                            className={fieldClass}
                            inputMode="numeric"
                            autoComplete="off"
                            maxLength={12}
                            pattern="[0-9]{12}"
                            required={!row.maskedCccd}
                            placeholder={row.maskedCccd ?? t('12 chữ số', '12 digits')}
                            value={row.cccd}
                            onChange={(e) => edit(index, 'cccd', e.target.value)}
                          />
                        </label>
                      </fieldset>
                    ))}
                    {!editable && (
                      <p className="flex items-center gap-2 text-xs text-muted">
                        <LockKeyhole size={15} />
                        {t(
                          'Thông tin được khóa trong khi xử lý thanh toán.',
                          'Attendee details are locked while payment is being processed.',
                        )}
                      </p>
                    )}
                    {payment?.status === 'PENDING' && !payment.checkoutUrl && (
                      <CommerceNotice>
                        {t(
                          'Trang thanh toán đang được chuẩn bị. Bạn có thể thử lại cùng yêu cầu sau ít phút.',
                          'Your payment page is being prepared. You can retry the same request in a moment.',
                        )}
                      </CommerceNotice>
                    )}
                    <Button
                      type="submit"
                      className="w-full sm:w-auto"
                      disabled={
                        busy ||
                        !rows.length ||
                        !!(payment?.outcome === 'FAILED' && !payment.canRetry)
                      }
                    >
                      <CreditCard size={17} />
                      {busy
                        ? t('Đang xử lý…', 'Processing…')
                        : payment?.canRetry
                          ? t('Thử thanh toán lại với payOS', 'Retry payment with payOS')
                          : payment
                            ? t('Mở trang thanh toán payOS', 'Open payOS checkout')
                            : t('Lưu thông tin và thanh toán', 'Save details and pay')}
                    </Button>
                  </form>
                </section>
              </>
            )}
          </div>
          <aside className={`${panelClass} lg:sticky lg:top-24`}>
            <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
              {t('Tóm tắt đơn', 'Order summary')}
            </p>
            <h2 className="mb-5 text-xl font-bold">
              {t('Đơn', 'Booking')} #{booking.id}
            </h2>
            <ul className="mb-5 space-y-3">
              {booking.items.map((item, index) => (
                <li key={item.id} className="flex justify-between gap-3 text-sm">
                  <div>
                    <p className="font-medium">
                      {t('Vé', 'Ticket')} {index + 1} · {item.seatLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted">{item.attendeeName}</p>
                  </div>
                  <span className="shrink-0">{formatPrice(item.priceMinor, item.currency)}</span>
                </li>
              ))}
            </ul>
            <div className="mb-5 flex items-end justify-between border-t border-line pt-5">
              <span className="text-sm text-muted">{t('Tổng thanh toán', 'Total')}</span>
              <strong className="text-2xl">
                {formatPrice(booking.totalMinor, booking.currency)}
              </strong>
            </div>
            {booking.status === 'AWAITING_PAYMENT' && <Deadline expiresAt={booking.expiresAt} />}
            <p className="mt-5 flex gap-2 text-xs leading-5 text-muted">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" />
              {t(
                'Thanh toán được xử lý bởi payOS. Vé chỉ phát hành sau xác nhận của hệ thống.',
                'Payments are processed by payOS. Tickets are issued after server confirmation.',
              )}
            </p>
            {booking.status === 'AWAITING_PAYMENT' && !booking.expired && (
              <div className="mt-5 border-t border-line pt-5">
                {confirmCancel ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      {t(
                        'Hủy đơn và nhả toàn bộ vé đã giữ?',
                        'Cancel this booking and release all reserved tickets?',
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy}
                        onClick={() => setConfirmCancel(false)}
                      >
                        {t('Giữ đơn', 'Keep booking')}
                      </Button>
                      <Button disabled={busy} onClick={() => void cancel()}>
                        {t('Xác nhận hủy', 'Confirm cancellation')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={busy}
                    onClick={() => setConfirmCancel(true)}
                  >
                    {t('Hủy đơn và nhả vé', 'Cancel and release tickets')}
                  </Button>
                )}
              </div>
            )}
          </aside>
        </div>
      ) : !/^[1-9][0-9]*$/.test(bookingId) ? (
        <CommerceNotice tone="warning">
          {t(
            'Không tìm thấy mã đơn trong đường dẫn. Hãy mở đơn từ Vé của tôi.',
            'No booking ID was found. Open your booking from My tickets.',
          )}
        </CommerceNotice>
      ) : (
        <div role="status" className={`${panelClass} animate-pulse text-muted`}>
          {t('Đang kiểm tra đơn của bạn…', 'Checking your booking…')}
        </div>
      )}
    </CheckoutFrame>
  );
}
