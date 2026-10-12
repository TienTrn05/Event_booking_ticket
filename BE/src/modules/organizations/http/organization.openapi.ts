import { body, common, result, pathId, page } from '../../../shared/openapi/feature-helpers.js';
import { inputSchema, idempotencyHeader } from '../../../shared/openapi/input-schema.js';
import {
  organizationInput,
  organizationResubmit,
  organizationDecision,
} from './organization.schema.js';
const own = {
  ...common,
  tags: ['Organizer'],
  responses: {
    ...common.responses,
    '200': result({ type: 'object' }),
    '201': result({ type: 'object' }),
  },
};
const mutation = (schema: Parameters<typeof inputSchema>[0], summary: string, hasId = true) => ({
  ...own,
  summary,
  parameters: [...(hasId ? [pathId()] : []), idempotencyHeader],
  requestBody: body(inputSchema(schema)),
});
export const organizationPaths = {
  '/organizations/applications': {
    get: { ...own, summary: 'Danh sách hồ sơ tổ chức của mình' },
    post: {
      ...mutation(organizationInput, 'Organizer đăng ký tổ chức bằng email cá nhân', false),
      description:
        'Đã hoàn tất onboarding ORGANIZER. Không yêu cầu email/domain công ty; membership PENDING cho tạo nháp. Chưa có quyền mở bán/kiểm tra vé.',
    },
  },
  '/organizations/applications/{id}': {
    get: { ...own, summary: 'Xem hồ sơ tổ chức của mình', parameters: [pathId()] },
    patch: mutation(organizationResubmit, 'Sửa và gửi lại hồ sơ bị từ chối'),
  },
  '/admin/organization-applications': {
    get: {
      ...own,
      tags: ['Admin'],
      summary: 'Admin xem hồ sơ tổ chức',
      parameters: [
        ...page,
        {
          name: 'status',
          in: 'query',
          schema: {
            type: 'string',
            enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'],
            default: 'PENDING_REVIEW',
          },
        },
      ],
    },
  },
  '/admin/organization-applications/{id}/approve': {
    post: {
      ...mutation(organizationDecision, 'Duyệt tổ chức và kích hoạt membership'),
      tags: ['Admin'],
      description:
        'organizer.approve và đăng nhập trong 5 phút. Chỉ fixture Admin trên DB tạm; chưa cấp tài khoản thật.',
    },
  },
  '/admin/organization-applications/{id}/reject': {
    post: { ...mutation(organizationDecision, 'Từ chối tổ chức kèm lý do'), tags: ['Admin'] },
  },
};
