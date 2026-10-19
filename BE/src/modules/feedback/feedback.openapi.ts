import { privateOperation as op } from '../../shared/openapi/private-operation.js';
import {
  feedbackInput,
  feedbackEdit,
  feedbackReply,
  feedbackHandle,
  feedbackModerate,
} from './feedback.schema.js';
export const feedbackPaths = {
  '/feedback': {
    post: op(
      '/feedback',
      'post',
      'Feedback',
      'Gửi đánh giá tổ chức đã mua vé hoặc góp ý app riêng tư.',
      feedbackInput,
    ),
  },
  '/users/me/feedback': {
    get: op('/users/me/feedback', 'get', 'Feedback', 'Danh sách phản hồi của mình.', undefined, [
      'page',
      'pageSize',
    ]),
  },
  '/users/me/feedback/{id}': {
    get: op('/users/me/feedback/{id}', 'get', 'Feedback', 'Xem phản hồi của mình.'),
    patch: op(
      '/users/me/feedback/{id}',
      'patch',
      'Feedback',
      'Sửa đánh giá tổ chức trong 7 ngày; giữ lịch sử.',
      feedbackEdit,
    ),
  },
  '/organizer/organizations/{organizationId}/feedback': {
    get: op(
      '/organizer/organizations/{organizationId}/feedback',
      'get',
      'Feedback',
      'Organizer xem đánh giá và sao tổng hợp tổ chức mình; không gồm góp ý app.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  '/organizer/feedback/{id}': {
    get: op('/organizer/feedback/{id}', 'get', 'Feedback', 'Xem đánh giá thuộc tổ chức mình.'),
  },
  '/organizer/feedback/{id}/reply': {
    post: op(
      '/organizer/feedback/{id}/reply',
      'post',
      'Feedback',
      'Organizer trả lời, không xóa hoặc ẩn đánh giá.',
      feedbackReply,
    ),
  },
  '/admin/feedback': {
    get: op(
      '/admin/feedback',
      'get',
      'Feedback',
      'Admin xem phản hồi; lọc kind SYSTEM hoặc ORGANIZATION.',
      undefined,
      ['kind', 'page', 'pageSize'],
    ),
  },
  '/admin/feedback/{id}': {
    get: op(
      '/admin/feedback/{id}',
      'get',
      'Feedback',
      'Admin xem đánh giá tổ chức hoặc góp ý app.',
    ),
  },
  '/admin/feedback/{id}/handle': {
    post: op(
      '/admin/feedback/{id}/handle',
      'post',
      'Feedback',
      'Admin trả lời/cập nhật trạng thái góp ý app.',
      feedbackHandle,
    ),
  },
  '/admin/feedback/{id}/moderate': {
    post: op(
      '/admin/feedback/{id}/moderate',
      'post',
      'Feedback',
      'Admin ẩn/hiện đánh giá tổ chức có lý do; không dùng để phạt ý kiến tiêu cực.',
      feedbackModerate,
    ),
  },
};
