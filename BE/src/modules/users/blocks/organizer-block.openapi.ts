import { privateOperation as op } from '../../../shared/openapi/private-operation.js';
import { emptyBodySchema } from '../../../shared/validation/common.schema.js';
function change(method: 'put' | 'delete') {
  const operation = op(
    '/users/me/blocked-organizers/{id}',
    method,
    'Users',
    'Customer ẩn/bỏ ẩn Organizer; không khóa tài khoản hoặc thay quyền, follow, đơn/vé.',
    method === 'put' ? emptyBodySchema : undefined,
  );
  return {
    ...operation,
    parameters: operation.parameters
      .filter((p) => p.name !== 'Idempotency-Key')
      .map((p) =>
        p.in === 'path'
          ? { ...p, schema: { type: 'string', description: 'Public ID của Organizer.' } }
          : p,
      ),
    ...(method === 'delete'
      ? { responses: { ...operation.responses, '204': { description: 'Đã bỏ ẩn.' } } }
      : {}),
  };
}
export const organizerBlockPaths = {
  '/users/me/blocked-organizers': {
    get: op(
      '/users/me/blocked-organizers',
      'get',
      'Users',
      'Danh sách Organizer do chính Customer ẩn.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  '/users/me/blocked-organizers/{id}': { put: change('put'), delete: change('delete') },
};
