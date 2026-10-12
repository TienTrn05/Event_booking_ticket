import { body, common, result, pathId } from '../../../shared/openapi/feature-helpers.js';
import { inputSchema, idempotencyHeader } from '../../../shared/openapi/input-schema.js';
import {
  draftInput,
  editInput,
  layoutInput,
  sessionInput,
  typeInput,
  pricingInput,
  versionInput,
  reviewDecision,
} from './event-management.schema.js';
const response = {
  ...common.responses,
  '200': result({ type: 'object' }),
  '201': result({ type: 'object' }),
};
const organizer = { ...common, tags: ['Organizer'], responses: response };
const admin = { ...organizer, tags: ['Admin'] };
const mutation = (
  schema: Parameters<typeof inputSchema>[0],
  summary: string,
  parameters: Record<string, unknown>[] = [pathId()],
) => ({
  ...organizer,
  summary,
  parameters: [...parameters, idempotencyHeader],
  requestBody: body(inputSchema(schema)),
  description:
    'Origin đúng PUBLIC_APP_URL; permission và tổ chức/membership được kiểm tra trong DB. version là event.version. Chỉ sửa DRAFT, mọi thay đổi cấu hình tăng event.version. Retry cùng key/body.',
});
export const eventManagementPaths = {
  '/organizer/event-options': {
    get: {
      ...organizer,
      summary: 'Category ID số và venue catalog có kích thước/bounds để cấu hình nháp',
    },
  },
  '/organizer/events': {
    get: { ...organizer, summary: 'Danh sách sự kiện trong tổ chức của tôi' },
    post: mutation(draftInput, 'Tạo sự kiện nháp', []),
  },
  '/organizer/events/{id}': {
    get: {
      ...organizer,
      summary: 'Toàn bộ cấu hình sự kiện, ID ghế/loại vé và version',
      parameters: [pathId()],
    },
    patch: mutation(editInput, 'Sửa thông tin và minimumAge'),
  },
  '/organizer/events/{id}/layouts': {
    post: mutation(layoutInput, 'Tạo sơ đồ ghế từ venue catalog'),
  },
  '/organizer/events/{id}/sessions': {
    post: mutation(sessionInput, 'Tạo suất với các khoảng bán/check-in/vào cửa'),
  },
  '/organizer/events/{id}/sessions/{sessionId}': {
    patch: mutation(sessionInput, 'Sửa suất nháp; đổi layout phải cấu hình lại giá', [
      pathId(),
      pathId('sessionId'),
    ]),
  },
  '/organizer/events/{id}/sessions/{sessionId}/ticket-types': {
    post: mutation(typeInput, 'Tạo loại vé cho suất', [pathId(), pathId('sessionId')]),
  },
  '/organizer/events/{id}/sessions/{sessionId}/prices': {
    put: mutation(pricingInput, 'Cấu hình giá VND cho từng ghế; chưa tạo inventory', [
      pathId(),
      pathId('sessionId'),
    ]),
  },
  '/organizer/events/{id}/submit': {
    post: {
      ...mutation(versionInput, 'Gửi duyệt, chụp snapshot và khóa cấu hình'),
      description:
        'Ảnh R2 đã complete, có suất/ghế/loại vé/giá đầy đủ. Gửi trước suất sớm nhất một tháng lịch theo timezone venue; review hết hạn sau 15 ngày. Chưa tạo session_seats.',
    },
  },
  '/organizer/events/{id}/reopen': {
    post: mutation(versionInput, 'Mở lại nháp bị từ chối/hết hạn'),
  },
  '/organizer/event-reviews/{reviewId}/withdraw': {
    post: mutation(versionInput, 'Rút hồ sơ còn hạn để sửa nháp', [pathId('reviewId')]),
  },
  '/admin/event-reviews': { get: { ...admin, summary: 'Hàng đợi hồ sơ chờ duyệt' } },
  '/admin/event-reviews/{id}': {
    get: { ...admin, summary: 'Đọc snapshot bất biến của hồ sơ', parameters: [pathId()] },
  },
  '/admin/event-reviews/{id}/approve': {
    post: {
      ...mutation(reviewDecision, 'Admin duyệt → tạo session_seats và xuất bản'),
      tags: ['Admin'],
      description:
        'Chỉ Admin event.review; tổ chức đã được duyệt, review còn hạn và đúng event.version. Transaction tạo inventory, trạng thái PUBLISHED, publication và notification/outbox. Không cho Organizer tự publish.',
    },
  },
  '/admin/event-reviews/{id}/reject': {
    post: { ...mutation(reviewDecision, 'Admin từ chối và gửi lý do/hướng dẫn'), tags: ['Admin'] },
  },
  '/admin/event-reviews/{id}/reason': {
    post: {
      ...mutation(reviewDecision, 'Admin hoàn thiện thông báo lý do sau expiry'),
      tags: ['Admin'],
      description:
        'version là reason_notice.version, chỉ notice DRAFT của review EXPIRED. Retry cùng key/body; đã gửi không được sửa.',
    },
  },
};
