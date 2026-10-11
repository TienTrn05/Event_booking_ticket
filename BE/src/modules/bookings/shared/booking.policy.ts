import { AppError } from '../../../shared/errors/app-error.js';
import type { SaleContext } from './booking.repository.js';
export function assertPublic(context: SaleContext, time: Date) {
  if (
    context.event_status !== 'PUBLISHED' ||
    context.organization_status !== 'APPROVED' ||
    !context.published_at ||
    context.published_at > time
  )
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy sự kiện công khai.');
}

export function assertSale(context: SaleContext, time: Date) {
  assertPublic(context, time);
  if (
    context.session_status !== 'SCHEDULED' ||
    time < context.sale_opens_at ||
    time >= context.sale_closes_at ||
    time >= context.starts_at
  )
    throw new AppError(409, 'SALE_CLOSED', 'Suất diễn chưa mở hoặc đã đóng bán.');
}
