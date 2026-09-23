import { articles } from '../../content/data/articles';
import { getEventById } from '../../events/data/eventCatalog';
import { resaleTickets } from '../../events/data/mockData';
import { getMerchandiseById } from '../../merchandise/data/merchandiseCatalog';
import { organizers } from '../../organizer/data/organizers';
import type { PreviewItem, PreviewKind } from '../types';

function eventPreview(id: string): PreviewItem | undefined {
  const event = getEventById(id);
  if (!event) return;
  return {
    kind: 'event',
    id,
    eyebrow: event.category,
    title: event.title,
    description: event.description,
    ...(event.image ? { image: event.image } : {}),
    facts: [
      { label: 'Thời gian', value: event.dateLabel },
      { label: 'Địa điểm', value: `${event.venue}, ${event.city}` },
      { label: 'Tổ chức', value: event.organizer },
    ],
    detailPath: `/events/${id}`,
  };
}

function productPreview(id: string): PreviewItem | undefined {
  const product = getMerchandiseById(id);
  if (!product) return;
  return {
    kind: 'product',
    id,
    eyebrow: product.badge ?? 'Merchandise',
    title: product.name,
    description: `Sản phẩm thuộc bộ sưu tập ${product.eventTitle}.`,
    ...(product.image ? { image: product.image } : {}),
    facts: [
      { label: 'Sự kiện', value: product.eventTitle },
      { label: 'Đơn vị', value: product.organizer },
      { label: 'Giá', value: new Intl.NumberFormat('vi-VN').format(product.priceVnd) + ' đ' },
    ],
    detailPath: `/merchandise/${id}`,
  };
}

function articlePreview(id: string): PreviewItem | undefined {
  if (!Object.hasOwn(articles, id)) return;
  const article = articles[id as keyof typeof articles];
  return {
    kind: 'article',
    id,
    eyebrow: article.category,
    title: article.title,
    description: article.paragraphs[0] ?? article.title,
    image: article.image,
    facts: [
      { label: 'Ngày đăng', value: article.date },
      { label: 'Thời lượng', value: article.readTime },
    ],
    detailPath: `/blog/${id}`,
  };
}

function organizerPreview(id: string): PreviewItem | undefined {
  const organizer = organizers.find((item) => item.id === id);
  if (!organizer) return;
  return {
    kind: 'organizer',
    id,
    eyebrow: organizer.verified ? 'Đã xác minh' : 'Organizer',
    title: organizer.name,
    description: organizer.upcomingEventTitle
      ? `Sự kiện sắp tới: ${organizer.upcomingEventTitle}.`
      : `Nhà tổ chức trong danh mục ${organizer.category}.`,
    image: organizer.avatar,
    facts: [
      { label: 'Danh mục', value: organizer.category },
      { label: 'Sự kiện', value: `${organizer.eventCount} sự kiện` },
      { label: 'Sắp tới', value: organizer.upcomingEventDate ?? 'Đang cập nhật' },
    ],
    detailPath: `/organizers/${id}`,
  };
}

function resalePreview(id: string): PreviewItem | undefined {
  const ticket = resaleTickets.find((item) => item.id === id);
  if (!ticket) return;
  return {
    kind: 'resale',
    id,
    eyebrow: ticket.sellerVerified ? 'Người bán đã xác minh' : 'Vé bán lại',
    title: ticket.eventTitle,
    description: `${ticket.seatInfo}. Vé minh họa trên thị trường thứ cấp.`,
    image: ticket.image,
    facts: [
      { label: 'Thời gian', value: ticket.dateLabel },
      { label: 'Địa điểm', value: `${ticket.venue}, ${ticket.city}` },
      { label: 'Giá', value: new Intl.NumberFormat('vi-VN').format(ticket.resalePrice) + ' đ' },
    ],
    detailPath: `/reopening?ticket=${id}`,
  };
}

export function getPreviewItem(kind: PreviewKind | null, id: string | null) {
  if (!kind || !id) return;
  if (kind === 'event') return eventPreview(id);
  if (kind === 'product') return productPreview(id);
  if (kind === 'article') return articlePreview(id);
  if (kind === 'organizer') return organizerPreview(id);
  return resalePreview(id);
}
