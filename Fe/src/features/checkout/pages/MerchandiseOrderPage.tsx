import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { CheckCircle2, CreditCard, MapPin, Package, RotateCcw, Truck } from 'lucide-react';
import { z } from 'zod';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { ApiError } from '../../../shared/api/client';
import Button from '../../../shared/ui/Button';
import { formatPrice } from '../../../shared/utils/format';
import {
  CheckoutFrame,
  CommerceNotice,
  Deadline,
  fieldClass,
  outlineLinkClass,
  panelClass,
} from '../components/CheckoutFrame';
import { checkoutError, checkoutRequest } from '../api/checkout.api';
import {
  merchandiseOrderSchema,
  merchandiseOrdersSchema,
  merchandisePaymentSchema,
  merchandiseRefundSchema,
  type MerchandiseOrder,
  type MerchandiseOrders,
  type MerchandisePayment,
  type MerchandiseRefund,
} from '../api/merchandise-order.api';

type Command = {
  kind: 'pay' | 'cancel' | 'refund';
  key: string;
  path: string;
  body: object;
  uncertain: boolean;
};

function orderLabel(status: string, t: (vi: string, en: string) => string) {
  const labels: Record<string, string> = {
    AWAITING_PAYMENT: t('Chờ thanh toán', 'Awaiting payment'),
    CONFIRMED: t('Đã xác nhận', 'Confirmed'),
    CANCELLED: t('Đã hủy', 'Cancelled'),
    EXPIRED: t('Đã hết hạn', 'Expired'),
    REFUNDED: t('Đã hoàn tiền', 'Refunded'),
  };
  return labels[status] ?? status;
}
function fulfillmentLabel(status: string, t: (vi: string, en: string) => string) {
  const labels: Record<string, string> = {
    UNFULFILLED: t('Chưa giao hàng', 'Not yet shipped'),
    SHIPPED: t('Đang giao hàng', 'Shipped'),
    DELIVERED: t('Đã giao hàng', 'Delivered'),
    DELIVERY_FAILED: t('Giao hàng chưa thành công', 'Delivery unsuccessful'),
  };
  return labels[status] ?? status;
}
function refundLabel(status: string, t: (vi: string, en: string) => string) {
  const labels: Record<string, string> = {
    REQUESTED: t('Đang chờ xét duyệt', 'Awaiting review'),
    PROCESSING: t('Đang xử lý hoàn tiền', 'Refund in progress'),
    SUCCESS: t('Đã hoàn tiền', 'Refunded'),
    FAILED: t('Hoàn tiền cần kiểm tra', 'Refund needs attention'),
    REJECTED: t('Yêu cầu bị từ chối', 'Request declined'),
  };
  return labels[status] ?? t('Đang cập nhật', 'Updating');
}

export function MerchandiseOrderPage() {
  const { orderId } = useParams();
  const [search] = useSearchParams();
  const { user } = useAuthDialog();
  const id = orderId ?? search.get('merchandiseOrderId') ?? '';
  return <MerchandiseOrderContent key={`${user?.id ?? 'guest'}:${id}`} id={id} />;
}

function MerchandiseOrderContent({ id }: { id: string }) {
  const { accessToken } = useAuthDialog();
  const { t, locale } = useLocale();
  const [order, setOrder] = useState<MerchandiseOrder | null>(null),
    [payment, setPayment] = useState<MerchandisePayment | null>(null),
    [refunds, setRefunds] = useState<MerchandiseRefund[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<Command['kind'] | ''>(''),
    [reason, setReason] = useState(''),
    [confirmCancel, setConfirmCancel] = useState(false),
    [revision, setRevision] = useState(0);
  const command = useRef<Command | null>(null);

  useEffect(() => {
    if (!accessToken || !/^[1-9][0-9]*$/.test(id)) return;
    const ctrl = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let loading = false;
    async function load() {
      if (loading || ctrl.signal.aborted) return;
      loading = true;
      try {
        const data = await checkoutRequest(
          `/users/me/merchandise-orders/${id}`,
          merchandiseOrderSchema,
          accessToken,
          'GET',
          undefined,
          undefined,
          ctrl.signal,
        );
        if (ctrl.signal.aborted) return;
        setOrder(data);
        const last = data.payments.at(-1);
        let outcome: 'SUCCESS' | 'FAILED' | null = 'FAILED';
        if (last) {
          const current = await checkoutRequest(
            `/payments/${last.id}`,
            merchandisePaymentSchema,
            accessToken,
            'GET',
            undefined,
            undefined,
            ctrl.signal,
          );
          if (ctrl.signal.aborted) return;
          setPayment(current);
          outcome = current.outcome;
        }
        if (['CONFIRMED', 'REFUNDED'].includes(data.status)) {
          const rows = await checkoutRequest(
            `/users/me/merchandise-orders/${id}/refunds`,
            z.array(merchandiseRefundSchema),
            accessToken,
            'GET',
            undefined,
            undefined,
            ctrl.signal,
          );
          if (!ctrl.signal.aborted) setRefunds(rows);
        }
        if (data.status === 'AWAITING_PAYMENT' || outcome === null)
          timer = setTimeout(() => void load(), 6000);
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setError(checkoutError(e, locale));
          timer = setTimeout(() => void load(), 15000);
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
  }, [accessToken, id, locale, revision]);

  async function mutate(kind: Command['kind']) {
    if (!accessToken || !order || busy) return;
    if (command.current && command.current.kind !== kind) return;
    const prepared: Command = command.current ?? {
      kind,
      uncertain: false,
      key: crypto.randomUUID(),
      path: `/merchandise-orders/${id}/${kind === 'pay' ? 'payments' : kind === 'refund' ? 'refunds' : 'cancel'}`,
      body:
        kind === 'pay'
          ? {}
          : kind === 'refund'
            ? { reason: reason.trim() }
            : { version: order.version },
    };
    command.current = prepared;
    setPending(kind);
    setBusy(true);
    setError('');
    try {
      if (kind === 'pay') {
        const result = await checkoutRequest(
          prepared.path,
          merchandisePaymentSchema,
          accessToken,
          'POST',
          prepared.body,
          prepared.key,
        );
        setPayment(result);
        if (result.status === 'PENDING' && result.checkoutUrl) {
          const url = new URL(result.checkoutUrl);
          if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn')
            throw new Error('INVALID_PAYMENT_URL');
          window.location.assign(url.href);
        }
      } else if (kind === 'cancel') {
        setOrder(
          await checkoutRequest(
            prepared.path,
            merchandiseOrderSchema,
            accessToken,
            'POST',
            prepared.body,
            prepared.key,
          ),
        );
        setConfirmCancel(false);
      } else {
        await checkoutRequest(
          prepared.path,
          merchandiseRefundSchema,
          accessToken,
          'POST',
          prepared.body,
          prepared.key,
        );
        setReason('');
      }
      command.current = null;
      setPending('');
      setRevision((value) => value + 1);
    } catch (e) {
      setError(checkoutError(e, locale));
      if (
        !prepared.uncertain &&
        e instanceof ApiError &&
        e.status < 500 &&
        ![408, 429].includes(e.status) &&
        e.code !== 'REQUEST_IN_PROGRESS'
      ) {
        command.current = null;
        setPending('');
      } else prepared.uncertain = true;
    } finally {
      setBusy(false);
    }
  }

  const canPay =
    order?.status === 'AWAITING_PAYMENT' &&
    (!payment || payment.outcome === null || payment.canRetry) &&
    payment?.reconciliationStatus !== 'REQUIRED';
  const canRefund =
    order?.status === 'CONFIRMED' &&
    order.fulfillmentStatus === 'UNFULFILLED' &&
    !refunds.some((refund) => refund.status !== 'REJECTED');

  return (
    <CheckoutFrame title={t('Đơn sản phẩm của bạn', 'Your merchandise order')}>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {t(
            'Thanh toán, địa chỉ và giao hàng trong một nơi.',
            'Payment, delivery address and shipping in one place.',
          )}
        </p>
        <Link className={outlineLinkClass} to="/my-orders">
          <Package size={16} />
          {t('Tất cả đơn sản phẩm', 'All merchandise orders')}
        </Link>
      </div>
      {error && (
        <div className="mb-5">
          <CommerceNotice tone="error">{error}</CommerceNotice>
        </div>
      )}
      {pending && !busy && (
        <div className="mb-5">
          <CommerceNotice tone="warning">
            <p className="mb-3">
              {t(
                'Chưa xác định được kết quả yêu cầu. Các thao tác khác được khóa để tránh gửi trùng.',
                'The request result is uncertain. Other actions are locked to avoid duplicate submissions.',
              )}
            </p>
            <Button disabled={busy} onClick={() => void mutate(pending)}>
              {t('Thử lại cùng yêu cầu', 'Retry the same request')}
            </Button>
          </CommerceNotice>
        </div>
      )}
      {order ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <section className={panelClass}>
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">
                  {t('Đơn', 'Order')} #{order.id}
                </h2>
                <span className="rounded-full bg-accent-soft px-3 py-1.5 text-xs font-bold text-accent">
                  {orderLabel(order.status, t)}
                </span>
              </div>
              {order.status === 'CONFIRMED' && (
                <p className="mb-5 flex items-center gap-2 text-sm text-[var(--positive)]">
                  <CheckCircle2 size={18} />
                  {t(
                    'Thanh toán đã xác nhận. Đơn vị tổ chức sẽ xử lý đơn hàng.',
                    'Payment confirmed. The organizer will process your order.',
                  )}
                </p>
              )}
              <ul className="divide-y divide-line">
                {order.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <h3 className="font-semibold">{item.product_name_snapshot}</h3>
                      <p className="mt-1 text-sm text-muted">
                        {item.sku_name_snapshot} · {t('Số lượng', 'Quantity')} {item.quantity}
                      </p>
                      <p className="mt-2 text-xs text-muted">
                        {formatPrice(item.price_minor, order.currency)} / {t('sản phẩm', 'unit')}
                      </p>
                    </div>
                    <strong className="shrink-0 text-sm">
                      {formatPrice(
                        (BigInt(item.price_minor) * BigInt(item.quantity)).toString(),
                        order.currency,
                      )}
                    </strong>
                  </li>
                ))}
              </ul>
            </section>
            {payment?.reconciliationStatus === 'REQUIRED' ? (
              <CommerceNotice tone="warning">
                {t(
                  'Khoản thanh toán đang cần xác nhận. Hãy giữ đơn hiện tại và không thanh toán thêm.',
                  'Your payment needs review. Keep this order and do not make another payment.',
                )}
              </CommerceNotice>
            ) : payment?.outcome === null ? (
              <CommerceNotice>
                {t(
                  'Đang chờ kết quả từ hệ thống thanh toán. Trang tự cập nhật; quay về từ payOS chưa chứng minh đã trả tiền.',
                  'Waiting for payment confirmation. This page updates automatically; returning from payOS alone does not confirm payment.',
                )}
              </CommerceNotice>
            ) : payment?.outcome === 'FAILED' && order.status === 'AWAITING_PAYMENT' ? (
              <CommerceNotice tone="warning">
                {payment.canRetry
                  ? t(
                      'Lần thanh toán chưa thành công. Bạn có thể thử lại trong thời hạn giữ đơn ban đầu.',
                      'The payment attempt was unsuccessful. You may retry before the original order deadline.',
                    )
                  : t(
                      'Chưa thể tạo lần thanh toán mới. Hệ thống tiếp tục kiểm tra khoản thanh toán.',
                      'A new payment attempt is unavailable. The system is still reviewing the payment.',
                    )}
              </CommerceNotice>
            ) : null}
            <section className={panelClass}>
              <h2 className="mb-5 flex items-center gap-2 text-lg font-bold">
                <MapPin size={19} className="text-accent" />
                {t('Địa chỉ nhận hàng', 'Delivery address')}
              </h2>
              <p className="font-semibold">{order.recipient.name}</p>
              <p className="mt-2 text-sm text-muted">{order.recipient.phone}</p>
              <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted">
                {order.recipient.address}
              </p>
              <p className="mt-2 text-xs text-muted">{t('Việt Nam', 'Vietnam')}</p>
            </section>
            <section className={panelClass}>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <Truck size={20} className="text-accent" />
                {t('Theo dõi giao hàng', 'Shipping updates')}
              </h2>
              <p className="font-semibold">{fulfillmentLabel(order.fulfillmentStatus, t)}</p>
              {order.trackingReference && (
                <p className="mt-3 text-sm">
                  {t('Mã vận đơn:', 'Tracking reference:')}{' '}
                  <strong className="break-all">{order.trackingReference}</strong>
                </p>
              )}
              {order.fulfillmentNote && (
                <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted">
                  {order.fulfillmentNote}
                </p>
              )}
            </section>
            {refunds.length > 0 && (
              <section className={panelClass}>
                <h2 className="mb-4 font-bold">{t('Yêu cầu hoàn tiền', 'Refund requests')}</h2>
                <ul className="space-y-4">
                  {refunds.map((refund) => (
                    <li key={refund.id} className="rounded-xl bg-raised p-4 text-sm">
                      <p className="font-semibold">
                        #{refund.id} · {refundLabel(refund.status, t)} ·{' '}
                        {formatPrice(refund.amount_minor, order.currency)}
                      </p>
                      <p className="mt-2 text-muted">{refund.reason}</p>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {canRefund && (
              <form
                className={panelClass}
                onSubmit={(e) => {
                  e.preventDefault();
                  void mutate('refund');
                }}
              >
                <h2 className="mb-2 flex items-center gap-2 font-bold">
                  <RotateCcw size={18} />
                  {t('Yêu cầu hoàn toàn bộ đơn', 'Request a full refund')}
                </h2>
                <p className="mb-4 text-sm leading-6 text-muted">
                  {t(
                    'Áp dụng trước khi giao hàng và cần đơn vị tổ chức xét duyệt. Gửi yêu cầu chưa có nghĩa đã được chuyển tiền.',
                    'Available before shipping and subject to organizer approval. Submitting a request does not mean money has been transferred.',
                  )}
                </p>
                <label className="block text-sm font-medium">
                  {t('Lý do', 'Reason')}
                  <textarea
                    className={fieldClass}
                    required
                    minLength={3}
                    maxLength={500}
                    value={reason}
                    disabled={busy || !!pending}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </label>
                <Button
                  type="submit"
                  variant="outline"
                  className="mt-4"
                  disabled={busy || !!pending || reason.trim().length < 3}
                >
                  {t('Gửi yêu cầu hoàn tiền', 'Submit refund request')}
                </Button>
              </form>
            )}
          </div>
          <aside className={`${panelClass} lg:sticky lg:top-24`}>
            <h2 className="mb-5 font-bold">{t('Tổng thanh toán', 'Payment summary')}</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t('Sản phẩm', 'Items')}</dt>
                <dd>
                  {formatPrice(
                    (BigInt(order.totalMinor) - BigInt(order.shippingFeeMinor)).toString(),
                    order.currency,
                  )}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">{t('Phí giao hàng', 'Shipping fee')}</dt>
                <dd>{formatPrice(order.shippingFeeMinor, order.currency)}</dd>
              </div>
              <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
                <dt>{t('Tổng cộng', 'Total')}</dt>
                <dd className="text-2xl font-bold">
                  {formatPrice(order.totalMinor, order.currency)}
                </dd>
              </div>
            </dl>
            {order.status === 'AWAITING_PAYMENT' && (
              <div className="mt-5">
                <Deadline expiresAt={order.expiresAt} />
              </div>
            )}
            {canPay && (
              <Button
                className="mt-5 w-full"
                disabled={busy || !!pending}
                onClick={() => void mutate('pay')}
              >
                <CreditCard size={17} />
                {busy
                  ? t('Đang xử lý…', 'Processing…')
                  : payment?.canRetry
                    ? t('Thử thanh toán lại', 'Retry payment')
                    : t('Thanh toán với payOS', 'Pay with payOS')}
              </Button>
            )}
            {order.status === 'AWAITING_PAYMENT' && (
              <div className="mt-5 border-t border-line pt-5">
                {confirmCancel ? (
                  <div className="space-y-3">
                    <p className="text-sm">
                      {t(
                        'Hủy đơn và nhả toàn bộ sản phẩm đang giữ?',
                        'Cancel this order and release all reserved items?',
                      )}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={busy || !!pending}
                        onClick={() => setConfirmCancel(false)}
                      >
                        {t('Giữ đơn', 'Keep order')}
                      </Button>
                      <Button disabled={busy || !!pending} onClick={() => void mutate('cancel')}>
                        {t('Xác nhận hủy', 'Confirm cancellation')}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    className="w-full"
                    disabled={busy || !!pending}
                    onClick={() => setConfirmCancel(true)}
                  >
                    {t('Hủy đơn', 'Cancel order')}
                  </Button>
                )}
              </div>
            )}
            <p className="mt-5 text-xs leading-5 text-muted">
              {t(
                'Giá và phí giao hàng từ đơn đã được hệ thống ghi nhận. Thanh toán không gia hạn thời gian giữ hàng.',
                'Prices and shipping fees come from your confirmed order snapshot. Payment does not extend the reservation.',
              )}
            </p>
          </aside>
        </div>
      ) : /^[1-9][0-9]*$/.test(id) ? (
        <p role="status" className={`${panelClass} text-muted`}>
          {t('Đang tải đơn sản phẩm…', 'Loading your merchandise order…')}
        </p>
      ) : (
        <CommerceNotice tone="warning">
          {t(
            'Không tìm thấy mã đơn. Mở đơn từ lịch sử mua hàng.',
            'No order ID was found. Open an order from your purchase history.',
          )}
        </CommerceNotice>
      )}
    </CheckoutFrame>
  );
}

export function MyMerchandiseOrdersPage() {
  const { user } = useAuthDialog();
  return <MyOrdersContent key={user?.id ?? 'guest'} />;
}

function MyOrdersContent() {
  const { accessToken } = useAuthDialog(),
    { t, locale } = useLocale();
  const [page, setPage] = useState(1),
    [state, setState] = useState<{ page: number; data: MerchandiseOrders } | null>(null),
    [error, setError] = useState('');
  useEffect(() => {
    if (!accessToken) return;
    const ctrl = new AbortController();
    void checkoutRequest(
      `/users/me/merchandise-orders?page=${page}&pageSize=20`,
      merchandiseOrdersSchema,
      accessToken,
      'GET',
      undefined,
      undefined,
      ctrl.signal,
    )
      .then((data) => {
        if (!ctrl.signal.aborted) {
          setState({ page, data });
          setError('');
        }
      })
      .catch((e) => {
        if (!ctrl.signal.aborted) setError(checkoutError(e, locale));
      });
    return () => ctrl.abort();
  }, [accessToken, page, locale]);
  const data = state?.page === page ? state.data : null;
  return (
    <CheckoutFrame title={t('Đơn sản phẩm', 'Merchandise orders')}>
      <div className="space-y-5">
        {error && <CommerceNotice tone="error">{error}</CommerceNotice>}
        {!data && !error && (
          <p role="status" className={`${panelClass} text-muted`}>
            {t('Đang tải lịch sử đơn hàng…', 'Loading order history…')}
          </p>
        )}
        {data && !data.items.length && (
          <section className={`${panelClass} py-12 text-center`}>
            <Package size={44} className="mx-auto mb-4 text-accent" />
            <h2 className="mb-2 text-xl font-bold">
              {t('Chưa có đơn sản phẩm', 'No merchandise orders yet')}
            </h2>
            <p className="mb-6 text-sm text-muted">
              {t(
                'Khám phá sản phẩm chính thức từ các sự kiện.',
                'Discover official merchandise from events.',
              )}
            </p>
            <Link className={outlineLinkClass} to="/#merchandise">
              {t('Khám phá sản phẩm', 'Explore merchandise')}
            </Link>
          </section>
        )}
        {data?.items.map((order) => (
          <article
            key={order.id}
            className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}
          >
            <div>
              <h2 className="font-bold">
                {t('Đơn', 'Order')} #{order.id}
              </h2>
              <p className="mt-2 text-sm text-muted">
                {new Date(order.createdAt).toLocaleString(locale === 'vi' ? 'vi-VN' : 'en-US')} ·{' '}
                {orderLabel(order.status, t)}
              </p>
              <p className="mt-2 text-xs text-muted">
                {fulfillmentLabel(order.fulfillmentStatus, t)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <strong>{formatPrice(order.totalMinor, order.currency)}</strong>
              <Link className={outlineLinkClass} to={`/merchandise/orders/${order.id}`}>
                {t('Xem đơn', 'View order')}
              </Link>
            </div>
          </article>
        ))}
        {data && data.total > 20 && (
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              disabled={page <= 1}
              onClick={() => setPage((value) => value - 1)}
            >
              {t('Trang trước', 'Previous')}
            </Button>
            <span className="text-sm text-muted">
              {page} / {Math.ceil(data.total / 20)}
            </span>
            <Button
              variant="outline"
              disabled={page * 20 >= data.total}
              onClick={() => setPage((value) => value + 1)}
            >
              {t('Trang sau', 'Next')}
            </Button>
          </div>
        )}
      </div>
    </CheckoutFrame>
  );
}
