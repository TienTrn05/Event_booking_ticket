import { ui } from '../../shared/styles/classes';
import { Link } from 'react-router-dom';
export function Footer() {
  return (
    <footer className={ui('site-footer')}>
      <div className={ui('container footer-top')}>
        <div>
          <Link className={ui('brand')} to="/">
            event<span className={ui('brand-light')}>ticketing</span>
            <span className={ui('brand-dot')}>.</span>
          </Link>
          <p>
            Đi để cảm nhận. Gặp để kết nối.
            <br />
            Những trải nghiệm dành cho bạn.
          </p>
        </div>
        <div>
          <h2>Khám phá</h2>
          <Link to="/#discover">Sự kiện</Link>
          <Link to="/reopening">Vé bán lại</Link>
          <Link to="/blog">Góc cảm hứng</Link>
        </div>
        <div>
          <h2>Đồng hành</h2>
          <Link to="/organizer">Dành cho nhà tổ chức</Link>
          <Link to="/guide">Hướng dẫn & hỗ trợ</Link>
          <Link to="/my-tickets">Vé của tôi</Link>
        </div>
        <div className={ui('footer-note')}>
          <span className={ui('eyebrow')}>BẢN XEM TRƯỚC</span>
          <p>Sự kiện, sản phẩm và giá VND là dữ liệu minh họa. Chưa mở giao dịch.</p>
        </div>
      </div>
      <div className={ui('container footer-bottom')}>
        <span>© 2026 Event Ticketing</span>
        <span>Cho những cuộc hẹn đáng nhớ ✦</span>
      </div>
    </footer>
  );
}
