import { z } from 'zod';
import { ApiError, apiRequest } from '../../shared/api/client';
export const roleSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string(),
  baseRole: z.enum(['CUSTOMER', 'ORGANIZER', 'ADMIN']),
  status: z.enum(['ACTIVE', 'ARCHIVED']),
  version: z.number().int(),
  system: z.boolean(),
  userCount: z.number().int(),
  permissionCodes: z.array(z.string()),
});
export type Role = z.infer<typeof roleSchema>;
export const permissionSchema = z.object({
  code: z.string(),
  description: z.string(),
  baseRoles: z.array(z.string()),
});
export type Permission = z.infer<typeof permissionSchema>;
export const userSummarySchema = z.object({
  id: z.string(),
  displayName: z.string(),
  status: z.string(),
});
export const userSchema = userSummarySchema.extend({
  onboarded: z.boolean(),
  rolesVersion: z.number().int(),
  roles: z.array(roleSchema),
  permissionCodes: z.array(z.string()),
});
export type RbacUser = z.infer<typeof userSchema>;
export const auditSchema = z.object({
  id: z.string(),
  actorId: z.string(),
  action: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  reason: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  requestId: z.string(),
  createdAt: z.string(),
});
export const changeSchema = z.object({
  auditId: z.string(),
  resourceType: z.string(),
  resourceId: z.string(),
  version: z.number().int(),
});
export const paged = <T extends z.ZodType>(item: T) =>
  z.object({ items: z.array(item), total: z.number().int() });
export type Command = {
  path: string;
  method: 'POST' | 'PUT' | 'DELETE';
  body: Record<string, unknown>;
};
export async function rbacRequest<T>(
  token: string,
  path: string,
  schema: z.ZodType<T>,
  options: RequestInit = {},
) {
  const data = await apiRequest('/admin/rbac' + path, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...options.headers },
  });
  return z.object({ data: schema }).parse(data).data;
}
const messages: Record<string, string> = {
  RBAC_BUSY: 'Tài khoản hoặc permission đang được xử lý. Thử lại sau ít giây.',
  REAUTHENTICATION_REQUIRED: 'Cần đăng nhập lại rồi thực hiện thay đổi trong 5 phút.',
  SELF_CHANGE_FORBIDDEN: 'Bạn không được thay đổi role của chính mình hoặc sửa role mình đang giữ.',
  SYSTEM_ROLE_PROTECTED:
    'Role gốc được bảo vệ. Customer/Organizer được cấp qua luồng nghiệp vụ hiện có.',
  RBAC_VERSION_CONFLICT: 'Một Admin khác vừa thay đổi dữ liệu. Tải lại trước khi tiếp tục.',
  RBAC_ASSIGNMENT_CONFLICT: 'Trạng thái gán role đã thay đổi. Tải lại trước khi tiếp tục.',
  PERMISSION_SCOPE: 'Permission phải thuộc nhóm role gốc đã chọn.',
  ROLE_AUDIENCE_MISMATCH: 'User cần có role gốc tương ứng để nhận role bổ sung.',
  ROLE_CODE_EXISTS: 'Mã role đã tồn tại. Hãy chọn mã khác.',
  ROLE_IN_USE: 'Thu hồi hết các lượt gán trước khi lưu trữ role.',
  USER_ROLE_INELIGIBLE: 'User cần hoạt động, hoàn tất đăng ký và role còn hiệu lực.',
  LAST_ADMIN_PROTECTED: 'Không thể thu hồi Admin hoạt động cuối cùng.',
  DEPENDENT_ROLES_EXIST: 'Thu hồi các role bổ sung nhóm ADMIN trước khi thu hồi ADMIN.',
};
const englishMessages: Record<string, string> = {
  RBAC_BUSY: 'The user or permission is busy. Try again in a few seconds.',
  REAUTHENTICATION_REQUIRED: 'Sign in again, then make the change within 5 minutes.',
  SELF_CHANGE_FORBIDDEN: 'You cannot change your own roles or a role assigned to you.',
  SYSTEM_ROLE_PROTECTED:
    'Base roles are protected. Customer and Organizer use their existing registration flows.',
  RBAC_VERSION_CONFLICT: 'Another administrator changed this resource. Reload before continuing.',
  RBAC_ASSIGNMENT_CONFLICT: 'This role assignment changed. Reload before continuing.',
  PERMISSION_SCOPE: 'Permissions must belong to the selected base role group.',
  ROLE_AUDIENCE_MISMATCH: 'The user must hold the matching base role.',
  ROLE_CODE_EXISTS: 'This role code already exists. Choose another code.',
  ROLE_IN_USE: 'Revoke all assignments before archiving this role.',
  USER_ROLE_INELIGIBLE: 'The user must be active and registered, and the role must be active.',
  LAST_ADMIN_PROTECTED: 'The last active administrator cannot be removed.',
  DEPENDENT_ROLES_EXIST: 'Revoke additional ADMIN roles before removing ADMIN.',
};
export function rbacError(error: unknown, english = false) {
  if (english) {
    if (error instanceof ApiError)
      return (
        englishMessages[error.code ?? ''] ??
        (error.status === 403
          ? 'You do not have access management permission.'
          : error.status === 401
            ? 'Sign in again to continue.'
            : error.status === 404
              ? 'The resource was not found.'
              : 'The action could not be completed. Check your input and reload.')
      );
    return 'Unable to load data. Please try again.';
  }
  if (error instanceof ApiError)
    return (
      messages[error.code ?? ''] ??
      (error.status === 403
        ? 'Bạn không có quyền quản trị phân quyền.'
        : error.status === 401
          ? 'Phiên đăng nhập cần được xác thực lại.'
          : error.status === 404
            ? 'Không tìm thấy dữ liệu.'
            : 'Chưa thể hoàn tất. Kiểm tra dữ liệu và tải lại.')
    );
  return 'Chưa tải được dữ liệu. Hãy thử lại.';
}
