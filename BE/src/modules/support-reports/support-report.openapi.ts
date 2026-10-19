import { z } from 'zod';
import { privateOperation as op } from '../../shared/openapi/private-operation.js';
import { versionSchema } from '../../shared/validation/common.schema.js';
import { reportInput, claimReportInput, unpublishInput } from './support-report.schema.js';
const close = z
  .object({ version: versionSchema, resolution: z.string().trim().min(3).max(2000) })
  .strict();
export const supportReportPaths = {
  '/reports': {
    post: op(
      '/reports',
      'post',
      'Support',
      'Gửi report cho đơn của mình hoặc sự kiện trong phạm vi tổ chức.',
      reportInput,
    ),
    get: op('/reports', 'get', 'Support', 'Report do chính mình gửi.', undefined, [
      'status',
      'page',
      'pageSize',
    ]),
  },
  '/reports/{id}': {
    get: op(
      '/reports/{id}',
      'get',
      'Support',
      'Người gửi, Organizer đúng scope hoặc Admin report.handle đọc report.',
    ),
  },
  '/admin/reports': {
    get: op(
      '/admin/reports',
      'get',
      'Support',
      'Hàng đợi report, có phân trang/lọc trạng thái.',
      undefined,
      ['status', 'page', 'pageSize'],
    ),
  },
  '/admin/reports/{id}/claim': {
    post: op(
      '/admin/reports/{id}/claim',
      'post',
      'Support',
      'Nhận report OPEN đúng version, không nhận lại của Admin khác.',
      claimReportInput,
    ),
  },
  '/admin/reports/{id}/resolve': {
    post: op(
      '/admin/reports/{id}/resolve',
      'post',
      'Support',
      'Đóng report; thu hồi scope can thiệp.',
      close,
    ),
  },
  '/admin/bookings/{id}': {
    get: {
      ...op(
        '/admin/bookings/{id}',
        'get',
        'Support',
        'Đọc trạng thái/số tiền của đúng booking trong report IN_REVIEW được giao; không QR/CCCD/credential.',
      ),
      parameters: [
        { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        {
          name: 'reportId',
          in: 'query',
          required: true,
          schema: { type: 'string', pattern: '^[1-9][0-9]{0,18}$' },
        },
      ],
    },
  },
  '/admin/events/{id}/unpublish': {
    post: op(
      '/admin/events/{id}/unpublish',
      'post',
      'Admin',
      'Gỡ sự kiện PUBLISHED theo report; phiên xác thực mới trong5 phút. ARCHIVED ngừng hiển thị/bán/check-in/vào cửa. Giữ đơn/vé/tiền, không tạo hoàn tiền hoặc đền bù.',
      unpublishInput,
    ),
  },
};
