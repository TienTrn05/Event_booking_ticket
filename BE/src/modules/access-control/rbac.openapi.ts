import { privateOperation as op } from '../../shared/openapi/private-operation.js';
import {
  archiveRoleInput,
  assignmentInput,
  createRoleInput,
  updateRoleInput,
} from './rbac.schema.js';
const policy =
  'Chỉ ADMIN có rbac.manage. Mutation: xác thực trong 5 phút, reason 5–500 ký tự, Origin và Idempotency-Key; không tự đổi quyền. Kết quả mutation {auditId,resourceType,resourceId,version}; replay giữ nguyên kết quả đã audit.';
export const rbacPaths = {
  '/admin/rbac/permissions': {
    get: op(
      '/admin/rbac/permissions',
      'get',
      'RBAC',
      'Catalog permission chỉ đọc: items {code,description,baseRoles[]}. ' + policy,
    ),
  },
  '/admin/rbac/roles': {
    get: op(
      '/admin/rbac/roles',
      'get',
      'RBAC',
      'Role phân trang: items {id,code,name,description,baseRole,status,version,system,userCount,permissionCodes[]}, total. ' +
        policy,
      undefined,
      ['page', 'pageSize', 'status'],
    ),
    post: op(
      '/admin/rbac/roles',
      'post',
      'RBAC',
      'Tạo role CUSTOM_* bổ sung trong nhóm gốc; không tạo permission mới. ' + policy,
      createRoleInput,
    ),
  },
  '/admin/rbac/roles/{roleId}': {
    put: op(
      '/admin/rbac/roles/{roleId}',
      'put',
      'RBAC',
      'Sửa tên/mô tả/permission role tùy chỉnh ACTIVE, version hiện hành; code/baseRole bất biến. Không sửa role đang giữ. ' +
        policy,
      updateRoleInput,
    ),
  },
  '/admin/rbac/roles/{roleId}/archive': {
    post: op(
      '/admin/rbac/roles/{roleId}/archive',
      'post',
      'RBAC',
      'Lưu trữ role tùy chỉnh chưa có người giữ; không xóa lịch sử. ' + policy,
      archiveRoleInput,
    ),
  },
  '/admin/rbac/users': {
    get: op(
      '/admin/rbac/users',
      'get',
      'RBAC',
      'Tìm theo displayName 2–120 ký tự hoặc ID chính xác (kể cả 1 chữ số); search bắt buộc. items {id,displayName,status}, total. Không trả email/identity. ' +
        policy,
      undefined,
      ['search', 'page', 'pageSize'],
    ),
  },
  '/admin/rbac/users/{userId}': {
    get: op(
      '/admin/rbac/users/{userId}',
      'get',
      'RBAC',
      'User: id,displayName,status,onboarded,rolesVersion,roles[],permissionCodes[] hợp các role. ' +
        policy,
    ),
  },
  '/admin/rbac/users/{userId}/roles/{roleId}': {
    put: op(
      '/admin/rbac/users/{userId}/roles/{roleId}',
      'put',
      'RBAC',
      'Cấp role tùy chỉnh cùng nhóm hoặc ADMIN cho User ACTIVE đã onboarding. CUSTOMER/ORGANIZER giữ luồng hiện có. Kiểm tra rolesVersion/roleVersion. ' +
        policy,
      assignmentInput,
    ),
    delete: op(
      '/admin/rbac/users/{userId}/roles/{roleId}',
      'delete',
      'RBAC',
      'Thu hồi role tùy chỉnh hoặc ADMIN; bảo vệ Admin hoạt động cuối cùng, thu hồi role bổ sung nhóm ADMIN trước. ' +
        policy,
      assignmentInput,
    ),
  },
  '/admin/rbac/audit': {
    get: op(
      '/admin/rbac/audit',
      'get',
      'RBAC',
      'Audit phân trang: actorId/action/resourceType/resourceId/reason/before/after/requestId/createdAt; lọc User/role, chỉ lịch sử RBAC. ' +
        policy,
      undefined,
      ['page', 'pageSize', 'userId', 'roleId'],
    ),
  },
};
