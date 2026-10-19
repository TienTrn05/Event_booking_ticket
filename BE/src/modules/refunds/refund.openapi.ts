import { z } from 'zod';
import { privateOperation as op } from '../../shared/openapi/private-operation.js';
import { emptyBodySchema, versionSchema } from '../../shared/validation/common.schema.js';
import { refundInput, refundDecision, refundResult } from './refund.schema.js';
const paths: Record<string, Record<string, unknown>> = {
  '/bookings/{bookingId}/refunds': {
    post: op(
      '/bookings/{bookingId}/refunds',
      'post',
      'Refund',
      'Yêu cầu hoàn toàn bộ đơn trước suất ít nhất 24 giờ; không tự chuyển tiền.',
      refundInput,
    ),
  },
  '/users/me/refunds': {
    get: op('/users/me/refunds', 'get', 'Refund', 'Yêu cầu hoàn tiền của mình.', undefined, [
      'page',
      'pageSize',
    ]),
  },
  '/users/me/refunds/{id}': {
    get: op(
      '/users/me/refunds/{id}',
      'get',
      'Refund',
      'Xem yêu cầu và kết quả được ghi nhận thủ công.',
    ),
  },
  '/organizer/organizations/{organizationId}/refunds': {
    get: op(
      '/organizer/organizations/{organizationId}/refunds',
      'get',
      'Refund',
      'Organizer xem refund trong tổ chức mình.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  '/admin/refunds': {
    get: op(
      '/admin/refunds',
      'get',
      'Refund',
      'Admin xem refund đúng booking của report IN_REVIEW được giao; reportId bắt buộc.',
      undefined,
      ['reportId', 'page', 'pageSize'],
    ),
  },
  '/bookings/{bookingId}/support-reports': {
    post: op(
      '/bookings/{bookingId}/support-reports',
      'post',
      'Refund',
      'Gửi report về đơn của mình để Admin can thiệp có phạm vi.',
      z.object({ reason: z.string().trim().min(3).max(2000) }).strict(),
    ),
  },
  '/users/me/support-reports': {
    get: op('/users/me/support-reports', 'get', 'Refund', 'Report của mình.', undefined, [
      'page',
      'pageSize',
    ]),
  },
  '/admin/support-reports': {
    get: op('/admin/support-reports', 'get', 'Refund', 'Admin danh sách report.', undefined, [
      'page',
      'pageSize',
    ]),
  },
  '/admin/support-reports/{id}/claim': {
    post: op(
      '/admin/support-reports/{id}/claim',
      'post',
      'Refund',
      'Admin nhận xử lý report OPEN.',
      emptyBodySchema,
    ),
  },
  '/admin/support-reports/{id}/resolve': {
    post: op(
      '/admin/support-reports/{id}/resolve',
      'post',
      'Refund',
      'Admin được giao đóng report; thu hồi scope can thiệp refund.',
      z.object({ version: versionSchema, resolution: z.string().trim().min(3).max(2000) }).strict(),
    ),
  },
};
for (const prefix of ['/organizer/refunds', '/admin/refunds']) {
  paths[prefix + '/{id}'] = {
    get: op(
      prefix + '/{id}',
      'get',
      'Refund',
      'Xem refund đúng scope; Admin bắt buộc reportId liên quan.',
      undefined,
      prefix.startsWith('/admin') ? ['reportId'] : [],
    ),
  };
  for (const action of ['approve', 'reject', 'retry'] as const)
    paths[prefix + '/{id}/' + action] = {
      post: op(
        prefix + '/{id}/' + action,
        'post',
        'Refund',
        action === 'approve'
          ? 'Duyệt và vô hiệu hóa mọi vé nguyên tử; không bán lại ghế.'
          : action === 'reject'
            ? 'Từ chối yêu cầu, vé giữ nguyên.'
            : 'Thử lại cùng refund/key vận hành; không hồi sinh vé.',
        refundDecision,
      ),
    };
  paths[prefix + '/{id}/result'] = {
    post: op(
      prefix + '/{id}/result',
      'post',
      'Refund',
      'Ghi nhận SUCCESS có reference/chứng từ hoặc FAILED; không phải xác nhận payOS tự động.',
      refundResult,
    ),
  };
}
export const refundPaths = paths;
