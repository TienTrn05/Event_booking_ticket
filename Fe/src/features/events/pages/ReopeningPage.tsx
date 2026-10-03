import { ui } from '../../../shared/styles/classes';
import { Link, useSearchParams } from 'react-router-dom';
import { useCatalog } from '../../catalog/hooks/useCatalog';

export function ReopeningPage() {
  const [params] = useSearchParams();
  const { catalog } = useCatalog();
  const selectedRequest = catalog.reopeningRequests.find(
    (item) => item.id === params.get('request'),
  );

  return (
    <main id="main" className={ui('container content-page')}>
      <h1>Vé bán lại từ nhà tổ chức</h1>
      <p className={ui('section-intro')}>
        Các hồ sơ dưới đây do Organizer gửi và đã được duyệt. Mỗi hồ sơ nêu rõ lý do và ảnh hưởng;
        hệ thống không hỗ trợ chuyển nhượng vé giữa cá nhân.
      </p>
      {selectedRequest && (
        <section className="my-7 grid overflow-hidden rounded-3xl border border-home-line bg-home-card shadow-card md:grid-cols-[280px_1fr]">
          <img
            className="h-full min-h-56 w-full object-cover"
            src={selectedRequest.image}
            alt={selectedRequest.eventTitle}
          />
          <div className="p-6 md:p-8">
            <span className="text-xs font-extrabold uppercase tracking-widest text-home-accent">
              Hồ sơ đã duyệt · {selectedRequest.type}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-home-text">
              {selectedRequest.eventTitle}
            </h2>
            <p className="mt-3 text-home-muted">{selectedRequest.organizer}</p>
            <p className="mt-4 text-home-secondary">{selectedRequest.reason}</p>
            <p className="mt-3 text-home-muted">{selectedRequest.impactSummary}</p>
            <Link className={ui('button mt-6')} to={`/events/${selectedRequest.eventId}`}>
              Xem sự kiện gốc
            </Link>
          </div>
        </section>
      )}
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {catalog.reopeningRequests.map((request) => (
          <Link
            key={request.id}
            to={`/reopening?request=${request.id}`}
            className="rounded-2xl border border-home-line bg-home-card p-5 text-home-text transition hover:border-home-accent"
          >
            <span className="text-xs font-extrabold uppercase tracking-wider text-home-accent">
              {request.type}
            </span>
            <h2 className="mt-2 text-xl font-extrabold">{request.eventTitle}</h2>
            <p className="mt-2 text-sm text-home-muted">{request.reason}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
