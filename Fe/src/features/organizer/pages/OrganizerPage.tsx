import { Link, useParams } from 'react-router-dom';
import { BadgeCheck, Calendar, ShoppingBag } from 'lucide-react';
import { organizers } from '../data/organizers';
import { exploreEvents } from '../../events/data/mockData';
import { merchandise } from '../../merchandise/data/homeMerchandise';
import { ui } from '../../../shared/styles/classes';

export function OrganizerPage() {
  const { organizerId } = useParams();
  const organizer = organizers.find((item) => item.id === organizerId);
  if (!organizer) {
    return (
      <main id="main" className={ui('container content-page empty-state')}>
        <h1>Không tìm thấy nhà tổ chức</h1>
        <Link className={ui('button')} to="/#stars">
          Về Featured Stars
        </Link>
      </main>
    );
  }
  const events = exploreEvents.filter((event) => event.organizerId === organizer.id);
  const products = merchandise.filter((product) => product.organizerId === organizer.id);
  return (
    <main id="main" className={ui('container content-page')}>
      <div className={ui('breadcrumb')}>
        <Link to="/">Trang chủ</Link>
        <span>/</span>
        <span>Nhà tổ chức</span>
      </div>
      <section className="grid gap-8 rounded-3xl border border-home-line bg-home-card p-7 md:grid-cols-[180px_1fr] md:p-10">
        <img
          className="h-40 w-40 rounded-full border-4 border-home-accent object-cover"
          src={organizer.avatar}
          alt={organizer.name}
        />
        <div>
          <span className="inline-flex items-center gap-2 text-sm font-bold text-home-accent">
            <BadgeCheck size={18} />
            {organizer.verified ? 'Đã xác minh' : 'Đang xác minh'}
          </span>
          <h1 className="mt-3 text-4xl font-extrabold text-home-text">{organizer.name}</h1>
          <p className="mt-3 text-home-muted">
            {organizer.category} · {organizer.eventCount} sự kiện
          </p>
          {organizer.upcomingEventTitle && (
            <p className="mt-5 flex items-center gap-2 text-home-secondary">
              <Calendar size={18} />
              {organizer.upcomingEventTitle} · {organizer.upcomingEventDate}
            </p>
          )}
        </div>
      </section>
      <section className="mt-10 grid gap-5 md:grid-cols-2">
        <div className="rounded-2xl border border-home-line bg-home-card p-6">
          <h2 className="text-xl font-extrabold text-home-text">Sự kiện đang kết nối</h2>
          <div className="mt-4 space-y-3">
            {events.length ? (
              events.map((event) => (
                <Link
                  className="block rounded-xl bg-home-elevated p-4 font-bold text-home-text hover:text-home-accent"
                  key={event.id}
                  to={`/events/${event.id}`}
                >
                  {event.title}
                </Link>
              ))
            ) : (
              <p className="text-home-muted">Chưa có sự kiện trong catalog hiện tại.</p>
            )}
          </div>
        </div>
        <div className="rounded-2xl border border-home-line bg-home-card p-6">
          <h2 className="flex items-center gap-2 text-xl font-extrabold text-home-text">
            <ShoppingBag size={20} />
            Merchandise
          </h2>
          <p className="mt-4 text-home-muted">
            {products.length} sản phẩm đang được giới thiệu trên Home.
          </p>
          <Link
            className="mt-5 inline-flex font-bold text-home-accent"
            to={`/?organizer=${organizer.id}#merchandise`}
          >
            Xem bộ sưu tập
          </Link>
        </div>
      </section>
    </main>
  );
}
