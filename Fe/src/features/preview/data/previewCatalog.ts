import type { HomeCatalog } from '../../catalog/types';
import type { PreviewItem, PreviewKind } from '../types';
import { formatPrice } from '../../../shared/utils/format';

export function getPreviewItem(catalog: HomeCatalog, kind: PreviewKind | null, id: string | null) {
  if (!kind || !id) return;
  if (kind === 'event') {
    const event = catalog.events.find((item) => item.id === id);
    if (!event) return;
    return {
      kind,
      id,
      eyebrow: event.category,
      title: event.title,
      description: event.description,
      image: event.image,
      facts: [
        { label: 'Thời gian', value: event.dateLabel },
        { label: 'Địa điểm', value: `${event.venue}, ${event.city}` },
        { label: 'Tổ chức', value: event.organizer },
      ],
      detailPath: `/events/${id}`,
    } satisfies PreviewItem;
  }
  if (kind === 'product') {
    const product = catalog.merchandise.find((item) => item.id === id);
    if (!product) return;
    return {
      kind,
      id,
      eyebrow: product.badge ?? 'Merchandise',
      title: product.name,
      description: product.description,
      image: product.image,
      facts: [
        { label: 'Sự kiện', value: product.eventTitle },
        { label: 'Đơn vị', value: product.organizer },
        { label: 'Giá', value: formatPrice(product.price, product.currency) },
      ],
      detailPath: `/merchandise/${id}`,
    } satisfies PreviewItem;
  }
  if (kind === 'article') {
    const article = catalog.articles.find((item) => item.id === id);
    if (!article) return;
    return {
      kind,
      id,
      eyebrow: article.category,
      title: article.title,
      description: article.excerpt,
      image: article.image,
      facts: [
        { label: 'Ngày đăng', value: article.date },
        { label: 'Thời lượng', value: article.readTime },
      ],
      detailPath: `/blog/${id}`,
    } satisfies PreviewItem;
  }
  if (kind === 'organizer') {
    const organizer = catalog.organizers.find((item) => item.id === id);
    if (!organizer) return;
    return {
      kind,
      id,
      eyebrow: organizer.verified ? 'Đã xác minh' : 'Organizer',
      title: organizer.name,
      description: organizer.summary,
      image: organizer.avatar,
      facts: [
        { label: 'Danh mục', value: organizer.category },
        { label: 'Sự kiện', value: `${organizer.eventCount} sự kiện` },
        { label: 'Sắp tới', value: organizer.upcomingEventDate ?? 'Đang cập nhật' },
      ],
      detailPath: `/organizers/${id}`,
    } satisfies PreviewItem;
  }
  const request = catalog.reopeningRequests.find((item) => item.id === id);
  if (!request) return;
  return {
    kind,
    id,
    eyebrow: 'Hồ sơ mở bán đã duyệt',
    title: request.eventTitle,
    description: request.reason,
    image: request.image,
    facts: [
      { label: 'Loại yêu cầu', value: request.type },
      { label: 'Tổ chức', value: request.organizer },
      { label: 'Ảnh hưởng', value: request.impactSummary },
    ],
    detailPath: `/reopening?request=${id}`,
  } satisfies PreviewItem;
}
