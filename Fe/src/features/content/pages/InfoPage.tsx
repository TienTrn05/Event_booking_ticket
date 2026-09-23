import { Link } from 'react-router-dom';
import { ui } from '../../../shared/styles/classes';

const content = {
  guide: {
    title: 'Hướng dẫn & hỗ trợ',
    body: 'Khám phá sự kiện theo danh mục, địa điểm hoặc tên chương trình. Thông tin loại vé, đơn vị tổ chức và merchandise nằm trong chi tiết sự kiện.',
    detail: 'Bản xem trước chưa tiếp nhận giao dịch, báo cáo hoặc đánh giá thực tế.',
  },
  'not-found': {
    title: 'Không tìm thấy trang',
    body: 'Đường dẫn này chưa có nội dung hoặc không tồn tại.',
    detail: 'Bạn có thể quay lại trang chủ để tiếp tục khám phá.',
  },
} as const;

export function InfoPage({ kind }: { kind: keyof typeof content }) {
  const page = content[kind];
  return (
    <main id="main" className={ui('container content-page reading-page')}>
      <span className={ui('eyebrow')}>EVENT TICKETING</span>
      <h1>{page.title}</h1>
      <p>{page.body}</p>
      <div className={ui('notice')}>{page.detail}</div>
      <Link className={ui('button button-outline')} to="/">
        Tiếp tục khám phá
      </Link>
    </main>
  );
}
