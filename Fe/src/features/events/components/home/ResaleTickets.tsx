import { ArrowRight, CalendarClock, FileCheck2, RefreshCw } from 'lucide-react';
import { ui } from '../../../../shared/styles/classes';
import { useCatalog } from '../../../catalog/hooks/useCatalog';
import { useQuickPreview } from '../../../preview/hooks/useQuickPreview';

const typeLabel: Record<string, string> = {
  CAPACITY: 'Điều chỉnh sức chứa',
  NEW_SALE_WAVE: 'Đợt mở bán mới',
  SALES_CONFIG: 'Điều chỉnh bán vé',
  RESUME_SALES: 'Mở bán trở lại',
};

export default function ResaleTickets() {
  const { catalog } = useCatalog();
  const { openPreview } = useQuickPreview();
  return (
    <section id="resale" className={ui('home-chapter chapter-resale bg-ink-900 py-16 lg:py-24')}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-end justify-between gap-6">
          <div>
            <span className="inline-flex items-center gap-2 text-sm font-bold text-primary-300">
              <RefreshCw size={16} /> Cơ hội gặp lại
            </span>
            <h2 className="mt-3 text-3xl font-extrabold text-white lg:text-5xl">Đợt mở bán lại.</h2>
            <p className="mt-3 max-w-2xl text-white/65">
              Hồ sơ do nhà tổ chức gửi và đã được duyệt. Đây không phải thị trường chuyển nhượng vé
              cá nhân.
            </p>
          </div>
        </div>
        <div className="grid gap-5 md:grid-cols-2">
          {catalog.reopeningRequests.map((request) => (
            <article
              key={request.id}
              role="button"
              tabIndex={0}
              onClick={() => openPreview('resale', request.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPreview('resale', request.id);
                }
              }}
              className="group overflow-hidden rounded-3xl border border-white/15 bg-white/10 backdrop-blur-sm transition hover:-translate-y-1 hover:border-primary-300/60"
            >
              <div className="grid sm:grid-cols-[180px_1fr]">
                <img className="h-full min-h-48 w-full object-cover" src={request.image} alt="" />
                <div className="p-6">
                  <span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase tracking-wider text-primary-300">
                    <FileCheck2 size={15} /> {typeLabel[request.type] ?? request.type}
                  </span>
                  <h3 className="mt-3 text-xl font-extrabold text-white">{request.eventTitle}</h3>
                  <p className="mt-2 text-sm text-white/60">{request.organizer}</p>
                  <p className="mt-4 line-clamp-2 text-sm leading-6 text-white/75">
                    {request.reason}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary-300">
                    <CalendarClock size={16} /> Xem hồ sơ <ArrowRight size={15} />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
