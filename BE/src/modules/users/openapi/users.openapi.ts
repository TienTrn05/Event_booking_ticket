import { errorResponse, ref, response } from '../../../shared/openapi/helpers.js';
export const usersPaths = {
  '/users/me': {
    get: {
      tags: ['Users'],
      operationId: 'getMyProfile',
      summary: 'Đọc hồ sơ cá nhân',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': response('Hồ sơ của User hiện tại.', ref('UserProfile')),
        '401': errorResponse('Phiên không hợp lệ.'),
      },
    },
    patch: {
      tags: ['Users'],
      operationId: 'updateMyProfile',
      summary: 'Cập nhật hồ sơ cá nhân',
      security: [{ bearerAuth: [] }],
      description:
        'Origin khớp PUBLIC_APP_URL, Bearer JWT/phiên DB và profile.update_self. PATCH displayName/gender/dateOfBirth; cần ít nhất một field. Gender/DOB riêng tư, nullable, DOB ngày thật không ở tương lai. Không lưu tuổi cố định. Avatar thay qua media; email/phone/role/status/userId/avatarUrl không nhận ở đây.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              minProperties: 1,
              properties: {
                displayName: { type: 'string', minLength: 1, maxLength: 120 },
                gender: {
                  type: 'string',
                  nullable: true,
                  enum: ['MALE', 'FEMALE', 'OTHER', 'UNDISCLOSED', null],
                },
                dateOfBirth: { type: 'string', format: 'date', nullable: true },
              },
            },
          },
        },
      },
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '200': response('Hồ sơ đã cập nhật.', ref('UserProfile')),
        '400': errorResponse('Input không hợp lệ.'),
        '401': errorResponse('Phiên không hợp lệ.'),
        '403': errorResponse('Origin hoặc quyền không hợp lệ.'),
      },
    },
  },
};
