import { ui } from '../../../shared/styles/classes';
import { Link, useParams, useSearchParams } from 'react-router-dom';

const articles = {
  merchandise: {
    title: 'Mang một chút kỷ niệm về nhà.',
    paragraphs: [
      'Merchandise thuộc một sự kiện, do tổ chức sở hữu sự kiện quản lý. Tên nghệ sĩ hoặc chương trình là nhận diện hiển thị, không thay đơn vị bán.',
      'Organizer có thể cho mua độc lập hoặc yêu cầu có vé. Xem điều kiện trên sản phẩm trước khi thanh toán; mua hàng không đồng nghĩa có quyền vào cửa.',
      'Hàng được giao tới địa chỉ người nhận. Trước khi mua, xem kỹ biến thể, phí giao hàng và chính sách đổi trả. Trạng thái đã thanh toán và đã giao hàng được theo dõi riêng.',
    ],
  },
  'first-event': {
    title: 'Lần đầu đi sự kiện? Bắt đầu từ những điều nhỏ.',
    paragraphs: [
      'Chọn một trải nghiệm bạn thực sự muốn tham gia. Đọc thông tin thời gian, địa điểm và hình thức vé trước khi quyết định.',
      'Vé có ghế đánh số và vé theo khu hoặc số lượng có cách chọn khác nhau. Hãy xem kỹ bố trí do nhà tổ chức công bố, thay vì mặc định sự kiện nào cũng có ghế cố định.',
      'Khi mua cho nhiều người, tên người tham dự được nhập riêng cho từng vé. Xem lại thông tin trước khi thanh toán và giữ mã vé riêng tư.',
      'Nếu sự kiện thay đổi hoặc bị hủy, theo dõi thông báo và tình trạng xử lý đơn của bạn. Thông báo hủy không đồng nghĩa tiền đã được hoàn.',
    ],
  },
  'check-in': {
    title: 'Check-in trước và vào cửa: Hai bước, một cuộc hẹn.',
    paragraphs: [
      'Check-in online mở từ 24 giờ trước khi suất bắt đầu và đóng khi suất bắt đầu. Người mua đăng nhập, chọn vé của mình và xác nhận tên cùng mã vé hệ thống.',
      'Đã check-in chỉ có nghĩa bạn đã xác nhận tham dự. Vé chưa được đánh dấu đã vào cửa ở bước này.',
      'Nếu chưa check-in online, bạn có thể làm tại quầy theo giờ nhà tổ chức công bố. Khách đã check-in online không cần tạo thêm lượt xác nhận.',
      'Khi tới cửa, nhân viên kiểm tra mã vé hoặc QR bằng hệ thống. Chỉ lượt vào cửa hợp lệ mới ghi nhận vé đã sử dụng; QR không nên chia sẻ công khai.',
    ],
  },
};

export function BlogPage() {
  const { articleId } = useParams();
  const article =
    articleId && Object.hasOwn(articles, articleId)
      ? articles[articleId as keyof typeof articles]
      : null;
  return (
    <main id="main" className={ui('container content-page reading-page')}>
      <div className={ui('breadcrumb')}>
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <Link to="/blog">Blog</Link>
      </div>
      <span className={ui('eyebrow')}>GÓC CẢM HỨNG · NỘI DUNG MINH HỌA</span>
      {article ? (
        <>
          <h1>{article.title}</h1>
          {article.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <Link className={ui('button button-outline')} to="/blog">
            Các bài viết khác
          </Link>
        </>
      ) : articleId ? (
        <>
          <h1>Không tìm thấy bài viết</h1>
          <Link className={ui('button')} to="/blog">
            Về Blog
          </Link>
        </>
      ) : (
        <>
          <h1>Trước khi mình lên đường</h1>
          <p>Một chút chuẩn bị để cuộc hẹn trọn vẹn hơn.</p>
          <div className={ui('article-list')}>
            {Object.entries(articles).map(([id, item], index) => (
              <Link className={ui('journal-card')} to={`/blog/${id}`} key={id}>
                <span className={ui('journal-number')}>0{index + 1}</span>
                <h2>{item.title}</h2>
              </Link>
            ))}
          </div>
        </>
      )}
    </main>
  );
}

export function InfoPage({
  kind,
}: {
  kind: 'login' | 'organizer' | 'tickets' | 'guide' | 'not-found';
}) {
  const [params] = useSearchParams();
  const destination = params.get('returnTo');
  // Only allow known local event destinations; never trust a redirect URL from the query string.
  const returnTo = destination && /^\/events\/[a-z0-9-]+$/.test(destination) ? destination : '/';
  const content = {
    login: {
      title: 'Đăng nhập để giữ những cuộc hẹn của bạn',
      body: 'Tài khoản khách sử dụng Google hoặc OTP điện thoại. Chức năng xác thực đang được xây dựng; bản xem trước chưa nhận thông tin đăng nhập.',
      detail:
        'Bạn có thể tiếp tục xem sự kiện. Giữ chỗ, mua hàng và xem vé riêng sẽ cần phiên đăng nhập được hệ thống xác nhận.',
    },
    organizer: {
      title: 'Biến ý tưởng thành một cuộc hẹn',
      body: 'Organizer là tổ chức. Người đại diện sử dụng email công ty được xác minh và cần Admin duyệt trước khi quản lý sự kiện.',
      detail:
        'Sau khi được duyệt, tổ chức quản lý nội dung, sơ đồ, vé và merchandise của mình. Sự kiện cần được Admin duyệt trước khi công khai. Đăng ký tổ chức chưa mở trong bản xem trước.',
    },
    tickets: {
      title: 'Những cuộc hẹn của bạn',
      body: 'Đăng nhập để xem đơn và vé thuộc tài khoản của bạn trên các thiết bị.',
      detail:
        'Đã check-in và đã vào cửa là hai trạng thái khác nhau. Bản xem trước chưa kết nối tài khoản hoặc phát hành vé.',
    },
    guide: {
      title: 'Hướng dẫn & hỗ trợ',
      body: 'Khám phá sự kiện theo danh mục, địa điểm hoặc tên chương trình. Thông tin loại vé, đơn vị tổ chức và merchandise nằm trong chi tiết sự kiện.',
      detail:
        'Khi hệ thống mở giao dịch, bạn có thể gửi feedback về website hoặc sự kiện và report vấn đề liên quan tới đơn. Hiện chưa tiếp nhận report hoặc đánh giá thật ở bản xem trước.',
    },
    'not-found': {
      title: 'Không tìm thấy trang',
      body: 'Đường dẫn này chưa có nội dung hoặc không tồn tại.',
      detail: 'Bạn có thể quay lại trang chủ để tiếp tục khám phá.',
    },
  }[kind];
  return (
    <main id="main" className={ui('container content-page reading-page')}>
      <span className={ui('eyebrow')}>EVENT TICKETING</span>
      <h1>{content.title}</h1>
      <p>{content.body}</p>
      <div className={ui('notice')}>{content.detail}</div>
      {kind === 'tickets' && (
        <Link to="/login" className={ui('button')}>
          Thông tin đăng nhập
        </Link>
      )}
      <Link className={ui('button button-outline')} to={returnTo}>
        {returnTo === '/' ? 'Tiếp tục khám phá' : 'Quay lại sự kiện'}
      </Link>
    </main>
  );
}
