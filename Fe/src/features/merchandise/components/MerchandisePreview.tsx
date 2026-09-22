import { ui } from '../../../shared/styles/classes';
import { useState } from 'react';
import { formatPrice } from '../../events/data/discovery';

export function MerchandisePreview() {
  const [variant, setVariant] = useState('natural');
  return (
    <section id="merchandise" className={ui('discovery-section')}>
      <div className={ui('section-heading')}>
        <div>
          <span className={ui('eyebrow')}>PMC / FANMEETING COLLECTION</span>
          <h2>Mang một chút kỷ niệm về nhà</h2>
        </div>
        <span className={ui('demo-label')}>Sản phẩm minh họa</span>
      </div>
      <div className={ui('product-grid')}>
        <article className={ui('product-card')}>
          <div className={ui('merch-art')} aria-hidden="true">
            <span className={ui('tote-handle')} />
            <div className={ui('tote-bag')}>
              <span>PMC</span>
              <small>
                WITH YOU,
                <br />
                EVERYWHERE.
              </small>
              <span className={ui('tote-star')}>✳</span>
            </div>
          </div>
          <h3>Túi vải PMC · With you</h3>
          <strong>{formatPrice(180000)}</strong>
          <p>Mua không cần vé · Giao tới địa chỉ người nhận.</p>
          <label>
            Màu sắc
            <select value={variant} onChange={(event) => setVariant(event.target.value)}>
              <option value="natural">Màu vải tự nhiên</option>
              <option value="blue" disabled>
                Xanh biển — hết hàng minh họa
              </option>
            </select>
          </label>
          <button className={ui('button')} disabled>
            Chưa mở thanh toán
          </button>
        </article>
        <article className={ui('product-card')}>
          <span className={ui('eyebrow')}>THÔNG TIN MUA HÀNG</span>
          <h3>Merchandise gắn với sự kiện</h3>
          <p>
            Đơn vị bán: Công ty chủ quản PMC (minh họa). Tên PMC là nhận diện của chương trình,
            không thay thế đơn vị tổ chức.
          </p>
          <p>
            Organizer có thể cho mua độc lập hoặc yêu cầu vé của sự kiện. Mẫu túi này minh họa hình
            thức mua không cần vé.
          </p>
          <p>
            Merchandise được giao đến địa chỉ người nhận. Mua hàng không cấp quyền vào cửa; thanh
            toán và giao hàng được theo dõi riêng.
          </p>
          <div className={ui('notice')}>
            Chưa thu thập địa chỉ hoặc nhận thanh toán trong bản xem trước. Phí giao hàng và chính
            sách đổi trả cần được công bố trước khi mở bán.
          </div>
        </article>
      </div>
    </section>
  );
}
