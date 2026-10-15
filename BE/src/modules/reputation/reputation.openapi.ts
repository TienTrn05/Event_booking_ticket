import { privateOperation as op } from '../../shared/openapi/private-operation.js';
import { reputationAdjustment, reputationReversal } from './reputation.schema.js';
export const reputationPaths = {
  '/admin/organizations/{organizationId}/reputation': {
    get: op(
      '/admin/organizations/{organizationId}/reputation',
      'get',
      'Admin',
      'Uy tín nội bộ REPUTATION_V1, score=null dưới5 reviews; ledger phân trang. ADMIN/event.review.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  '/organizer/organizations/{organizationId}/reputation': {
    get: op(
      '/organizer/organizations/{organizationId}/reputation',
      'get',
      'Organizer',
      'Uy tín và ledger của tổ chức APPROVED/membership ACTIVE; sales.read_own.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  '/admin/organizations/{organizationId}/reputation/adjustments': {
    post: op(
      '/admin/organizations/{organizationId}/reputation/adjustments',
      'post',
      'Admin',
      'Điều chỉnh tối đa±20 theo report RESOLVED được giao đúng tổ chức; nguồn duy nhất, feedback.manage/report.handle.',
      reputationAdjustment,
    ),
  },
  '/admin/reputation/{id}/reverse': {
    post: op(
      '/admin/reputation/{id}/reverse',
      'post',
      'Admin',
      'Đảo một bút toán nguồn đúng một lần, không xóa lịch sử.',
      reputationReversal,
    ),
  },
};
