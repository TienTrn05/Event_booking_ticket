import { body, common, errors, pathId, result } from '../../../shared/openapi/feature-helpers.js';

const profileDate = { type: 'string', format: 'date' };
const identity = {
  type: 'object',
  additionalProperties: false,
  required: ['bookingItemId', 'fullName', 'dateOfBirth', 'phone', 'cccd'],
  properties: {
    bookingItemId: { type: 'string' },
    fullName: { type: 'string', minLength: 1, maxLength: 200 },
    dateOfBirth: profileDate,
    phone: {
      type: 'string',
      description: 'Chuẩn hóa E.164; SĐT này tự khai, không phải proof đăng nhập.',
    },
    cccd: {
      type: 'string',
      pattern: '^[0-9]{12}$',
      writeOnly: true,
      description: 'Số CCCD tự khai, mã hóa tại server; không log/trả lại số đầy đủ.',
    },
  },
};

export const attendeePaths = {
  '/bookings/{id}/attendees': {
    get: {
      ...common,
      tags: ['Attendees'],
      operationId: 'getBookingAttendees',
      summary: 'Người mua đọc thông tin mỗi vé của đơn mình; CCCD che số',
      parameters: [pathId()],
      responses: { ...errors, '200': result({ type: 'array', items: { type: 'object' } }) },
    },
    put: {
      ...common,
      tags: ['Attendees'],
      operationId: 'setBookingAttendees',
      summary: 'Khai một bộ thông tin riêng cho từng vé trước thanh toán',
      parameters: [pathId()],
      description:
        'Đúng toàn bộ bookingItemIds của booking AWAITING_PAYMENT chưa hết hạn. Kiểm tra tuổi từng người. Không tự tạo booking, thanh toán hoặc phát vé. CCCD mã hóa, chưa được xác minh; không nhận ảnh giấy tờ.',
      requestBody: body({
        type: 'object',
        additionalProperties: false,
        required: ['attendees'],
        properties: { attendees: { type: 'array', minItems: 1, maxItems: 6, items: identity } },
      }),
      responses: { ...errors, '200': result({ type: 'array', items: { type: 'object' } }) },
    },
  },
  '/tickets/{id}/attendee-verification': {
    post: {
      ...common,
      tags: ['Attendees'],
      operationId: 'verifyPhysicalAttendeeId',
      summary: 'Staff đúng tổ chức đối chiếu CCCD thật tại cửa',
      parameters: [pathId()],
      description:
        'ticket.checkin_own, phiên hợp lệ/membership/ownership; vé VALID, booking CONFIRMED và trong cửa sổ admission. Kiểm tra CCCD/họ tên/DOB và tuổi. Không đánh dấu vé USED hoặc thay quy trình check-in/admission.',
      requestBody: body({
        type: 'object',
        additionalProperties: false,
        required: ['cccd', 'fullName', 'dateOfBirth', 'physicalDocumentSeen'],
        properties: {
          cccd: { type: 'string', pattern: '^[0-9]{12}$', writeOnly: true },
          fullName: { type: 'string', minLength: 1, maxLength: 200 },
          dateOfBirth: profileDate,
          physicalDocumentSeen: { type: 'boolean', enum: [true] },
        },
      }),
      responses: {
        ...errors,
        '200': result({
          type: 'object',
          properties: { identityVerified: { type: 'boolean', enum: [true] } },
        }),
      },
    },
  },
};
