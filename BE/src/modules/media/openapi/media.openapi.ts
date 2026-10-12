import { errorResponse, response } from '../../../shared/openapi/helpers.js';
export const mediaPaths = {
  '/media/config': {
    get: {
      tags: ['Media'],
      operationId: 'getMediaConfig',
      summary: 'Trạng thái cấu hình R2',
      responses: {
        '200': response('Cấu hình public.', {
          type: 'object',
          properties: { enabled: { type: 'boolean' } },
        }),
      },
    },
  },
  '/media/avatar': {
    get: {
      tags: ['Media'],
      operationId: 'getOwnAvatar',
      summary: 'Ảnh đại diện của người đăng nhập',
      security: [{ bearerAuth: [] }],
      responses: {
        '200': response('Ảnh đại diện.', {
          type: 'object',
          properties: { avatarUrl: { type: 'string', format: 'uri', nullable: true } },
        }),
        '401': errorResponse('Phiên không hợp lệ.'),
      },
    },
  },
  '/media/uploads': {
    post: {
      tags: ['Media'],
      operationId: 'createImageUpload',
      summary: 'Cấp presigned PUT URL, hiệu lực 5 phút',
      security: [{ bearerAuth: [] }],
      description:
        'Origin phải khớp PUBLIC_APP_URL. Avatar cần profile.update_self. Event/merchandise cần event.update_own, membership PENDING/ACTIVE, Organization PENDING_REVIEW/APPROVED/REJECTED, phiên identity hợp lệ và event/product DRAFT. version là version của event. Client gửi File trực tiếp tới uploadUrl, với headers trả về; không gửi Authorization/cookie ứng dụng tới R2.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              oneOf: [
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['purpose', 'contentType', 'size'],
                  properties: {
                    purpose: { type: 'string', enum: ['avatar'] },
                    contentType: {
                      type: 'string',
                      enum: ['image/jpeg', 'image/png', 'image/webp'],
                    },
                    size: { type: 'integer', minimum: 12, maximum: 5242880 },
                  },
                },
                {
                  type: 'object',
                  additionalProperties: false,
                  required: ['purpose', 'targetId', 'version', 'contentType', 'size'],
                  properties: {
                    purpose: { type: 'string', enum: ['event', 'merchandise'] },
                    targetId: { type: 'string', pattern: '^[1-9][0-9]*$' },
                    version: { type: 'integer', minimum: 0, maximum: 2147483647 },
                    contentType: {
                      type: 'string',
                      enum: ['image/jpeg', 'image/png', 'image/webp'],
                    },
                    size: { type: 'integer', minimum: 12, maximum: 5242880 },
                  },
                },
              ],
            },
          },
        },
      },
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '200': response('URL và receipt upload (không lưu/log).', {
          type: 'object',
          required: ['uploadUrl', 'method', 'headers', 'uploadToken', 'expiresIn'],
          properties: {
            uploadUrl: { type: 'string', format: 'uri' },
            method: { type: 'string', enum: ['PUT'] },
            headers: {
              type: 'object',
              properties: {
                'Content-Type': { type: 'string' },
                'If-None-Match': { type: 'string', enum: ['*'] },
              },
            },
            uploadToken: { type: 'string' },
            expiresIn: { type: 'integer', enum: [300] },
          },
        }),
        '400': errorResponse('Input không hợp lệ.'),
        '401': errorResponse('Cần đăng nhập.'),
        '403': errorResponse('Origin hoặc permission không hợp lệ.'),
        '404': errorResponse('Ngoài phạm vi sở hữu.'),
        '409': errorResponse('Event/product không ở DRAFT hoặc version sai.'),
        '429': errorResponse('Vượt giới hạn upload.'),
        '503': errorResponse('R2 chưa cấu hình.'),
      },
    },
  },
  '/media/uploads/complete': {
    post: {
      tags: ['Media'],
      operationId: 'completeImageUpload',
      summary: 'Xác minh ảnh trên R2 rồi lưu URL vào DB',
      security: [{ bearerAuth: [] }],
      description:
        'Receipt ràng buộc User/session/purpose/target/size/type, hiệu lực 5 phút để hoàn tất upload. Kiểm tra HEAD và 12 byte đầu, recheck quyền/ownership/version trong transaction. Chỉ lưu URL; không nhận URL/key do client tự chọn. If-None-Match ký bảo vệ ảnh đã chấp nhận khỏi ghi đè bằng URL upload cũ.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['uploadToken'],
              properties: { uploadToken: { type: 'string', maxLength: 4096 } },
            },
          },
        },
      },
      responses: {
        '415': errorResponse('Body requires Content-Type application/json.'),
        '200': response('Ảnh đã lưu.', {
          type: 'object',
          properties: {
            imageUrl: { type: 'string', format: 'uri' },
            version: { type: 'integer' },
          },
        }),
        '400': errorResponse('Receipt hoặc ảnh không hợp lệ.'),
        '401': errorResponse('Phiên hết hạn.'),
        '403': errorResponse('Thiếu quyền.'),
        '404': errorResponse('Ngoài scope User/session/target.'),
        '409': errorResponse('Upload chưa sẵn sàng hoặc version đã thay đổi.'),
        '429': errorResponse('Vượt giới hạn upload.'),
      },
    },
  },
};
