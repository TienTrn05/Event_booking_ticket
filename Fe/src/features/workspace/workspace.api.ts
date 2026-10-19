import { z } from 'zod';
import { apiRequest, ApiError } from '../../shared/api/client';

export const idSchema = z.string().regex(/^[1-9]\d*$/);
const quantity = z.union([z.string(), z.number()]);
export const applicationSchema = z.object({
  id: idSchema,
  name: z.string(),
  status: z.string(),
  version: z.number().int(),
  reviewReason: z.string().nullable().optional(),
});
export const applicationResultSchema = z.object({
  id: idSchema,
  name: z.string(),
  status: z.string(),
  version: z.number().int(),
});
export const membershipSchema = z.object({
  id: idSchema,
  publicId: z.string().nullable(),
  name: z.string(),
  membershipId: idSchema,
  isOwner: z.boolean(),
});
export const eventSummarySchema = z.object({
  id: idSchema,
  organizationId: idSchema,
  title: z.string(),
  status: z.string(),
  version: z.number().int(),
  ticketingMode: z.enum(['NUMBERED', 'QUANTITY']),
});
export const optionsSchema = z.object({
  categories: z.array(z.object({ id: idSchema, name: z.string(), slug: z.string() })),
  venues: z.array(
    z.object({
      id: idSchema,
      name: z.string(),
      city: z.string(),
      timezone: z.string(),
      canvasWidth: quantity,
      canvasHeight: quantity,
      maxCapacity: z.number().int(),
    }),
  ),
});
export const eventGraphSchema = z.object({
  event: z.object({
    id: idSchema,
    organization_id: idSchema,
    title: z.string(),
    category_id: idSchema,
    description: z.string(),
    minimum_age: z.number().nullable(),
    cover_image_url: z.string().nullable(),
    status: z.string(),
    version: z.number().int(),
    ticketing_mode: z.enum(['NUMBERED', 'QUANTITY']),
  }),
  layouts: z.array(
    z.object({
      id: idSchema,
      venue_id: idSchema,
      status: z.string(),
      canvas_width: quantity,
      canvas_height: quantity,
      geometry_json: z.unknown(),
    }),
  ),
  zones: z.array(
    z.object({
      id: idSchema,
      layout_id: idSchema,
      code: z.string(),
      name: z.string(),
      capacity: z.number().int(),
      geometry_json: z.unknown(),
    }),
  ),
  seats: z.array(
    z.object({
      id: idSchema,
      layout_id: idSchema,
      section: z.string(),
      row: z.string(),
      number: z.string(),
      map_x: quantity,
      map_y: quantity,
      width: quantity,
      height: quantity,
    }),
  ),
  sessions: z.array(
    z.object({
      id: idSchema,
      layout_id: idSchema,
      venue_id: idSchema,
      starts_at: z.string(),
      ends_at: z.string(),
      timezone: z.string(),
      pricing_config: z.unknown(),
    }),
  ),
  ticketTypes: z.array(
    z.object({ id: idSchema, session_id: idSchema, code: z.string(), name: z.string() }),
  ),
  reviews: z.array(
    z.object({
      id: idSchema,
      event_version: z.number().int(),
      status: z.string(),
      submitted_at: z.string(),
      expires_at: z.string(),
    }),
  ),
});
export const reviewSummarySchema = z.object({
  id: idSchema,
  event_id: idSchema,
  event_version: z.number().int(),
  status: z.string(),
  expires_at: z.string(),
  title: z.string(),
  organization: z.string(),
});
export const reviewDetailSchema = z.object({
  id: idSchema,
  event_id: idSchema,
  event_version: z.number().int(),
  status: z.string(),
  snapshot_json: eventGraphSchema,
  expires_at: z.string(),
  notice: z.unknown(),
});
export type OrganizationApplication = z.infer<typeof applicationSchema>;
export type OrganizationMembership = z.infer<typeof membershipSchema>;
export type EventSummary = z.infer<typeof eventSummarySchema>;
export type EventOptions = z.infer<typeof optionsSchema>;
export type EventGraph = z.infer<typeof eventGraphSchema>;
export type ReviewSummary = z.infer<typeof reviewSummarySchema>;
export type ReviewDetail = z.infer<typeof reviewDetailSchema>;

export async function workspaceGet<T>(
  token: string,
  path: string,
  schema: z.ZodType<T>,
  signal: AbortSignal,
): Promise<T> {
  const response = await apiRequest(path, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  return z.object({ data: schema }).parse(response).data;
}

export function workspaceError(error: unknown, english = false): string {
  const choose = (vi: string, en: string) => (english ? en : vi);
  if (error instanceof ApiError) {
    if (error.code === 'REAUTHENTICATION_REQUIRED')
      return choose(
        'Thao tác này cần đăng nhập mới trong 5 phút. Hãy đăng xuất rồi đăng nhập lại.',
        'This action requires authentication within 5 minutes. Sign out and sign in again.',
      );
    if (error.status === 401)
      return choose(
        'Phiên đã hết hạn. Hãy đăng nhập lại.',
        'Your session expired. Please sign in again.',
      );
    if (error.status === 403)
      return choose(
        'Tài khoản không có quyền thực hiện thao tác này.',
        'Your account cannot perform this action.',
      );
    if (error.status === 404)
      return choose(
        'Không tìm thấy dữ liệu trong phạm vi của bạn.',
        'This resource is unavailable in your account.',
      );
    const messages: Record<string, [string, string]> = {
      EVENT_VERSION_CONFLICT: [
        'Bản sự kiện đã thay đổi. Hãy tải lại trước khi sửa.',
        'This event changed. Reload it before editing.',
      ],
      ORGANIZATION_VERSION_CONFLICT: [
        'Hồ sơ đã thay đổi. Hãy tải lại danh sách.',
        'This application changed. Reload the list.',
      ],
      EVENT_IMAGE_REQUIRED: [
        'Hãy tải ảnh bìa trước khi gửi duyệt.',
        'Upload a cover image before submitting.',
      ],
      NO_SESSION: ['Cần ít nhất một suất diễn.', 'Add at least one session.'],
      INCOMPLETE_PRICING: [
        'Hãy cấu hình giá cho mọi suất diễn.',
        'Configure pricing for every session.',
      ],
      SUBMISSION_TOO_LATE: [
        'Cần gửi duyệt trước suất sớm nhất ít nhất một tháng lịch.',
        'Submit at least one calendar month before the earliest session.',
      ],
      REVIEW_EXPIRED: [
        'Hồ sơ đã quá hạn duyệt. Hãy tải lại.',
        'This review expired. Reload the queue.',
      ],
      INVALID_SESSION_WINDOWS: [
        'Các khoảng giờ chưa hợp lệ. Hãy kiểm tra giờ mở và đóng.',
        'Check session, sales, counter, and admission time windows.',
      ],
      LAYOUT_CAPACITY: ['Số lượng vượt sức chứa địa điểm.', 'The layout exceeds venue capacity.'],
      LAYOUT_BOUNDS: ['Sơ đồ vượt khung địa điểm.', 'The layout extends outside the venue bounds.'],
      LAYOUT_OVERLAP: ['Ghế hoặc khu vực đang chồng lên nhau.', 'Seats or zones overlap.'],
      REQUEST_IN_PROGRESS: [
        'Yêu cầu đang được xử lý. Thử lại đúng yêu cầu này.',
        'This request is in progress. Retry the same request.',
      ],
    };
    const message = error.code ? messages[error.code] : undefined;
    if (message) return message[english ? 1 : 0];
    if (error.status === 409)
      return choose(
        'Dữ liệu đã thay đổi hoặc trạng thái không còn phù hợp. Hãy tải lại.',
        'The resource changed or its state no longer allows this action. Reload it.',
      );
    if (error.status === 400 || error.status === 422)
      return choose(
        'Thông tin chưa hợp lệ. Hãy kiểm tra các trường đã nhập.',
        'Check the submitted fields and try again.',
      );
  }
  return choose('Chưa tải được dữ liệu. Hãy thử lại.', 'Unable to load data. Please try again.');
}
