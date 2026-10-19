import { privateOperation as op } from '../../../shared/openapi/private-operation.js';
import { contentChange, operationDecision } from './event-operations.schema.js';
const root = '/organizer/events/{id}';
export const eventOperationsPaths = {
  '/admin/event-changes/{changeId}': {
    get: op(
      '/admin/event-changes/{changeId}',
      'get',
      'Admin',
      'Đối chiếu snapshot nội dung đề xuất và tên/mô tả/version sự kiện hiện tại.',
    ),
  },
  '/organizer/event-changes/{changeId}': {
    get: op(
      '/organizer/event-changes/{changeId}',
      'get',
      'Organizer',
      'Chi tiết yêu cầu nội dung và bản đang công bố trong đúng tổ chức.',
    ),
  },
  [root + '/operations']: {
    get: op(
      root + '/operations',
      'get',
      'Organizer',
      'Trạng thái sự kiện và tiến độ hậu xử lý; lỗi sẽ retry trong worker hiện có.',
    ),
  },
  [root + '/content-changes']: {
    get: op(
      root + '/content-changes',
      'get',
      'Organizer',
      'Yêu cầu sửa nội dung thuộc tổ chức.',
      undefined,
      ['status', 'page', 'pageSize'],
    ),
    post: op(
      root + '/content-changes',
      'post',
      'Organizer',
      'Gửi tên/mô tả để Admin duyệt; giữ lịch/giá/ghế hiện tại.',
      contentChange,
    ),
  },
  [root + '/cancel']: {
    post: op(
      root + '/cancel',
      'post',
      'Organizer',
      'Hủy trước mọi suất, chưa vé USED; dừng bán/vào cửa ngay, worker lập hoàn tiền và thông báo.',
      operationDecision,
    ),
  },
  '/organizer/event-changes/{changeId}/withdraw': {
    post: op(
      '/organizer/event-changes/{changeId}/withdraw',
      'post',
      'Organizer',
      'Rút yêu cầu nội dung chờ duyệt.',
      operationDecision,
    ),
  },
  '/admin/event-changes': {
    get: op('/admin/event-changes', 'get', 'Admin', 'Danh sách yêu cầu nội dung.', undefined, [
      'status',
      'page',
      'pageSize',
    ]),
  },
  '/admin/event-changes/{changeId}/approve': {
    post: op(
      '/admin/event-changes/{changeId}/approve',
      'post',
      'Admin',
      'Duyệt nội dung đúng phiên bản; không ghi lại tồn kho.',
      operationDecision,
    ),
  },
  '/admin/event-changes/{changeId}/reject': {
    post: op(
      '/admin/event-changes/{changeId}/reject',
      'post',
      'Admin',
      'Từ chối nội dung, bắt buộc lý do.',
      operationDecision,
    ),
  },
};
