import { errorResponse, response } from '../../../shared/openapi/helpers.js';
import { privateOperation as op } from '../../../shared/openapi/private-operation.js';
import { emptyBodySchema } from '../../../shared/validation/common.schema.js';
const sessionMutation = (path: string, method: 'post' | 'delete') => {
  const operation = op(
    path,
    method,
    'Auth',
    'Thu hồi phiên của chính User; Origin và double-submit CSRF bắt buộc.',
    method === 'post' ? emptyBodySchema : undefined,
  );
  return {
    ...operation,
    parameters: [
      ...operation.parameters.filter((p) => p.name !== 'Idempotency-Key'),
      { name: 'X-CSRF-Token', in: 'header', required: true, schema: { type: 'string' } },
    ],
    responses: {
      ...operation.responses,
      '204': {
        description: 'Đã thu hồi. Thu hồi phiên hiện tại hoặc logout-all xóa refresh cookie.',
      },
    },
  };
};
export const authPaths = {
  '/auth/sessions': {
    get: op(
      '/auth/sessions',
      'get',
      'Auth',
      'Phiên còn hoạt động của chính User: id/deviceLabel/provider/authenticatedAt/createdAt/expiresAt/current. Không token/family/identity subject.',
      undefined,
      ['page', 'pageSize'],
    ),
  },
  '/auth/logout-all': { post: sessionMutation('/auth/logout-all', 'post') },
  '/auth/sessions/{sessionId}': { delete: sessionMutation('/auth/sessions/{sessionId}', 'delete') },
  '/auth/config': {
    get: {
      tags: ['Auth'],
      operationId: 'getAuthConfig',
      summary: 'Kiểm tra cấu hình Google, email OTP và session',
      responses: {
        '200': response('Cấu hình công khai.', {
          type: 'object',
          properties: {
            googleEnabled: { type: 'boolean' },
            emailOtpEnabled: { type: 'boolean' },
            sessionEnabled: { type: 'boolean' },
          },
        }),
      },
    },
  },
  '/auth/csrf': {
    get: {
      tags: ['Auth'],
      operationId: 'getAuthCsrf',
      summary: 'Nhận CSRF token cho các POST auth',
      responses: {
        '200': response('CSRF token.', {
          type: 'object',
          properties: { csrfToken: { type: 'string' } },
        }),
        '503': errorResponse('Auth chưa cấu hình.'),
      },
    },
  },
  '/auth/google/start': {
    post: {
      tags: ['Auth'],
      operationId: 'startGoogleAuth',
      summary: 'Bắt đầu Google Authorization Code + PKCE',
      description:
        'link=true cần Bearer JWT/phiên EMAIL mới trong 5 phút; Google cùng email đã xác minh.',
      requestBody: {
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              properties: { link: { type: 'boolean', default: false } },
            },
          },
        },
      },
      parameters: [
        { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '200': response('URL Google để trình duyệt chuyển đến.', {
          type: 'object',
          properties: { authorizationUrl: { type: 'string', format: 'uri' } },
        }),
        '403': errorResponse('Origin hoặc CSRF không hợp lệ.'),
      },
    },
  },
  '/auth/google/callback': {
    get: {
      tags: ['Auth'],
      operationId: 'finishGoogleAuth',
      summary: 'Google callback; đặt refresh cookie và redirect về web',
      responses: { '302': { description: 'Về web với kết quả đăng nhập.' } },
    },
  },
  '/auth/refresh': {
    post: {
      tags: ['Auth'],
      operationId: 'refreshAuth',
      summary: 'Xoay refresh cookie và nhận access JWT',
      parameters: [
        { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '200': response('Access token và người dùng.', {
          type: 'object',
          properties: { accessToken: { type: 'string' }, user: { type: 'object' } },
        }),
        '401': errorResponse('Phiên không hợp lệ hoặc token bị dùng lại.'),
      },
    },
  },
  '/auth/logout': {
    post: {
      tags: ['Auth'],
      operationId: 'logoutAuth',
      summary: 'Thu hồi phiên hiện tại',
      parameters: [
        { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
      ],
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '204': { description: 'Đã thu hồi phiên.' },
      },
    },
  },
  '/auth/me': {
    get: {
      tags: ['Auth'],
      operationId: 'getAuthMe',
      summary: 'Kiểm tra access JWT và phiên trong database',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': response('Người dùng hiện tại.', { type: 'object' }),
        '401': errorResponse('Chưa đăng nhập.'),
      },
    },
  },
  '/auth/methods': {
    get: {
      tags: ['Auth'],
      operationId: 'getOwnLoginMethods',
      summary: 'Phương thức đăng nhập đã liên kết của chính User',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': response('Metadata tài khoản, không phải quyền.', {
          type: 'object',
          properties: {
            email: { type: 'string', nullable: true },
            googleLinked: { type: 'boolean' },
            emailLinked: { type: 'boolean' },
            phones: { type: 'array', items: { type: 'string' } },
          },
        }),
        '401': errorResponse('Access token/phiên không hợp lệ.'),
      },
    },
  },
  '/auth/otp/request': {
    post: {
      tags: ['Auth'],
      operationId: 'requestEmailOtp',
      summary: 'Gửi OTP qua email; SĐT chỉ là alias tra email',
      description:
        'LINK_IDENTITY cần Bearer JWT và phiên mới trong 5 phút, email khớp identity hiện tại. Không trả email tra từ SĐT hoặc mã OTP.',
      parameters: [
        { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['identifier'],
              properties: {
                identifier: { type: 'string', maxLength: 254 },
                phone: { type: 'string', maxLength: 32 },
                purpose: { type: 'string', enum: ['LOGIN', 'LINK_IDENTITY'], default: 'LOGIN' },
              },
            },
          },
        },
      },
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '202': response('Kết quả chung; kiểm tra inbox/thư rác nếu thông tin hợp lệ.', {
          type: 'object',
          required: ['challengeId', 'expiresIn', 'resendAfter'],
          properties: {
            challengeId: { type: 'string' },
            expiresIn: { type: 'integer', example: 300 },
            resendAfter: { type: 'integer', example: 60 },
          },
        }),
        '400': errorResponse('Dữ liệu không hợp lệ.'),
        '401': errorResponse('Cần đăng nhập lại trước khi liên kết.'),
        '403': errorResponse('Origin/CSRF không hợp lệ.'),
        '409': errorResponse('Email không khớp.'),
        '429': errorResponse('Vượt giới hạn gửi/thử mã.'),
        '503': errorResponse('Email chưa cấu hình hoặc gửi thất bại.'),
      },
    },
  },
  '/auth/otp/verify': {
    post: {
      tags: ['Auth'],
      operationId: 'verifyEmailOtp',
      summary: 'Xác minh OTP và đăng nhập/liên kết cùng User',
      description:
        'Cần cookie browser binding và CSRF. LINK_IDENTITY thêm Bearer JWT cho cùng User/phiên mới. Không tự merge email trùng.',
      parameters: [
        { name: 'x-csrf-token', in: 'header', required: true, schema: { type: 'string' } },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['challengeId', 'code'],
              properties: {
                challengeId: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
                code: { type: 'string', pattern: '^[0-9]{6}$' },
              },
            },
          },
        },
      },
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '200': response('JWT memory + refresh HttpOnly cookie.', {
          type: 'object',
          properties: {
            accessToken: { type: 'string' },
            user: {
              type: 'object',
              properties: { id: { type: 'string' }, displayName: { type: 'string' } },
            },
          },
        }),
        '401': errorResponse('OTP sai/hết hạn/đã dùng hoặc cần login mới.'),
        '403': errorResponse('Origin/CSRF hoặc User bị block.'),
        '409': errorResponse('Cần liên kết hoặc identity/alias conflict.'),
      },
    },
  },
};
