import type { HomeCatalog } from '../../catalog/types';
import type { PreviewItem, PreviewKind } from '../types';
import { formatPrice } from '../../../shared/utils/format';
import { formatEventDate } from '../../events/utils/event-time';

export function getPreviewItem(
  catalog: HomeCatalog,
  kind: PreviewKind | null,
  id: string | null,
  t: (vi: string, en: string) => string,
  locale: string,
) {
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
        { label: t('Thời gian', 'Date'), value: formatEventDate(event.startsAt, locale) },
        { label: t('Địa điểm', 'Venue'), value: `${event.venue}, ${event.city}` },
        { label: t('Tổ chức', 'Organizer'), value: event.organizer },
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
        { label: t('Sự kiện', 'Event'), value: product.eventTitle },
        { label: t('Đơn vị', 'Organizer'), value: product.organizer },
        { label: t('Giá', 'Price'), value: formatPrice(product.price, product.currency) },
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
        { label: t('Ngày đăng', 'Published'), value: article.date },
        { label: t('Thời lượng', 'Reading time'), value: article.readTime },
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
      eyebrow: organizer.verified ? t('Đã xác minh', 'Verified') : t('Nhà tổ chức', 'Organizer'),
      title: organizer.name,
      description: organizer.summary,
      image: organizer.avatar,
      facts: [
        { label: t('Danh mục', 'Category'), value: organizer.category },
        {
          label: t('Sự kiện', 'Events'),
          value: t(`${organizer.eventCount} sự kiện`, `${organizer.eventCount} events`),
        },
        {
          label: t('Sắp tới', 'Upcoming'),
          value: organizer.upcomingEventDate ?? t('Đang cập nhật', 'To be announced'),
        },
      ],
      detailPath: `/organizers/${id}`,
    } satisfies PreviewItem;
  }
  const request = catalog.reopeningRequests.find((item) => item.id === id);
  if (!request) return;
  return {
    kind,
    id,
    eyebrow: t('Hồ sơ mở bán đã duyệt', 'Approved sales request'),
    title: request.eventTitle,
    description: request.reason,
    image: request.image,
    facts: [
      { label: t('Loại yêu cầu', 'Request type'), value: request.type },
      { label: t('Tổ chức', 'Organizer'), value: request.organizer },
      { label: t('Ảnh hưởng', 'Impact'), value: request.impactSummary },
    ],
    detailPath: `/reopening?request=${id}`,
  } satisfies PreviewItem;
}
