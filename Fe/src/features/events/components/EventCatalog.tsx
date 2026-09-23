import { ui } from '../../../shared/styles/classes';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { categories, demoEvents, filterEvents } from '../data/discovery';
import { EventCard } from './EventCard';
import { Icon } from '../../../shared/ui/Icon';

export function EventCatalog({ reopening = false }: { reopening?: boolean }) {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const category = params.get('category') ?? '';
  const query = params.get('q') ?? '';
  const city = params.get('city') ?? '';
  const date = params.get('date') ?? '';
  const sort = params.get('sort') ?? 'date';
  const events = filterEvents(demoEvents, { query, category, city, date, sort, reopening });
  const updateFilter = (name: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    void navigate({ search: next.toString(), hash: '#discover' }, { preventScrollReset: true });
  };
  const isFiltered = Boolean(category || query || city || date);

  return (
    <section id="discover" className={ui('discovery-section')} aria-labelledby="discover-title">
      <div className={ui('section-heading')}>
        <div>
          <span className={ui('eyebrow')}>
            {reopening ? 'NHỮNG CƠ HỘI GẶP LẠI' : 'LÊN LỊCH CHO ĐIỀU BẠN THÍCH'}
          </span>
          <h2 id="discover-title">
            {reopening
              ? 'Vé bán lại'
              : query
                ? `Kết quả cho “${query}”`
                : (categories.find((item) => item.id === category)?.label ?? 'Khám phá sự kiện')}
          </h2>
        </div>
        <span className={ui('demo-label')}>Dữ liệu minh họa</span>
      </div>
      {reopening && (
        <p className={ui('section-intro')}>
          Các đợt mở bán lại từ nhà tổ chức. Mỗi đợt có lý do và điều kiện riêng, không phải sàn
          chuyển nhượng vé cá nhân.
        </p>
      )}
      <form
        className={ui('explore-search')}
        role="search"
        aria-label="Tìm trong danh sách sự kiện"
        onSubmit={(event) => {
          event.preventDefault();
          const value = new FormData(event.currentTarget).get('query');
          updateFilter('q', typeof value === 'string' ? value.trim() : '');
        }}
      >
        <Icon name="search" />
        <input
          name="query"
          aria-label="Tìm tên sự kiện, địa điểm hoặc tổ chức"
          placeholder="Tìm sự kiện, địa điểm, nhà tổ chức…"
          defaultValue={query}
          key={query}
        />
        <button className={ui('button button-small')} type="submit">
          Tìm
        </button>
      </form>
      <div className={ui('filter-bar')}>
        <div className={ui('filter-tabs')} aria-label="Lọc loại sự kiện">
          <button
            className={ui(!category ? 'selected' : '')}
            aria-pressed={!category}
            onClick={() => updateFilter('category', '')}
          >
            Tất cả
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              className={ui(category === item.id ? 'selected' : '')}
              aria-pressed={category === item.id}
              onClick={() => updateFilter('category', item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className={ui('filter-selects')}>
          <label>
            <span className={ui('sr-only')}>Ngày diễn ra UTC+7</span>
            <input
              aria-label="Lọc ngày diễn ra"
              type="date"
              value={date}
              onChange={(event) => updateFilter('date', event.target.value)}
            />
          </label>
          <label>
            <Icon name="pin" />
            <span className={ui('sr-only')}>Thành phố</span>
            <select value={city} onChange={(event) => updateFilter('city', event.target.value)}>
              <option value="">Mọi địa điểm</option>
              <option>Hà Nội</option>
              <option>TP. Hồ Chí Minh</option>
              <option>Đà Nẵng</option>
            </select>
          </label>
          <label>
            <span className={ui('sr-only')}>Sắp xếp</span>
            <select value={sort} onChange={(event) => updateFilter('sort', event.target.value)}>
              <option value="date">Ngày gần nhất</option>
              <option value="price">Giá tăng dần</option>
              <option value="price-desc">Giá giảm dần</option>
            </select>
          </label>
        </div>
      </div>
      <p className={ui('result-count')} role="status">
        {events.length} sự kiện{city ? ` tại ${city}` : ''}
        {isFiltered && (
          <button
            className={ui('text-button')}
            onClick={() => void navigate({ search: '', hash: '#discover' })}
          >
            Xóa bộ lọc
          </button>
        )}
      </p>
      {events.length ? (
        <div className={ui('event-grid')}>
          {events.map((event) => (
            <EventCard event={event} key={event.id} />
          ))}
        </div>
      ) : (
        <div className={ui('empty-state')}>
          <Icon name="search" />
          <h3>Chưa tìm thấy cuộc hẹn phù hợp</h3>
          <p>Thử từ khóa khác hoặc mở rộng địa điểm và danh mục.</p>
          <button
            className={ui('button')}
            onClick={() => void navigate({ search: '', hash: '#discover' })}
          >
            Xem tất cả sự kiện
          </button>
        </div>
      )}
    </section>
  );
}
