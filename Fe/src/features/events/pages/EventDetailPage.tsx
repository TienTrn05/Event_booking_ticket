import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Clock3,
  Image,
  MapPin,
  ShieldCheck,
  Ticket,
} from 'lucide-react';
import { formatPrice } from '../../../shared/utils/format';
import { usePublicEvent } from '../hooks/usePublicEvent';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';
import { useLocale } from '../../../shared/i18n/LocaleContext';
import { categoryLabel } from '../../catalog/category-label';
import StatusBadge from '../components/StatusBadge';
import { formatEventDate } from '../utils/event-time';

export function EventDetailPage() {
  const { eventId } = useParams();
  const { accessToken } = useAuthDialog();
  const { event, loading, error, retry } = usePublicEvent(eventId, accessToken);
  const { t, locale } = useLocale();
  if (!event)
    return (
      <main id="main" className="mx-auto min-h-[55vh] max-w-[1240px] px-4 py-12 sm:px-6 lg:px-8">
        {loading ? (
          <div
            role="status"
            aria-label={t('Đang tải sự kiện', 'Loading event')}
            className="grid gap-6 lg:grid-cols-[1fr_360px]"
          >
            <div className="h-96 animate-pulse rounded-2xl bg-raised motion-reduced:animate-none" />
            <div className="h-80 animate-pulse rounded-2xl bg-raised motion-reduced:animate-none" />
          </div>
        ) : (
          <div
            className="rounded-2xl border border-line bg-surface p-10 text-center"
            role={error ? 'alert' : undefined}
          >
            <Ticket className="mx-auto text-accent" size={36} />
            <h1 className="mt-5 text-2xl font-bold text-foreground">
              {error
                ? t('Chưa tải được sự kiện', 'Event could not be loaded')
                : t('Sự kiện không còn công khai', 'This event is unavailable')}
            </h1>
            <p className="mt-3 text-muted">
              {error
                ? t(
                    'Vui lòng kiểm tra kết nối và thử lại.',
                    'Please check your connection and try again.',
                  )
                : t(
                    'Sự kiện có thể đã thay đổi trạng thái hoặc đường dẫn.',
                    'The event may have changed its status or address.',
                  )}
            </p>
            {error && (
              <button
                type="button"
                onClick={retry}
                className="mt-5 min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-on-accent"
              >
                {t('Thử lại', 'Try again')}
              </button>
            )}
            <Link to="/events" className="mt-5 block font-semibold text-accent">
              {t('Khám phá sự kiện khác', 'Explore other events')}
            </Link>
          </div>
        )}
      </main>
    );
  const bookable = event.status === 'on-sale' || event.status === 'few-left';
  return (
    <main id="main" className="mx-auto max-w-[1240px] px-4 pb-24 pt-8 sm:px-6 lg:px-8 lg:pb-16">
      <nav
        aria-label={t('Đường dẫn', 'Breadcrumb')}
        className="mb-6 flex flex-wrap items-center gap-2 text-sm text-muted"
      >
        <Link to="/" className="hover:text-accent">
          {t('Trang chủ', 'Home')}
        </Link>
        <span aria-hidden="true">/</span>
        <span>{t('Chi tiết sự kiện', 'Event details')}</span>
      </nav>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0">
          <div className="overflow-hidden rounded-2xl border border-line bg-raised">
            {event.image ? (
              <img
                src={event.image}
                alt={event.title}
                width={1000}
                height={750}
                className="max-h-[640px] w-full object-contain"
                fetchPriority="high"
              />
            ) : (
              <div className="grid aspect-[4/3] place-items-center text-muted">
                <Image size={56} />
              </div>
            )}
          </div>
          <div className="mt-8">
            <p className="text-sm font-semibold text-accent">
              {categoryLabel(event.category, event.categorySlug, locale)}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              {event.title}
            </h1>
            <p className="mt-4 text-sm text-muted">
              {t('Tổ chức bởi', 'Organized by')}{' '}
              {event.organizerId ? (
                <Link to={`/organizers/${event.organizerId}`} className="font-semibold text-accent">
                  {event.organizer}
                </Link>
              ) : (
                event.organizer
              )}
            </p>
            <div className="mt-5">
              <StatusBadge status={event.status} />
            </div>
          </div>
          {event.ageTag && (
            <div className="mt-6 flex gap-3 rounded-xl border border-line bg-accent-soft p-4 text-sm leading-6 text-foreground">
              <ShieldCheck className="shrink-0 text-accent" size={20} />
              <p>
                {t(
                  `Giới hạn tuổi ${event.ageTag}. Tuổi tính theo ngày diễn ra suất; đối chiếu CCCD tại cửa.`,
                  `Age restriction ${event.ageTag}. Age is calculated on the session date; ID is checked at the entrance.`,
                )}
              </p>
            </div>
          )}
          <section className="mt-8 rounded-2xl border border-line bg-surface p-6 sm:p-8">
            <h2 className="text-xl font-bold text-foreground">
              {t('Về sự kiện', 'About this event')}
            </h2>
            <p className="mt-5 whitespace-pre-line text-base leading-8 text-muted">
              {event.description ||
                t('Nhà tổ chức chưa bổ sung mô tả.', 'The organizer has not added a description.')}
            </p>
          </section>
          {event.reopeningNote && (
            <div className="mt-5 rounded-xl border border-line bg-surface p-5 text-sm leading-7 text-muted">
              {event.reopeningNote}
            </div>
          )}
          <Link
            to="/events"
            className="mt-7 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-accent"
          >
            <ArrowLeft size={16} />
            {t('Khám phá thêm sự kiện', 'Explore more events')}
          </Link>
        </div>
        <aside className="rounded-2xl border border-line bg-surface p-6 shadow-card lg:sticky lg:top-28">
          <p className="text-xs font-bold uppercase tracking-widest text-accent">
            {t('Thông tin đặt vé', 'Plan your experience')}
          </p>
          <dl className="mt-6 space-y-5">
            <div className="flex gap-3">
              <CalendarDays size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <dt className="text-xs text-muted">{t('Ngày diễn ra', 'Date')}</dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {formatEventDate(event.startsAt, locale)}
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Clock3 size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <dt className="text-xs text-muted">
                  {t('Giờ bắt đầu · UTC+7', 'Starts at · UTC+7')}
                </dt>
                <dd className="mt-1 text-sm font-semibold text-foreground">
                  {new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', {
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'Asia/Ho_Chi_Minh',
                  }).format(new Date(event.startsAt))}
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <MapPin size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <dt className="text-xs text-muted">{t('Địa điểm', 'Venue')}</dt>
                <dd className="mt-1 text-sm font-semibold leading-6 text-foreground">
                  {event.venue}
                  <span className="block font-normal text-muted">{event.city}</span>
                </dd>
              </div>
            </div>
            <div className="flex gap-3">
              <Ticket size={20} className="mt-0.5 shrink-0 text-accent" />
              <div>
                <dt className="text-xs text-muted">{t('Hình thức vé', 'Ticket type')}</dt>
                <dd className="mt-1 text-sm font-semibold leading-6 text-foreground">
                  {event.admission === 'quantity'
                    ? t('Chọn khu và số lượng', 'Choose a zone and quantity')
                    : t('Ghế có số theo sơ đồ', 'Numbered seating')}
                </dd>
              </div>
            </div>
          </dl>
          <div className="mt-6 border-t border-line pt-5">
            <p className="text-sm text-muted">{t('Giá vé từ', 'Tickets from')}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
              {formatPrice(event.startingPrice, event.currency)}
            </p>
            <p className="mt-3 text-xs leading-6 text-muted">
              {t(
                'Giá và số lượng khả dụng được xác nhận khi chọn suất. Đăng nhập để giữ vé và thanh toán.',
                'Price and availability are confirmed when you select a session. Sign in to hold tickets and pay.',
              )}
            </p>
            {bookable ? (
              <Link
                to={`/events/${event.id}/book`}
                className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-on-accent transition hover:bg-accent-hover"
              >
                {t('Chọn suất và đặt vé', 'Choose session and tickets')}
                <ArrowRight size={18} />
              </Link>
            ) : (
              <p className="mt-5 rounded-xl bg-raised p-4 text-center text-sm font-semibold text-muted">
                {event.status === 'sold-out'
                  ? t('Hiện đã hết vé', 'Currently sold out')
                  : t('Chưa đến thời gian mở bán', 'Ticket sales are not open yet')}
              </p>
            )}
          </div>
        </aside>
      </div>
    </main>
  );
}
