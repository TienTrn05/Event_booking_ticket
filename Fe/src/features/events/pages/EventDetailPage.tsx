import { ui } from '../../../shared/styles/classes';
import { Link, useParams } from 'react-router-dom';
import { EventArtwork } from '../components/EventCard';
import { categories, demoEvents, formatDate, formatPrice } from '../data/discovery';
import { MerchandisePreview } from '../../merchandise/components/MerchandisePreview';
import { useAuthDialog } from '../../auth/context/AuthDialogContext';

export function EventDetailPage() {
  const { openAuth } = useAuthDialog();
  const { eventId } = useParams();
  const event = demoEvents.find((item) => item.id === eventId);
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
          <EventArtwork event={event} />
          <div className={ui('detail-copy')}>
            <span className={ui('eyebrow')}>
              {event.displayName} · {categories.find((item) => item.id === event.category)?.label}
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
              {formatDate(event.startsAt)} ·{' '}
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
            <dd>{event.organization}</dd>
            <dt>Hình thức vé</dt>
            <dd>
              {event.admission === 'quantity'
                ? 'Chọn khu / loại vé và số lượng'
                : 'Chọn ghế theo sơ đồ của nhà tổ chức'}
            </dd>
            <dt>Giá minh họa từ</dt>
            <dd>{formatPrice(event.priceVnd)}</dd>
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
