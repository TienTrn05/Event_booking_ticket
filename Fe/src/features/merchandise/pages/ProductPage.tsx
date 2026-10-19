import { useRef, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Image, PackageCheck, ShieldCheck, Truck } from 'lucide-react';
import { formatPrice } from '../../../shared/utils/format';
import { merchandiseSchema } from '../../catalog/api/catalog.api';
import { useCatalogResource } from '../../catalog/hooks/useCatalogResource';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { EmptyState, ErrorState, Skeleton } from '../../../shared/ui/Page';
import Button from '../../../shared/ui/Button';
import { ApiError } from '../../../shared/api/client';
import {
  createMerchandiseOrder,
  orderInputSchema,
  publicSkusSchema,
  type PublicSkus,
} from '../api/merchandise.api';

export function ProductPage() {
  const { productId } = useParams();
  const { accessToken, user } = useAuthDialog();
  const product = useCatalogResource(
    productId ? `/merchandise/${encodeURIComponent(productId)}` : null,
    merchandiseSchema,
    accessToken,
  );
  const inventory = useCatalogResource(
    productId ? `/merchandise/${encodeURIComponent(productId)}/skus` : null,
    publicSkusSchema,
  );
  const { t } = useLocale();
  if (!product.data)
    return (
      <main id="main" className="mx-auto min-h-[55vh] max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8">
        {product.loading ? (
          <Skeleton className="h-96" />
        ) : product.error ? (
          <ErrorState onRetry={product.retry} />
        ) : (
          <EmptyState
            title={t('Không tìm thấy sản phẩm', 'Product unavailable')}
            action={
              <Link to="/#merchandise" className="font-semibold text-accent">
                {t('Về bộ sưu tập', 'Back to collections')}
              </Link>
            }
          />
        )}
      </main>
    );
  const item = product.data;
  return (
    <main id="main" className="mx-auto max-w-[1240px] px-4 py-10 sm:px-6 lg:px-8">
      <nav
        className="mb-6 flex flex-wrap gap-2 text-sm text-muted"
        aria-label={t('Đường dẫn', 'Breadcrumb')}
      >
        <Link to="/#merchandise" className="hover:text-accent">
          {t('Sản phẩm sự kiện', 'Merchandise')}
        </Link>
        <span>/</span>
        <Link to={`/events/${item.eventId}`} className="hover:text-accent">
          {item.eventTitle}
        </Link>
      </nav>
      <div className="grid items-start gap-8 lg:grid-cols-2">
        <div className="overflow-hidden rounded-2xl border border-line bg-raised">
          {item.image ? (
            <img
              src={item.image}
              alt={item.name}
              width={800}
              height={800}
              className="aspect-square w-full object-contain"
              fetchPriority="high"
            />
          ) : (
            <div className="grid aspect-square place-items-center text-muted">
              <Image size={56} />
            </div>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-accent">
            {t('Bộ sưu tập sự kiện', 'Event collection')}
          </p>
          <h1 className="mt-3 break-words text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
            {item.name}
          </h1>
          <p className="mt-4 text-sm text-muted">
            {t('Từ', 'By')}{' '}
            <Link to={`/organizers/${item.organizerId}`} className="font-semibold text-accent">
              {item.organizer}
            </Link>
          </p>
          <p className="mt-6 whitespace-pre-line text-base leading-8 text-muted">
            {item.description}
          </p>
          <div className="mt-6 rounded-xl bg-accent-soft p-4 text-sm leading-6 text-foreground">
            <p className="flex items-start gap-3">
              <ShieldCheck className="mt-0.5 shrink-0 text-accent" size={20} />
              {item.requiresTicket
                ? t(
                    'Dành cho người mua có vé sự kiện còn hợp lệ hoặc đã sử dụng. Hệ thống kiểm tra vé của chính người mua khi đặt hàng.',
                    'Available to buyers who hold a valid or used ticket for this event. The buyer’s own ticket is verified when ordering.',
                  )
                : t(
                    'Có thể mua sản phẩm này mà không cần vé sự kiện.',
                    'You can buy this product without an event ticket.',
                  )}
            </p>
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted">
            <Truck size={18} />
            {t(
              'Giao hàng tại Việt Nam. Mua sản phẩm không cấp vé vào cửa.',
              'Delivery within Vietnam. Merchandise does not include event admission.',
            )}
          </p>
          <div className="mt-6">
            {inventory.loading ? (
              <Skeleton className="h-80" />
            ) : inventory.error ? (
              <ErrorState onRetry={inventory.retry} />
            ) : inventory.data ? (
              <PurchaseForm
                key={`${productId}:${user?.id ?? 'anonymous'}`}
                inventory={inventory.data}
                onRefresh={inventory.retry}
              />
            ) : (
              <EmptyState title={t('Chưa có sản phẩm khả dụng', 'No variants available')} />
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

type Attempt = { body: string; key: string };
function PurchaseForm({ inventory, onRefresh }: { inventory: PublicSkus; onRefresh: () => void }) {
  const { accessToken, openAuth } = useAuthDialog();
  const { t } = useLocale();
  const navigate = useNavigate();
  const [skuId, setSkuId] = useState(inventory.skus.find((sku) => sku.available > 0)?.id ?? '');
  const [quantity, setQuantity] = useState(1);
  const [recipient, setRecipient] = useState({ name: '', phone: '', address: '' });
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);
  const sku = inventory.skus.find((item) => item.id === skuId);
  const validQuantity = Number.isInteger(quantity) && quantity >= 1 && quantity <= 20;
  const estimatedTotal =
    sku && validQuantity
      ? (BigInt(sku.priceMinor) * BigInt(quantity) + BigInt(inventory.shippingFeeMinor)).toString()
      : null;
  const locked = busy || attempt !== null;
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken) {
      openAuth('login');
      return;
    }
    if (inFlight.current) return;
    let command = attempt;
    const retryingUncertainAttempt = command !== null;
    if (!command) {
      const parsed = orderInputSchema.safeParse({
        eventId: inventory.eventId,
        items: [{ skuId, quantity }],
        recipient: { ...recipient, country: 'VN' },
      });
      if (!parsed.success) {
        setMessage(
          t(
            'Kiểm tra loại sản phẩm, số lượng và thông tin người nhận. SĐT dùng 0 hoặc +84 và 9 chữ số tiếp theo; địa chỉ ít nhất 10 ký tự.',
            'Check the variant, quantity, and recipient. Phone numbers start with 0 or +84 followed by 9 digits; the address needs at least 10 characters.',
          ),
        );
        return;
      }
      command = { key: crypto.randomUUID(), body: JSON.stringify(parsed.data) };
      setAttempt(command);
    }
    inFlight.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const order = await createMerchandiseOrder(command.body, command.key, accessToken);
      void navigate(`/merchandise/orders/${order.id}`);
    } catch (error: unknown) {
      const definitive =
        !retryingUncertainAttempt &&
        error instanceof ApiError &&
        error.status >= 400 &&
        error.status < 500 &&
        error.code !== 'REQUEST_IN_PROGRESS';
      if (definitive) {
        setAttempt(null);
        setMessage(
          error instanceof ApiError && error.status === 401
            ? t(
                'Phiên đã hết hạn. Đăng nhập lại trước khi tạo đơn.',
                'Your session expired. Sign in again before ordering.',
              )
            : error instanceof ApiError && error.status === 403
              ? t(
                  'Tài khoản chưa có quyền mua hàng. Kiểm tra quyền Customer trong hồ sơ.',
                  'This account cannot purchase merchandise. Check Customer access in your profile.',
                )
              : t(
                  'Chưa tạo được đơn. Kho hoặc điều kiện mua có thể đã thay đổi; kiểm tra lại trước khi gửi.',
                  'The order could not be created. Availability or eligibility may have changed; review before trying again.',
                ),
        );
      } else
        setMessage(
          t(
            'Chưa xác định kết quả tạo đơn. Thông tin được khóa để tránh tạo trùng; thử lại sẽ gửi đúng yêu cầu cũ.',
            'The order result is uncertain. Your details are locked to prevent duplicates; retry sends the exact same request.',
          ),
        );
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  const control =
    'min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-base text-foreground focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-soft disabled:bg-raised disabled:text-muted';
  if (!inventory.skus.length)
    return <EmptyState title={t('Chưa có biến thể được mở bán', 'No variants are on sale')} />;
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-2xl border border-line bg-surface p-5 sm:p-6"
    >
      <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
        <PackageCheck size={21} className="text-accent" />
        {t('Chọn sản phẩm', 'Choose your item')}
      </h2>
      <fieldset disabled={locked} className="mt-5 space-y-4">
        <label className="block space-y-2 text-sm font-semibold text-foreground">
          <span>{t('Loại sản phẩm', 'Variant')}</span>
          <select
            value={skuId}
            onChange={(event) => {
              setSkuId(event.target.value);
              setQuantity(1);
            }}
            className={control}
            required
          >
            <option value="" disabled>
              {t('Chọn loại', 'Choose a variant')}
            </option>
            {inventory.skus.map((item) => (
              <option key={item.id} value={item.id} disabled={item.available === 0}>
                {item.name} · {formatPrice(item.priceMinor, item.currency)}
                {item.available === 0 ? t(' · Hết hàng', ' · Sold out') : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-2 text-sm font-semibold text-foreground">
          <span>{t('Số lượng', 'Quantity')}</span>
          <input
            type="number"
            value={Number.isFinite(quantity) ? quantity : ''}
            min={1}
            max={Math.min(20, sku?.available ?? 20)}
            step={1}
            onChange={(event) => setQuantity(event.target.valueAsNumber)}
            required
            className={control}
          />
        </label>
        <p className="text-xs leading-6 text-muted">
          {t(
            'Tối đa 20 sản phẩm/đơn. Tồn kho được kiểm tra lại khi đặt; giữ hàng 5 phút sau khi tạo đơn.',
            'Up to 20 items per order. Stock is checked when ordering; items are held for 5 minutes after order creation.',
          )}
        </p>
        <div className="space-y-4 border-t border-line pt-4">
          <h3 className="text-sm font-bold text-foreground">
            {t('Thông tin nhận hàng', 'Delivery details')}
          </h3>
          <label className="block space-y-2 text-sm font-medium text-foreground">
            <span>{t('Tên người nhận', 'Recipient name')}</span>
            <input
              required
              value={recipient.name}
              minLength={2}
              maxLength={180}
              autoComplete="name"
              onChange={(event) => setRecipient({ ...recipient, name: event.target.value })}
              className={control}
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground">
            <span>{t('Số điện thoại', 'Phone')}</span>
            <input
              required
              type="tel"
              value={recipient.phone}
              maxLength={13}
              autoComplete="tel"
              pattern="(0|\+84)[0-9]{9}"
              onChange={(event) => setRecipient({ ...recipient, phone: event.target.value })}
              className={control}
              placeholder="0xxxxxxxxx"
            />
          </label>
          <label className="block space-y-2 text-sm font-medium text-foreground">
            <span>{t('Địa chỉ tại Việt Nam', 'Address in Vietnam')}</span>
            <textarea
              required
              value={recipient.address}
              minLength={10}
              maxLength={1000}
              autoComplete="street-address"
              onChange={(event) => setRecipient({ ...recipient, address: event.target.value })}
              className={`${control} min-h-24 py-3`}
            />
          </label>
        </div>
      </fieldset>
      <dl className="mt-5 space-y-3 border-t border-line pt-5 text-sm">
        <div className="flex justify-between gap-4 text-muted">
          <dt>{t('Phí giao hàng', 'Shipping')}</dt>
          <dd className="tabular-nums">
            {formatPrice(inventory.shippingFeeMinor, sku?.currency ?? 'VND')}
          </dd>
        </div>
        <div className="flex justify-between gap-4 font-bold text-foreground">
          <dt>{t('Tổng dự kiến', 'Estimated total')}</dt>
          <dd className="tabular-nums">
            {estimatedTotal ? formatPrice(estimatedTotal, sku?.currency ?? 'VND') : '—'}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs leading-6 text-muted">
        {t(
          'Tổng tiền chính thức sẽ hiển thị trên đơn trước khi thanh toán.',
          'The confirmed total appears on your order before payment.',
        )}
      </p>
      {message && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-line bg-raised p-4 text-sm leading-6 text-foreground"
        >
          {message}
        </p>
      )}
      <Button
        type={accessToken ? 'submit' : 'button'}
        onClick={() => {
          if (!accessToken) openAuth('login');
        }}
        disabled={busy || !skuId || (!attempt && (sku?.available ?? 0) < 1)}
        className="mt-5 w-full"
      >
        {busy
          ? t('Đang tạo đơn…', 'Creating order…')
          : attempt
            ? t('Thử lại yêu cầu cũ', 'Retry same request')
            : accessToken
              ? t('Tạo đơn và kiểm tra thanh toán', 'Create order and review payment')
              : t('Đăng nhập để mua', 'Sign in to buy')}
        <ArrowRight size={17} />
      </Button>
      {!locked && (
        <button
          type="button"
          className="mt-3 min-h-11 w-full text-sm font-semibold text-accent"
          onClick={onRefresh}
        >
          {t('Cập nhật tồn kho', 'Refresh availability')}
        </button>
      )}
    </form>
  );
}
