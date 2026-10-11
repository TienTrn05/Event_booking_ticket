import { ui } from '../../../shared/styles/classes';
import { Link, useParams } from 'react-router-dom';
import { useCatalog } from '../../catalog/hooks/useCatalog';
import { formatPrice } from '../../../shared/utils/format';

export function EventDetailPage() {
  const { eventId } = useParams();
  const { catalog } = useCatalog();
  const event = catalog.events.find((item) => item.id === eventId);
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
          <div className="relative min-h-[420px] overflow-hidden rounded-3xl bg-home-elevated">
            <img
              className="absolute inset-0 h-full w-full object-cover"
              src={event.image}
              alt={event.title}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink-900/90 via-ink-900/10 to-transparent" />
            <span className="absolute bottom-7 left-7 text-sm font-extrabold uppercase tracking-[.15em] text-white">
              {event.category}
            </span>
          </div>
          <div className={ui('detail-copy')}>
            <span className={ui('eyebrow')}>
              {event.category} · {event.organizer}
            </span>
            <h1>{event.title}</h1>
            {event.ageTag && (
              <p className={ui('notice')}>
                Giới hạn tuổi {event.ageTag}. Tuổi tính theo ngày diễn ra suất; đối chiếu CCCD tại
                cửa.
              </p>
            )}
            <p>{event.description}</p>
            <div className={ui('notice')}>
              Dữ liệu sự kiện được tải từ hệ thống Event Ticketing.
            </div>
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
            <dd>{formatPrice(event.startingPrice, event.currency)}</dd>
          </dl>
          <p className={ui('section-intro')}>Bạn cần đăng nhập trước khi giữ chỗ hoặc mua vé.</p>
          <Link className={ui('button')} to={`/events/${event.id}/book`}>
            Chọn suất và đặt vé
          </Link>
          {event.reopeningNote && <p className={ui('notice')}>{event.reopeningNote}</p>}
        </aside>
      </div>
    </main>
  );
}
