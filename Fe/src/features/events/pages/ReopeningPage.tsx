import { ui } from '../../../shared/styles/classes';
import { EventCatalog } from '../components/EventCatalog';
import { Link, useSearchParams } from 'react-router-dom';
import { resaleTickets } from '../data/mockData';
import { formatPrice } from '../../../shared/utils/format';

export function ReopeningPage() {
  const [params] = useSearchParams();
  const selectedTicket = resaleTickets.find((ticket) => ticket.id === params.get('ticket'));

  return (
    <main id="main" className={ui('container content-page')}>
      <h1>Vé bán lại từ nhà tổ chức</h1>
      {selectedTicket && (
        <section className="my-7 grid overflow-hidden rounded-3xl border border-home-line bg-home-card shadow-card md:grid-cols-[280px_1fr]">
          <img
            className="h-full min-h-56 w-full object-cover"
            src={selectedTicket.image}
            alt={selectedTicket.eventTitle}
          />
          <div className="p-6 md:p-8">
            <span className="text-xs font-extrabold uppercase tracking-widest text-home-accent">
              {selectedTicket.sellerVerified ? 'Người bán đã xác minh' : 'Vé bán lại'}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold text-home-text">
              {selectedTicket.eventTitle}
            </h2>
            <p className="mt-3 text-home-muted">
              {selectedTicket.dateLabel} · {selectedTicket.venue}, {selectedTicket.city}
            </p>
            <p className="mt-2 text-home-secondary">{selectedTicket.seatInfo}</p>
            <strong className="mt-5 block text-2xl text-home-text">
              {formatPrice(selectedTicket.resalePrice, selectedTicket.currency)}
            </strong>
            <Link className={ui('button mt-6')} to={`/events/${selectedTicket.eventId}`}>
              Xem sự kiện gốc
            </Link>
          </div>
        </section>
      )}
      <EventCatalog reopening />
    </main>
  );
}
