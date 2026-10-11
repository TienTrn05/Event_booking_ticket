import { body, common, errors, pathId, result } from '../../../shared/openapi/feature-helpers.js';

const profileDate = { type: 'string', format: 'date' };

export const agePaths = {
  '/events/{id}/age-restriction': {
    patch: {
      ...common,
      tags: ['Age'],
      operationId: 'updateDraftAgeRestriction',
      summary: 'Organizer cấu hình tuổi tối thiểu cho event DRAFT (ID DB)',
      parameters: [pathId()],
      description:
        'event.update_own, company session/membership/ownership và đúng version. ageTag tạo từ minimumAge. Không sửa event PUBLISHED.',
      requestBody: body({
        type: 'object',
        additionalProperties: false,
        required: ['minimumAge', 'version'],
        properties: {
          minimumAge: { type: 'integer', minimum: 1, maximum: 32767, nullable: true },
          version: { type: 'integer', minimum: 0, maximum: 2147483647 },
        },
      }),
      responses: { ...errors, '200': result({ type: 'object' }) },
    },
  },
  '/events/{id}/sessions/{sessionId}/age-eligibility': {
    post: {
      ...common,
      tags: ['Age'],
      operationId: 'checkSessionAge',
      summary: 'Tính tuổi tại ngày diễn ra suất theo timezone venue (event public ID)',
      parameters: [pathId(), pathId('sessionId')],
      description:
        'DOB tự khai hoặc DOB hồ sơ, không phải xác minh giấy tờ; identityVerified luôn false. Không dùng tuổi của người mua thay mọi người tham dự.',
      requestBody: body({
        type: 'object',
        additionalProperties: false,
        properties: { dateOfBirth: profileDate },
      }),
      responses: {
        ...errors,
        '200': result({
          type: 'object',
          properties: {
            minimumAge: { type: 'integer', nullable: true },
            ageAtSession: { type: 'integer' },
            ageTag: { type: 'string', nullable: true },
            referenceDate: profileDate,
            eligible: { type: 'boolean' },
            identityVerified: { type: 'boolean', enum: [false] },
          },
        }),
      },
    },
  },
};
