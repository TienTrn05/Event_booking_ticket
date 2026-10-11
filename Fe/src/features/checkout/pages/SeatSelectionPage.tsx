import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { ui } from '../../../shared/styles/classes';
import { formatPrice } from '../../../shared/utils/format';
import { CheckoutFrame, fieldClass, Deadline } from '../components/CheckoutFrame';
import {
  checkoutRequest,
  checkoutError,
  sessionSchema,
  seatSchema,
  roomSchema,
  holdSchema,
  bookingSchema,
  stableKey,
  type Session,
  type Seat,
  type Room,
} from '../api/checkout.api';
export function SeatSelectionPage() {
  const { eventId = '' } = useParams(),
    { user } = useAuthDialog();
  return <SeatSelectionContent key={`${eventId}:${user?.id ?? 'guest'}`} eventId={eventId} />;
}
function SeatSelectionContent({ eventId }: { eventId: string }) {
  const { user, accessToken } = useAuthDialog(),
    navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]),
    [sessionId, setSessionId] = useState(''),
    [seats, setSeats] = useState<Seat[]>([]),
    [room, setRoom] = useState<Room | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [names, setNames] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [holdExpires, setHoldExpires] = useState('');
  const [attemptPending, setAttemptPending] = useState(false);
  const attempt = useRef<{
    holdKey: string;
    bookingKey?: string;
    holdId?: string;
    seatIds: string[];
    attendees: { sessionSeatId: string; attendeeName: string }[];
  } | null>(null);
  useEffect(() => {
    const ctrl = new AbortController();
    checkoutRequest(
      `/events/${eventId}/sessions`,
      z.array(sessionSchema),
      undefined,
      'GET',
      undefined,
      undefined,
      ctrl.signal,
    )
      .then((data) => {
        setSessions(data);
        setSessionId(data.find((s) => s.saleOpen)?.id ?? '');
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(checkoutError(e));
      });
    return () => ctrl.abort();
  }, [eventId]);
  useEffect(() => {
    if (!sessionId || !accessToken) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ctrl = new AbortController();
    async function poll(join = false) {
      try {
        const data = await checkoutRequest(
          `/events/${eventId}/sessions/${sessionId}/waiting-room`,
          roomSchema,
          accessToken,
          join ? 'POST' : 'GET',
          join ? {} : undefined,
          undefined,
          ctrl.signal,
        );
        if (ctrl.signal.aborted) return;
        setRoom(data);
        if (data.status === 'ADMITTED') {
          const inventory = await checkoutRequest(
            `/events/${eventId}/sessions/${sessionId}/seats`,
            z.object({ items: z.array(seatSchema) }),
            undefined,
            'GET',
            undefined,
            undefined,
            ctrl.signal,
          );
          if (!ctrl.signal.aborted) setSeats(inventory.items);
        }
        if (!['SOLD_OUT', 'CLOSED', 'LEFT'].includes(data.status))
          timer = setTimeout(
            () => void poll(),
            (data.pollAfterSeconds + Math.random() * 10) * 1000,
          );
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(checkoutError(e));
          timer = setTimeout(() => void poll(true), 35000);
        }
      }
    }
    void poll(true);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [eventId, sessionId, accessToken]);
  async function buy() {
    if (!user || !accessToken || !sessionId || busy) return;
    setBusy(true);
    setError('');
    try {
      const current = attempt.current ?? {
        holdKey: crypto.randomUUID(),
        seatIds: [...selected].sort(),
        attendees: selected.map((id) => ({
          sessionSeatId: id,
          attendeeName: names[id]?.trim() ?? '',
        })),
      };
      attempt.current = current;
      setAttemptPending(true);
      if (!current.holdId) {
        const hold = await checkoutRequest(
          `/events/${eventId}/sessions/${sessionId}/seats/hold`,
          holdSchema,
          accessToken,
          'POST',
          { seatIds: current.seatIds },
          current.holdKey,
        );
        current.holdId = hold.id;
        setHoldExpires(hold.expiresAt);
      }
      current.bookingKey ??= stableKey(user.id, 'booking', current.holdId);
      const booking = await checkoutRequest(
        '/bookings',
        bookingSchema,
        accessToken,
        'POST',
        { holdId: current.holdId, attendees: current.attendees },
        current.bookingKey,
      );
      void navigate(`/checkout/${booking.id}`);
    } catch (e) {
      setError(checkoutError(e));
    } finally {
      setBusy(false);
    }
  }
  async function reset() {
    if (busy || !accessToken || !user) return;
    setBusy(true);
    try {
      if (attempt.current?.holdId)
        await checkoutRequest(
          `/holds/${attempt.current.holdId}`,
          z.unknown(),
          accessToken,
          'DELETE',
          undefined,
          stableKey(user.id, 'release', attempt.current.holdId),
        );
      attempt.current = null;
      setAttemptPending(false);
      setSelected([]);
      setHoldExpires('');
      setRoom(null);
      setSessionId('');
    } catch (e) {
      setError(checkoutError(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <CheckoutFrame title="Chọn suất và ghế">
      <div className="space-y-6">
        <label className="block">
          Suất diễn
          <select
            className={fieldClass}
            value={sessionId}
            disabled={busy || attemptPending}
            onChange={(e) => {
              setSessionId(e.target.value);
              setRoom(null);
              setSeats([]);
              setSelected([]);
              setNames({});
            }}
          >
            <option value="">Chọn suất đang mở bán</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id} disabled={!s.saleOpen}>
                {new Date(s.startsAt).toLocaleString('vi-VN', { timeZone: s.timezone })}
                {s.saleOpen ? '' : ' · Chưa mở/đã đóng bán'}
              </option>
            ))}
          </select>
        </label>
        {error && (
          <p role="alert" className="rounded-xl border border-red-400 p-4">
            {error}
          </p>
        )}
        {room && room.status !== 'ADMITTED' && (
          <div role="status" className="rounded-2xl border border-slate-300/40 p-6">
            <h2 className="text-xl font-semibold">
              {room.status === 'SOLD_OUT'
                ? 'Suất diễn đã hết vé'
                : room.status === 'CLOSED'
                  ? 'Suất diễn đã đóng bán'
                  : 'Bạn đang trong phòng chờ'}
            </h2>
            {room.position && <p>Vị trí hiện tại: {room.position.toLocaleString('vi-VN')}</p>}
            <p>Trang tự cập nhật lượt. Bạn chưa cần chọn ghế khi đang chờ.</p>
          </div>
        )}
        {(room?.status === 'ADMITTED' || holdExpires) && (
          <>
            <p className="text-sm">
              Chọn tối đa 6 ghế. Giá và quyền giữ ghế sẽ được xác nhận khi bạn tiếp tục.
            </p>
            <div className="flex flex-wrap gap-2">
              <span>○ Trống</span>
              <span>● Đang giữ / đã bán</span>
            </div>
            <div className="grid max-h-[480px] grid-cols-4 gap-2 overflow-auto rounded-2xl border border-slate-300/30 p-4 sm:grid-cols-8 lg:grid-cols-12">
              {seats.map((seat) => (
                <button
                  key={seat.id}
                  aria-pressed={selected.includes(seat.id)}
                  disabled={
                    busy ||
                    attemptPending ||
                    seat.availability !== 'AVAILABLE' ||
                    (!selected.includes(seat.id) && selected.length >= 6)
                  }
                  title={`${seat.label} · ${formatPrice(seat.priceMinor, seat.currency)}`}
                  className={`rounded-lg border p-2 text-xs ${selected.includes(seat.id) ? 'bg-emerald-600 text-white' : 'border-slate-300/40'} disabled:opacity-40`}
                  onClick={() =>
                    setSelected((current) =>
                      current.includes(seat.id)
                        ? current.filter((id) => id !== seat.id)
                        : [...current, seat.id],
                    )
                  }
                >
                  {seat.label}
                </button>
              ))}
            </div>
            {!seats.length && <p>Suất diễn chưa có ghế mở bán.</p>}
            {selected.map((id, i) => (
              <label className="block" key={id}>
                Người tham dự vé {i + 1} · {seats.find((s) => s.id === id)?.label}
                <input
                  className={fieldClass}
                  value={names[id] ?? ''}
                  disabled={busy || attemptPending}
                  autoComplete="off"
                  maxLength={200}
                  placeholder="Họ và tên đúng trên CCCD"
                  onChange={(e) => setNames({ ...names, [id]: e.target.value })}
                />
              </label>
            ))}
            <p className="text-lg font-semibold">
              Tổng:{' '}
              {formatPrice(
                selected
                  .reduce(
                    (sum, id) => sum + BigInt(seats.find((s) => s.id === id)?.priceMinor ?? '0'),
                    0n,
                  )
                  .toString(),
                'VND',
              )}
            </p>
            {holdExpires && <Deadline expiresAt={holdExpires} />}
            <div className="flex flex-wrap gap-3">
              <button
                className={ui('button')}
                disabled={busy || !selected.length || selected.some((id) => !names[id]?.trim())}
                onClick={() => void buy()}
              >
                {busy
                  ? 'Đang xử lý…'
                  : attemptPending
                    ? 'Thử lại yêu cầu hiện tại'
                    : 'Giữ ghế và tiếp tục'}
              </button>
              {attemptPending && (
                <button
                  className={ui('button-outline')}
                  disabled={busy}
                  onClick={() => void reset()}
                >
                  Nhả ghế / chọn lại
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </CheckoutFrame>
  );
}
