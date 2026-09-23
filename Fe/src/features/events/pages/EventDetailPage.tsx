import { ui } from '../../../shared/styles/classes';
import { Link, useParams } from 'react-router-dom';
import { EventArtwork } from '../components/EventCard';
import { formatPrice } from '../data/discovery';
import { getEventById } from '../data/eventCatalog';
import { MerchandisePreview } from '../../merchandise/components/MerchandisePreview';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';

export function EventDetailPage() {
  const { openAuth } = useAuthDialog();
  const { eventId } = useParams();
  const event = getEventById(eventId);
  if (!event)
    return (
      <main id="main" className={ui('container content-page empty-state')}>
        <h1>Không tìm thấy sự kiện</h1>
        <Link className={ui('button')} to="/">
          Khám phá sự kiện khác
        </Link>
      </main>
    );
  return (
    <main id="main" className={ui('container content-page')}>
      <div className={ui('breadcrumb')}>
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <span>Chi tiết sự kiện</span>
      </div>
      <div className={ui('detail-grid')}>
        <div>
          {event.artwork ? (
            <EventArtwork event={event.artwork} />
          ) : (
            <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-home-elevated">
              {event.image && (
                <img
                  className="absolute inset-0 h-full w-full object-cover"
                  src={event.image}
                  alt={event.title}
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/10 to-transparent" />
              <span className="absolute bottom-7 left-7 text-sm font-extrabold uppercase tracking-[.15em] text-white">
                {event.category}
              </span>
            </div>
          )}
          <div className={ui('detail-copy')}>
            <span className={ui('eyebrow')}>
              {event.category} · {event.organizer}
            </span>
            <h1>{event.title}</h1>
            <p>{event.description}</p>
            <div className={ui('notice')}>Bản xem trước với dữ liệu minh họa. Chưa mở bán vé.</div>
          </div>
        </div>
        <aside className={ui('detail-info')}>
          <span className={ui('eyebrow')}>THÔNG TIN CUỘC HẸN</span>
          <dl>
            <dt>Thời gian · UTC+7</dt>
            <dd>
              {event.dateLabel} ·{' '}
              {new Intl.DateTimeFormat('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh',
              }).format(new Date(event.startsAt))}
            </dd>
            <dt>Địa điểm</dt>
            <dd>
              {event.venue}, {event.city}
            </dd>
            <dt>Đơn vị tổ chức</dt>
            <dd>{event.organizer}</dd>
            <dt>Hình thức vé</dt>
            <dd>
              {event.admission === 'quantity'
                ? 'Chọn khu / loại vé và số lượng'
                : 'Chọn ghế theo sơ đồ của nhà tổ chức'}
            </dd>
            <dt>Giá minh họa từ</dt>
            <dd>{event.priceVnd === undefined ? 'Đang cập nhật' : formatPrice(event.priceVnd)}</dd>
          </dl>
          <p className={ui('section-intro')}>Bạn cần đăng nhập trước khi giữ chỗ hoặc mua vé.</p>
          <button type="button" className={ui('button')} onClick={() => openAuth('checkout')}>
            Thông tin đăng nhập
          </button>
          {event.reopening && <p className={ui('notice')}>{event.reopening}</p>}
        </aside>
      </div>
      {event.id === 'pmc' && <MerchandisePreview />}
    </main>
  );
}
