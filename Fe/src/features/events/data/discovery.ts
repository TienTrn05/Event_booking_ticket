export const categories = [
  { id: 'music', label: 'Nhạc sống', symbol: '♫' },
  { id: 'sport', label: 'Thể thao', symbol: '↗' },
  { id: 'art', label: 'Sân khấu & Nghệ thuật', symbol: '✳' },
  { id: 'workshop', label: 'Hội thảo & Workshop', symbol: '◎' },
  { id: 'experience', label: 'Tham quan & Trải nghiệm', symbol: '⌁' },
  { id: 'other', label: 'Khác', symbol: '✦' },
] as const;

export type CategoryId = (typeof categories)[number]['id'];
export interface DiscoveryEvent {
  id: string;
  title: string;
  displayName: string;
  organization: string;
  category: CategoryId;
  city: string;
  venue: string;
  startsAt: string;
  priceVnd: number;
  artwork: string;
  image?: string;
  coverTitle: string;
  description: string;
  admission: 'numbered' | 'quantity';
  reopening?: string;
}

// Fictional editorial fixtures, never evidence of inventory or authorization.
export const demoEvents: DiscoveryEvent[] = [
  {
    id: 'ocean-sessions',
    title: 'Ocean Sessions · Chạm vào thanh âm',
    displayName: 'OCEAN SESSIONS',
    organization: 'Blue Wave Studio (minh họa)',
    category: 'music',
    city: 'Đà Nẵng',
    venue: 'Không gian Bờ Sóng (minh họa)',
    startsAt: '2026-11-21T18:30:00+07:00',
    priceVnd: 450000,
    artwork: 'ocean',
    image: '/images/music.jpg',
    reopening: 'Bổ sung hạn mức sau khi bố trí mới được duyệt (tình huống minh họa).',
    coverTitle: 'OCEAN\nSESSIONS',
    description:
      'Một buổi tối dành cho âm nhạc trực tiếp, những giai điệu mộc và cảm hứng từ biển.',
    admission: 'quantity',
  },
  {
    id: 'city-court',
    title: 'City Court · Ngày hội bóng rổ',
    displayName: 'CITY COURT',
    organization: 'Urban Play (minh họa)',
    category: 'sport',
    city: 'TP. Hồ Chí Minh',
    venue: 'Nhà thi đấu Thành Phố (minh họa)',
    startsAt: '2026-11-22T16:00:00+07:00',
    priceVnd: 180000,
    artwork: 'court',
    image: '/images/sport.jpg',
    coverTitle: 'PLAY\nTHE CITY.',
    description:
      'Gặp gỡ cộng đồng yêu bóng rổ, theo dõi các trận đấu giao hữu và hòa vào không khí trên khán đài.',
    admission: 'numbered',
  },
  {
    id: 'motion',
    title: 'Giữa những chuyển động · Múa đương đại',
    displayName: 'CHUYỂN ĐỘNG',
    organization: 'Không Gian Nghệ Thuật (minh họa)',
    category: 'art',
    city: 'Hà Nội',
    venue: 'Sân khấu Mở (minh họa)',
    startsAt: '2026-11-28T19:30:00+07:00',
    priceVnd: 320000,
    artwork: 'motion',
    image: '/images/art.jpg',
    coverTitle: 'giữa những\nchuyển động',
    description:
      'Một câu chuyện được kể bằng chuyển động, ánh sáng và khoảng trống trong không gian gần gũi.',
    admission: 'numbered',
  },
  {
    id: 'clay',
    title: 'Một ngày làm gốm · Workshop sáng tạo',
    displayName: 'CHẠM STUDIO',
    organization: 'Chạm Studio (minh họa)',
    category: 'workshop',
    city: 'TP. Hồ Chí Minh',
    venue: 'Xưởng Chạm (minh họa)',
    startsAt: '2026-11-29T09:00:00+07:00',
    priceVnd: 290000,
    artwork: 'clay',
    coverTitle: 'chạm đất.\nchạm mình.',
    description:
      'Dành một buổi sáng để tìm hiểu đất sét và thử tạo hình món đồ nhỏ của riêng mình.',
    admission: 'quantity',
  },
  {
    id: 'forest',
    title: 'Đi tìm màu xanh · Trải nghiệm thiên nhiên',
    displayName: 'ĐI & CẢM',
    organization: 'Đi Và Cảm (minh họa)',
    category: 'experience',
    city: 'Đà Nẵng',
    venue: 'Điểm hẹn Vườn Xanh (minh họa)',
    startsAt: '2026-12-05T07:00:00+07:00',
    priceVnd: 350000,
    artwork: 'forest',
    coverTitle: 'đi tìm\nmàu xanh.',
    description:
      'Chậm lại giữa thiên nhiên, quan sát những chi tiết nhỏ và trải nghiệm ngoài trời cùng người đồng hành.',
    admission: 'quantity',
  },
  {
    id: 'pmc',
    title: 'Fanmeeting PMC · Những điều muốn nói',
    displayName: 'PMC',
    organization: 'Công ty chủ quản PMC (minh họa)',
    category: 'other',
    city: 'Hà Nội',
    venue: 'Không gian Kết Nối (minh họa)',
    startsAt: '2026-12-12T18:00:00+07:00',
    priceVnd: 550000,
    artwork: 'pmc',
    coverTitle: 'PMC\nwith you.',
    description:
      'Một cuộc hẹn dành cho những câu chuyện, giao lưu và khoảnh khắc được chia sẻ cùng nhau.',
    admission: 'quantity',
    reopening: 'Đợt mở bán tiếp theo trong hạn mức đã duyệt (tình huống minh họa).',
  },
];

export function normalizeSearch(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLocaleLowerCase('vi')
    .trim();
}
export function filterEvents(
  events: DiscoveryEvent[],
  filters: {
    query: string;
    category: string;
    city: string;
    date?: string;
    reopening: boolean;
    sort: string;
  },
) {
  const query = normalizeSearch(filters.query);
  return events
    .filter(
      (event) =>
        (!filters.category || event.category === filters.category) &&
        (!filters.city || event.city === filters.city) &&
        (!filters.date || eventLocalDate(event.startsAt) === filters.date) &&
        (!filters.reopening || Boolean(event.reopening)) &&
        (!query ||
          normalizeSearch(
            `${event.title} ${event.displayName} ${event.city} ${event.venue} ${event.organization}`,
          ).includes(query)),
    )
    .sort((a, b) =>
      filters.sort === 'price'
        ? a.priceVnd - b.priceVnd
        : filters.sort === 'price-desc'
          ? b.priceVnd - a.priceVnd
          : Date.parse(a.startsAt) - Date.parse(b.startsAt),
    );
}
export function eventLocalDate(value: string) {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).formatToParts(new Date(value));
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export const formatPrice = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value);
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value));
