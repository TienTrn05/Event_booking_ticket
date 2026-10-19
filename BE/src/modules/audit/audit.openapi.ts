import { privateOperation as op } from '../../shared/openapi/private-operation.js';
export const auditPaths = {
  '/admin/audit-logs': {
    get: op(
      '/admin/audit-logs',
      'get',
      'Audit',
      'Metadata audit có scope duyệt hoặc report được giao. Không trả reason, before/after payload, credential hoặc dữ liệu cá nhân.',
      undefined,
      ['from', 'to', 'resourceType', 'resourceId', 'reportId', 'action', 'page', 'pageSize'],
    ),
  },
};
