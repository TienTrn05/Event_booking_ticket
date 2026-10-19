import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Ticket, Users } from 'lucide-react';
import { z } from 'zod';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { usePublicEvent } from '../../events/hooks/usePublicEvent';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import Button from '../../../shared/ui/Button';
import { ApiError } from '../../../shared/api/client';
import { formatPrice } from '../../../shared/utils/format';
import {
  CheckoutFrame,
  CheckoutSteps,
  CommerceNotice,
  fieldClass,
  panelClass,
  Deadline,
} from '../components/CheckoutFrame';
import { NumberedSeatPicker } from '../components/NumberedSeatPicker';
import { ZonePicker } from '../components/ZonePicker';
import {
  checkoutRequest,
  checkoutError,
  sessionSchema,
  seatSchema,
  zoneInventorySchema,
  roomSchema,
  holdSchema,
  bookingSchema,
  stableKey,
  type Session,
  type Seat,
  type Room,
  type ZoneInventory,
} from '../api/checkout.api';

interface Selection {
  key: string;
  label: string;
  priceMinor: string;
  currency: string;
  sectionId?: string;
  seatId?: string;
}
interface PurchaseAttempt {
  sessionId: string;
  holdKey: string;
  mode: 'quantity' | 'seats';
  picks: (Selection & { name: string })[];
  zones: { sectionId: string; quantity: number }[];
  bookingKey?: string;
  holdId?: string;
  attendees?: { sessionSeatId: string; attendeeName: string }[];
}

export function SeatSelectionPage() {
  const { eventId = '' } = useParams(),
    { user } = useAuthDialog();
  return <SeatSelectionContent key={`${eventId}:${user?.id ?? 'guest'}`} eventId={eventId} />;
}

function SeatSelectionContent({ eventId }: { eventId: string }) {
  const { user, accessToken } = useAuthDialog(),
    navigate = useNavigate(),
    { t, locale } = useLocale();
  const { event, loading: eventLoading } = usePublicEvent(eventId, accessToken);
  const mode = event?.admission;
  const [sessions, setSessions] = useState<Session[]>([]),
    [sessionId, setSessionId] = useState(''),
    [seats, setSeats] = useState<Seat[]>([]),
    [zones, setZones] = useState<ZoneInventory | null>(null),
    [room, setRoom] = useState<Room | null>(null);
  const [selected, setSelected] = useState<string[]>([]),
    [quantities, setQuantities] = useState<Record<string, number>>({}),
    [names, setNames] = useState<Record<string, string>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [holdExpires, setHoldExpires] = useState(''),
    [attemptPending, setAttemptPending] = useState(false),
    [held, setHeld] = useState(false),
    [sessionsLoaded, setSessionsLoaded] = useState(false);
  const attempt = useRef<PurchaseAttempt | null>(null);

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
        if (!ctrl.signal.aborted) {
          setSessions(data);
          setSessionId((current) => current || data.find((s) => s.saleOpen)?.id || '');
          setSessionsLoaded(true);
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(checkoutError(e, locale));
      });
    return () => ctrl.abort();
  }, [eventId, locale]);

  useEffect(() => {
    if (!sessionId || !accessToken || !mode || attemptPending) return;
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
          if (mode === 'quantity') {
            const inventory = await checkoutRequest(
              `/events/${eventId}/sessions/${sessionId}/zones`,
              zoneInventorySchema,
              undefined,
              'GET',
              undefined,
              undefined,
              ctrl.signal,
            );
            if (!ctrl.signal.aborted) setZones(inventory);
          } else {
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
        }
        if (!['SOLD_OUT', 'CLOSED', 'LEFT'].includes(data.status))
          timer = setTimeout(
            () => void poll(),
            Math.max(1, data.pollAfterSeconds) * 1000 + Math.random() * 1000,
          );
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(checkoutError(e, locale));
          timer = setTimeout(() => void poll(), 15000);
        }
      }
    }
    void poll(true);
    return () => {
      ctrl.abort();
      if (timer) clearTimeout(timer);
    };
  }, [eventId, sessionId, accessToken, mode, attemptPending, locale]);

  const picks: Selection[] =
    mode === 'quantity'
      ? (zones?.items ?? []).flatMap((zone) =>
          Array.from({ length: quantities[zone.sectionId] ?? 0 }, (_, index) => ({
            key: `zone:${zone.sectionId}:${index}`,
            label: `${zone.name} · ${index + 1}`,
            sectionId: zone.sectionId,
            priceMinor: zone.priceMinor,
            currency: zone.currency,
          })),
        )
      : selected.flatMap((id) => {
          const seat = seats.find((item) => item.id === id);
          return seat
            ? [
                {
                  key: id,
                  seatId: id,
                  label: seat.label,
                  priceMinor: seat.priceMinor,
                  currency: seat.currency,
                },
              ]
            : [];
        });
  const total = picks.reduce((sum, pick) => sum + BigInt(pick.priceMinor), 0n).toString();
  const currency = picks[0]?.currency ?? event?.currency ?? 'VND';

  async function buy() {
    if (!user || !accessToken || !sessionId || busy || !picks.length) return;
    setBusy(true);
    setError('');
    try {
      const current: PurchaseAttempt = attempt.current ?? {
        sessionId,
        holdKey: crypto.randomUUID(),
        mode: mode === 'quantity' ? 'quantity' : 'seats',
        picks: picks.map((pick) => ({ ...pick, name: names[pick.key]?.trim() ?? '' })),
        zones: Object.entries(quantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([sectionId, quantity]) => ({ sectionId, quantity })),
      };
      attempt.current = current;
      setAttemptPending(true);
      if (!current.holdId) {
        const hold = await checkoutRequest(
          `/events/${eventId}/sessions/${current.sessionId}/${current.mode === 'quantity' ? 'zones' : 'seats'}/hold`,
          holdSchema,
          accessToken,
          'POST',
          current.mode === 'quantity'
            ? { zones: current.zones }
            : { seatIds: current.picks.map((pick) => pick.seatId).sort() },
          current.holdKey,
        );
        current.holdId = hold.id;
        setHoldExpires(hold.expiresAt);
        setHeld(true);
        const assigned = new Map<string, number>();
        current.attendees = hold.items.map((item) => {
          if (current.mode === 'seats')
            return {
              sessionSeatId: item.sessionSeatId,
              attendeeName:
                current.picks.find((pick) => pick.seatId === item.sessionSeatId)?.name ?? '',
            };
          const index = assigned.get(item.sectionId ?? '') ?? 0;
          assigned.set(item.sectionId ?? '', index + 1);
          return {
            sessionSeatId: item.sessionSeatId,
            attendeeName:
              current.picks.filter((pick) => pick.sectionId === item.sectionId)[index]?.name ?? '',
          };
        });
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
      setError(checkoutError(e, locale));
      if (
        !attempt.current?.holdId &&
        e instanceof ApiError &&
        [
          'SEAT_UNAVAILABLE',
          'ZONE_UNAVAILABLE',
          'SALE_CLOSED',
          'WAITING_ROOM_REQUIRED',
          'TICKETING_MODE_CONFLICT',
          'INVALID_INPUT',
        ].includes(e.code ?? '')
      ) {
        attempt.current = null;
        setAttemptPending(false);
      }
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (busy || !accessToken || !user || !attempt.current?.holdId) return;
    setBusy(true);
    setError('');
    try {
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
      setHeld(false);
      setSelected([]);
      setQuantities({});
      setNames({});
      setHoldExpires('');
      setRoom(null);
      setSessionId('');
    } catch (e) {
      setError(checkoutError(e, locale));
    } finally {
      setBusy(false);
    }
  }

  return (
    <CheckoutFrame title={t('Chọn vé cho cuộc hẹn của bạn', 'Find your place at the event')}>
      <CheckoutSteps current={1} />
      {error && (
        <div className="mb-5">
          <CommerceNotice tone="error">{error}</CommerceNotice>
        </div>
      )}
      {eventLoading && (
        <p role="status" className="mb-5 text-muted">
          {t('Đang tải sự kiện…', 'Loading event…')}
        </p>
      )}
      {!eventLoading && !event && (
        <CommerceNotice tone="warning">
          {t(
            'Không tìm thấy sự kiện đang công khai. Vui lòng quay lại trang khám phá.',
            'This event is not publicly available. Please return to Explore.',
          )}
        </CommerceNotice>
      )}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <section className={panelClass}>
            {event && (
              <div className="mb-5 border-b border-line pb-5">
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-accent">
                  {event.category}
                </p>
                <h2 className="text-xl font-bold">{event.title}</h2>
                <p className="mt-2 text-sm text-muted">
                  {event.venue} · {event.city}
                </p>
              </div>
            )}
            <label className="block text-sm font-semibold">
              {t('Chọn suất tham dự', 'Choose a session')}
              <select
                className={fieldClass}
                value={sessionId}
                disabled={busy || attemptPending}
                onChange={(e) => {
                  setSessionId(e.target.value);
                  setRoom(null);
                  setSeats([]);
                  setZones(null);
                  setSelected([]);
                  setQuantities({});
                  setNames({});
                  setError('');
                }}
              >
                <option value="">{t('Chọn suất đang mở bán', 'Select a session on sale')}</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id} disabled={!session.saleOpen}>
                    {new Date(session.startsAt).toLocaleString(
                      locale === 'vi' ? 'vi-VN' : 'en-US',
                      { timeZone: session.timezone },
                    )}
                    {session.saleOpen ? '' : t(' · Chưa mở/đã đóng bán', ' · Sales closed')}
                  </option>
                ))}
              </select>
            </label>
            {sessionsLoaded && !sessions.length && (
              <p className="mt-4 text-sm text-muted">
                {t('Sự kiện chưa có suất được công bố.', 'No sessions have been published yet.')}
              </p>
            )}
          </section>
          {room && room.status !== 'ADMITTED' && (
            <CommerceNotice>
              <h2 className="mb-2 flex items-center gap-2 font-bold">
                <Users size={18} />
                {room.status === 'SOLD_OUT'
                  ? t('Suất đã hết vé', 'Session sold out')
                  : room.status === 'CLOSED'
                    ? t('Suất đã đóng bán', 'Sales have closed')
                    : room.status === 'PAUSED'
                      ? t('Phòng chờ đang tạm dừng', 'The waiting room is paused')
                      : t('Bạn đang trong phòng chờ', 'You are in the waiting room')}
              </h2>
              {room.position !== null && (
                <p>
                  {t('Vị trí hiện tại:', 'Current position:')} {room.position}
                </p>
              )}
              <p>
                {t(
                  'Trang tự cập nhật lượt. Lượt chờ chưa giữ vé cho bạn.',
                  'Your place updates automatically. Joining the queue does not reserve tickets.',
                )}
              </p>
            </CommerceNotice>
          )}
          {(room?.status === 'ADMITTED' || holdExpires) && (
            <>
              <div>
                <h2 className="mb-2 text-lg font-bold">
                  {mode === 'quantity'
                    ? t('Chọn khu và số lượng', 'Choose a zone and quantity')
                    : t('Chọn ghế theo loại vé', 'Choose your seats')}
                </h2>
                <p className="text-sm leading-6 text-muted">
                  {t(
                    'Tối đa 6 vé mỗi đơn. Giá và chỗ còn trống được xác nhận khi giữ vé.',
                    'Up to 6 tickets per order. Prices and availability are confirmed when you reserve.',
                  )}
                </p>
              </div>
              {mode === 'quantity' ? (
                zones ? (
                  <ZonePicker
                    inventory={zones}
                    quantities={quantities}
                    disabled={busy || attemptPending}
                    onChange={(id, quantity) =>
                      setQuantities((current) => ({ ...current, [id]: quantity }))
                    }
                  />
                ) : (
                  <p role="status" className="text-muted">
                    {t('Đang tải các khu…', 'Loading zones…')}
                  </p>
                )
              ) : (
                <NumberedSeatPicker
                  seats={seats}
                  selected={selected}
                  disabled={busy || attemptPending}
                  onToggle={(id) =>
                    setSelected((current) =>
                      current.includes(id)
                        ? current.filter((value) => value !== id)
                        : [...current, id],
                    )
                  }
                />
              )}
              {picks.length > 0 && (
                <section className={panelClass}>
                  <h2 className="mb-2 text-lg font-bold">
                    {t('Ai sẽ cùng tham dự?', 'Who is attending?')}
                  </h2>
                  <p className="mb-5 text-sm text-muted">
                    {t(
                      'Mỗi vé dành cho một người. Bạn sẽ bổ sung giấy tờ ở bước thanh toán.',
                      'Each ticket belongs to one attendee. Identity details follow at checkout.',
                    )}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {picks.map((pick, index) => (
                      <label className="block text-sm font-medium" key={pick.key}>
                        {t('Vé', 'Ticket')} {index + 1} · {pick.label}
                        <input
                          className={fieldClass}
                          value={names[pick.key] ?? ''}
                          disabled={busy || attemptPending}
                          autoComplete="off"
                          maxLength={200}
                          placeholder={t('Họ tên đúng trên CCCD', 'Full name on identity document')}
                          onChange={(e) =>
                            setNames((current) => ({ ...current, [pick.key]: e.target.value }))
                          }
                        />
                      </label>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
        <aside className={`${panelClass} lg:sticky lg:top-24`}>
          <h2 className="mb-5 flex items-center gap-2 font-bold">
            <Ticket size={19} className="text-accent" />
            {t('Vé bạn đã chọn', 'Your selection')}
          </h2>
          {picks.length ? (
            <ul className="mb-5 space-y-3">
              {picks.map((pick) => (
                <li key={pick.key} className="flex justify-between gap-3 text-sm">
                  <span className="min-w-0 break-words">{pick.label}</span>
                  <span className="shrink-0 font-medium">
                    {formatPrice(pick.priceMinor, pick.currency)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-6 rounded-xl bg-raised p-4 text-sm leading-6 text-muted">
              {t(
                'Chọn suất rồi chọn ghế hoặc số lượng vé để tiếp tục.',
                'Choose a session, then select seats or ticket quantities to continue.',
              )}
            </p>
          )}
          <div className="mb-5 flex items-end justify-between gap-3 border-t border-line pt-5">
            <span className="text-sm text-muted">{t('Tạm tính', 'Subtotal')}</span>
            <span className="text-2xl font-bold">{formatPrice(total, currency)}</span>
          </div>
          {holdExpires && (
            <div className="mb-4">
              <Deadline expiresAt={holdExpires} />
            </div>
          )}
          <Button
            className="w-full"
            disabled={
              busy ||
              !picks.length ||
              picks.some((pick) => !names[pick.key]?.trim()) ||
              (!attemptPending && room?.status !== 'ADMITTED')
            }
            onClick={() => void buy()}
          >
            {busy
              ? t('Đang xử lý…', 'Processing…')
              : attemptPending
                ? t('Thử lại yêu cầu hiện tại', 'Retry this request')
                : t(
                    mode === 'quantity' ? 'Giữ vé và tiếp tục' : 'Giữ ghế và tiếp tục',
                    'Reserve and continue',
                  )}
            <ArrowRight size={16} />
          </Button>
          {attemptPending && (
            <div className="mt-3">
              <p className="mb-3 text-xs leading-5 text-muted">
                {t(
                  'Yêu cầu đã được khóa để thử lại an toàn. Hãy dùng lại yêu cầu này nếu kết nối gián đoạn.',
                  'This request is locked for a safe retry. Reuse it if the connection is interrupted.',
                )}
              </p>
              {held && (
                <Button
                  variant="outline"
                  className="w-full"
                  disabled={busy}
                  onClick={() => void reset()}
                >
                  {t('Nhả vé và chọn lại', 'Release and start again')}
                </Button>
              )}
            </div>
          )}
          <p className="mt-5 flex gap-2 border-t border-line pt-5 text-xs leading-5 text-muted">
            <ShieldCheck size={17} className="mt-0.5 shrink-0" />
            {t(
              'Giữ vé 5 phút sau khi hệ thống xác nhận. Bước thanh toán không gia hạn thời gian giữ.',
              'Reservations last 5 minutes after confirmation. Checkout does not extend the deadline.',
            )}
          </p>
        </aside>
      </div>
    </CheckoutFrame>
  );
}
