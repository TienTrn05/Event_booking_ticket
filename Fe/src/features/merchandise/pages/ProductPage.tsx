import { ui } from '../../../shared/styles/classes';
import { Link, useParams } from 'react-router-dom';
import { demoProducts } from '../data/catalog';
import { ProductArtwork } from '../components/ProductArtwork';
import { demoEvents, formatPrice } from '../../events/data/discovery';

export function ProductPage() {
  const { productId } = useParams();
  const product = demoProducts.find((item) => item.id === productId);
  if (!product)
    return (
      <main id="main" className={ui('container content-page')}>
        <h1>Không tìm thấy sản phẩm</h1>
        <Link to="/#merchandise-home">Về merchandise</Link>
      </main>
    );
  const event = demoEvents.find((item) => item.id === product.eventId);
  return (
    <main id="main" className={ui('container content-page')}>
      <div className={ui('breadcrumb')}>
        <Link to="/#merchandise-home">Merchandise</Link>
        <span>/</span>
        <Link to={`/events/${product.eventId}`}>{product.displayName}</Link>
      </div>
      <div className={ui('detail-grid')}>
        <ProductArtwork product={product} />
        <div className={ui('detail-copy')}>
          <span className={ui('eyebrow')}>{product.displayName} · SẢN PHẨM MINH HỌA</span>
          <h1>{product.name}</h1>
          <p>
            Thuộc sự kiện:{' '}
            <Link className={ui('text-link')} to={`/events/${product.eventId}`}>
              {product.eventTitle}
            </Link>
          </p>
          <p>Đơn vị bán: {event?.organization}</p>
          <h2>{formatPrice(product.priceVnd)}</h2>
          <div className={ui('notice')}>
            {product.requiresTicket
              ? 'Organizer yêu cầu người mua có vé sự kiện. Điều kiện sẽ được hệ thống kiểm tra trước thanh toán.'
              : 'Organizer cho phép mua sản phẩm này không cần vé sự kiện.'}
          </div>
          <p>
            Giao đến địa chỉ người nhận. Mua merchandise không cấp quyền vào cửa. Phí giao hàng và
            chính sách đổi trả cần được xác nhận trước khi mở bán.
          </p>
          <button className={ui('button')} disabled>
            Chưa mở thanh toán
          </button>
        </div>
      </div>
    </main>
  );
}
