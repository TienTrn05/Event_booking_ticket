import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { ui } from '../../../shared/styles/classes';
import { formatPrice } from '../../../shared/utils/format';
import { CheckoutFrame, Deadline, fieldClass } from '../components/CheckoutFrame';
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
export function CheckoutPage() {
  const route = useParams(),
    [search] = useSearchParams(),
    bookingId = route.bookingId ?? search.get('bookingId') ?? '',
    { user } = useAuthDialog();
  return <CheckoutContent key={`${user?.id ?? 'guest'}:${bookingId}`} bookingId={bookingId} />;
}
function CheckoutContent({ bookingId }: { bookingId: string }) {
  const { user, accessToken } = useAuthDialog();
  const [booking, setBooking] = useState<Booking | null>(null),
    [payment, setPayment] = useState<Payment | null>(null),
    [rows, setRows] = useState<AttendeeForm[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loadedOwner, setLoadedOwner] = useState('');
  const dirty = useRef(false),
    paymentKey = useRef('');
  useEffect(() => {
    if (!user || !accessToken || !/^[1-9][0-9]*$/.test(bookingId)) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let initialized = false;
    async function load() {
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
        }
        if (data.status === 'AWAITING_PAYMENT' || data.paymentId)
          timer = setTimeout(() => void load(), 5000 + Math.random() * 2000);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(checkoutError(e));
          timer = setTimeout(() => void load(), 10000);
        }
      }
    }
    void load();
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [bookingId, accessToken, user]);
  function edit(index: number, field: keyof AttendeeForm, value: string) {
    dirty.current = true;
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }
  async function pay() {
    if (!accessToken || !user || !booking || busy) return;
    setBusy(true);
    setError('');
    try {
      if (!payment || (payment.status === 'FAILED' && payment.receivedMinor === '0')) {
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
        `${booking.id}:${payment?.status === 'FAILED' ? payment.id : 'initial'}`,
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
          ? 'Nhập đủ 12 số CCCD cho từng người tham dự. Khi sửa thông tin đã lưu, cần nhập lại CCCD cho tất cả vé.'
          : checkoutError(e),
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
    } catch (e) {
      setError(checkoutError(e));
    } finally {
      setBusy(false);
    }
  }
  const editable =
    booking?.status === 'AWAITING_PAYMENT' &&
    !booking.expired &&
    (!payment || (payment.status === 'FAILED' && payment.receivedMinor === '0'));
  return (
    <CheckoutFrame title="Thông tin vé và thanh toán">
      {error && (
        <p role="alert" className="mb-5 rounded-xl border border-red-400 p-4">
          {error}
        </p>
      )}
      {booking && loadedOwner === user?.id ? (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-300/30 p-6">
            <p>
              Đơn #{booking.id} · {booking.items.length} vé
            </p>
            <p className="text-2xl font-semibold">
              {formatPrice(booking.totalMinor, booking.currency)}
            </p>
            {booking.status === 'AWAITING_PAYMENT' && <Deadline expiresAt={booking.expiresAt} />}
          </div>
          {booking.status === 'CONFIRMED' ? (
            <div role="status">
              <h2 className="text-2xl font-bold">Đặt vé thành công</h2>
              <Link className={ui('button')} to="/my-tickets">
                Xem vé và QR
              </Link>
            </div>
          ) : payment?.reconciliationStatus === 'REQUIRED' ? (
            <div role="status" className="rounded-2xl border border-amber-400 p-6">
              <h2 className="text-xl font-semibold">Khoản thanh toán cần đối soát</h2>
              <p>
                Hệ thống đã ghi nhận {formatPrice(payment.receivedMinor, payment.currency)}. Đơn
                chưa được xác nhận hoặc có khoản tiền chênh lệch. Vui lòng không thanh toán thêm.
              </p>
            </div>
          ) : booking.status !== 'AWAITING_PAYMENT' || booking.expired ? (
            <div role="status">
              <p>
                Đơn đã hủy hoặc hết thời gian giữ chỗ. Nếu bạn đã chuyển tiền, hệ thống sẽ tiếp tục
                kiểm tra kết quả.
              </p>
              <Link to="/" className={ui('button-outline')}>
                Chọn sự kiện khác
              </Link>
            </div>
          ) : (
            <>
              <p>
                Mỗi vé cần thông tin của đúng người tham dự. Tuổi được kiểm tra theo ngày diễn ra
                suất; mang CCCD thật để đối chiếu tại cửa. Thông tin chưa được xác minh chỉ bằng
                việc nhập vào đây.
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
                    className="grid gap-4 rounded-2xl border border-slate-300/30 p-5 sm:grid-cols-2"
                  >
                    <legend className="px-2 font-semibold">
                      Vé {index + 1} · {booking.items[index]?.seatLabel}
                    </legend>
                    <label>
                      Họ và tên trên CCCD
                      <input
                        className={fieldClass}
                        required
                        maxLength={200}
                        autoComplete="off"
                        value={row.fullName}
                        onChange={(e) => edit(index, 'fullName', e.target.value)}
                      />
                    </label>
                    <label>
                      Ngày sinh
                      <input
                        className={fieldClass}
                        type="date"
                        required
                        value={row.dateOfBirth}
                        onChange={(e) => edit(index, 'dateOfBirth', e.target.value)}
                      />
                    </label>
                    <label>
                      Số điện thoại
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
                    <label>
                      Số CCCD
                      <input
                        className={fieldClass}
                        inputMode="numeric"
                        autoComplete="off"
                        maxLength={12}
                        pattern="[0-9]{12}"
                        required={!row.maskedCccd}
                        placeholder={row.maskedCccd ?? '12 chữ số'}
                        value={row.cccd}
                        onChange={(e) => edit(index, 'cccd', e.target.value)}
                      />
                    </label>
                  </fieldset>
                ))}
                {payment?.status === 'PENDING' && !payment.checkoutUrl && (
                  <p role="status">
                    Trang thanh toán đang được chuẩn bị. Bạn có thể thử lại yêu cầu hiện tại sau ít
                    phút.
                  </p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button type="submit" className={ui('button')} disabled={busy || !rows.length}>
                    {busy
                      ? 'Đang xử lý…'
                      : payment
                        ? 'Mở / thử lại trang thanh toán'
                        : 'Lưu thông tin và thanh toán với payOS'}
                  </button>
                  <button
                    type="button"
                    className={ui('button-outline')}
                    disabled={busy}
                    onClick={() => void cancel()}
                  >
                    Hủy đơn và nhả ghế
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      ) : (
        <p role="status">Đang kiểm tra đơn của bạn…</p>
      )}
    </CheckoutFrame>
  );
}
