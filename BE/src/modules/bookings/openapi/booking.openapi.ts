type Schema = Record<string, unknown>;
const id: Schema = { type: 'string', pattern: '^[1-9][0-9]{0,18}$' };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: Schema) => ({ 'application/json': { schema } });
const result = (schema: Schema) => ({
  description: 'Kết quả trong scope hiện tại.',
  content: json({ type: 'object', properties: { data: schema, meta: ref('ResponseMeta') } }),
});
const errors = {
  '400': { description: 'Input/key không hợp lệ.' },
  '401': { description: 'Phiên hết hạn/không hợp lệ.' },
  '403': { description: 'Origin/quyền không hợp lệ.' },
  '404': { description: 'Không tồn tại hoặc ngoài scope.' },
  '409': { description: 'Ghế/hold/trạng thái/key xung đột.' },
  '415': { description: 'Body phải có Content-Type application/json.' },
  '429': { description: 'Rate limit/phòng chờ; xem Retry-After.' },
  '503': { description: 'Redis/phòng chờ tạm không khả dụng.' },
};
const bearer = [{ bearerAuth: [] }];
const param = (name: string, schema: Schema = id) => ({ name, in: 'path', required: true, schema });
const eventParams = [
  param('eventId', { type: 'string', description: 'Public ID của catalog, ví dụ fe1.' }),
  param('sessionId'),
];
const key = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: { type: 'string', minLength: 8, maxLength: 191, pattern: '^[A-Za-z0-9._:-]+$' },
  description: 'Một key cho một thao tác. Khi retry giữ nguyên key và payload; retention 24 giờ.',
};
const body = (schema: Schema) => ({ required: true, content: json(schema) });
const holdItem = {
  type: 'object',
  properties: { sessionSeatId: id, priceMinor: { type: 'string' }, currency: { type: 'string' } },
};
export const bookingSchemas = {
  SeatHold: {
    type: 'object',
    properties: {
      id,
      sessionId: id,
      status: { type: 'string', enum: ['ACTIVE', 'CONVERTED', 'RELEASED', 'EXPIRED'] },
      expiresAt: { type: 'string', format: 'date-time' },
      expired: { type: 'boolean' },
      items: { type: 'array', items: holdItem },
    },
  },
  Booking: {
    type: 'object',
    properties: {
      id,
      eventId: id,
      sessionId: id,
      holdId: id,
      status: {
        type: 'string',
        enum: ['AWAITING_PAYMENT', 'CONFIRMED', 'EXPIRED', 'CANCELLED', 'REFUNDED'],
      },
      totalMinor: { type: 'string' },
      currency: { type: 'string' },
      expiresAt: { type: 'string', format: 'date-time' },
      expired: { type: 'boolean' },
      confirmedAt: { type: 'string', format: 'date-time', nullable: true },
      items: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id,
            sessionSeatId: id,
            priceMinor: { type: 'string' },
            currency: { type: 'string' },
            attendeeName: { type: 'string' },
            seatLabel: { type: 'string' },
            ticketTypeName: { type: 'string' },
          },
        },
      },
    },
  },
  WaitingRoom: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['NOT_JOINED', 'WAITING', 'ADMITTED', 'PAUSED', 'SOLD_OUT', 'CLOSED', 'LEFT'],
      },
      position: { type: 'integer', nullable: true },
      admissionExpiresAt: { type: 'string', format: 'date-time', nullable: true },
      waiting: { type: 'integer' },
      active: { type: 'integer' },
      serverTime: { type: 'string', format: 'date-time' },
      pollAfterSeconds: { type: 'integer', example: 30 },
    },
  },
};
export const bookingPaths = {
  '/events/{eventId}/sessions': {
    get: {
      tags: ['Booking'],
      operationId: 'getPublicSessions',
      summary: 'Danh sách suất công khai.',
      parameters: [eventParams[0]],
      responses: {
        '200': result({
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id,
              startsAt: { type: 'string', format: 'date-time' },
              endsAt: { type: 'string', format: 'date-time' },
              timezone: { type: 'string' },
              saleOpensAt: { type: 'string', format: 'date-time' },
              saleClosesAt: { type: 'string', format: 'date-time' },
              status: { type: 'string' },
              saleOpen: { type: 'boolean' },
            },
          },
        }),
        ...errors,
      },
    },
  },
  '/events/{eventId}/sessions/{sessionId}/seats': {
    get: {
      tags: ['Booking'],
      operationId: 'getSessionSeats',
      summary: 'Snapshot ghế/giá; không lộ người giữ.',
      parameters: eventParams,
      responses: {
        '200': result({
          type: 'object',
          properties: {
            sessionId: id,
            serverTime: { type: 'string', format: 'date-time' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id,
                  priceMinor: { type: 'string' },
                  currency: { type: 'string' },
                  label: { type: 'string' },
                  x: { type: 'string' },
                  y: { type: 'string' },
                  ticketTypeCode: { type: 'string' },
                  ticketTypeName: { type: 'string' },
                  availability: { type: 'string', enum: ['AVAILABLE', 'HELD', 'SOLD'] },
                },
              },
            },
          },
        }),
        ...errors,
      },
    },
  },
  '/events/{eventId}/sessions/{sessionId}/waiting-room': {
    post: {
      tags: ['Waiting room'],
      operationId: 'joinWaitingRoom',
      summary: 'Vào FIFO, một vị trí/tài khoản/suất.',
      security: bearer,
      parameters: eventParams,
      requestBody: body({ type: 'object', additionalProperties: false, example: {} }),
      responses: { '200': result(ref('WaitingRoom')), ...errors },
    },
    get: {
      tags: ['Waiting room'],
      operationId: 'getWaitingRoom',
      summary: 'Xem lượt; polling sau ít nhất 30 giây, thêm jitter 0–10 giây ở client.',
      security: bearer,
      parameters: eventParams,
      responses: { '200': result(ref('WaitingRoom')), ...errors },
    },
    delete: {
      tags: ['Waiting room'],
      operationId: 'leaveWaitingRoom',
      summary: 'Rời phòng chờ/lượt mua, không hủy hold hoặc booking.',
      security: bearer,
      parameters: eventParams,
      responses: { '200': result(ref('WaitingRoom')), ...errors },
    },
  },
  '/events/{eventId}/sessions/{sessionId}/seats/hold': {
    post: {
      tags: ['Booking'],
      operationId: 'holdSeats',
      summary: 'Giữ nguyên tử 1–6 ghế trong 5 phút, cần lượt ADMITTED.',
      security: bearer,
      parameters: [...eventParams, key],
      requestBody: body({
        type: 'object',
        required: ['seatIds'],
        additionalProperties: false,
        properties: {
          seatIds: { type: 'array', minItems: 1, maxItems: 6, uniqueItems: true, items: id },
        },
      }),
      responses: { '201': result(ref('SeatHold')), ...errors },
    },
  },
  '/holds/{holdId}': {
    get: {
      tags: ['Booking'],
      operationId: 'getMyHold',
      summary: 'Đọc hold của người mua, trả trạng thái hiện tại và expired.',
      security: bearer,
      parameters: [param('holdId')],
      responses: { '200': result(ref('SeatHold')), ...errors },
    },
    delete: {
      tags: ['Booking'],
      operationId: 'releaseMyHold',
      summary: 'Nhả hold chưa chuyển thành booking.',
      security: bearer,
      parameters: [param('holdId'), key],
      responses: { '204': { description: 'Đã nhả hoặc đã kết thúc.' }, ...errors },
    },
  },
  '/bookings': {
    post: {
      tags: ['Booking'],
      operationId: 'createBookingFromHold',
      summary: 'Tạo đơn AWAITING_PAYMENT, không gia hạn hold, chưa thanh toán/phát vé.',
      security: bearer,
      parameters: [key],
      requestBody: body({
        type: 'object',
        required: ['holdId', 'attendees'],
        additionalProperties: false,
        properties: {
          holdId: id,
          attendees: {
            type: 'array',
            minItems: 1,
            maxItems: 6,
            items: {
              type: 'object',
              required: ['sessionSeatId', 'attendeeName'],
              additionalProperties: false,
              properties: {
                sessionSeatId: id,
                attendeeName: { type: 'string', minLength: 1, maxLength: 200 },
              },
            },
          },
        },
      }),
      responses: { '201': result(ref('Booking')), '200': result(ref('Booking')), ...errors },
    },
    get: {
      tags: ['Booking'],
      operationId: 'getMyBookings',
      summary: 'Danh sách đơn của mình.',
      security: bearer,
      parameters: [
        {
          name: 'page',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100000, default: 1 },
        },
        {
          name: 'pageSize',
          in: 'query',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
      ],
      responses: { '200': result({ type: 'array', items: ref('Booking') }), ...errors },
    },
  },
  '/bookings/{bookingId}': {
    get: {
      tags: ['Booking'],
      operationId: 'getMyBooking',
      summary: 'Chi tiết đơn của mình; không tự cấp quyền Admin hỗ trợ.',
      security: bearer,
      parameters: [param('bookingId')],
      responses: { '200': result(ref('Booking')), ...errors },
    },
  },
  '/bookings/{bookingId}/cancel': {
    post: {
      tags: ['Booking'],
      operationId: 'cancelMyBooking',
      summary: 'Hủy đơn chưa xác nhận và nhả ghế; không thay luồng refund.',
      security: bearer,
      parameters: [param('bookingId'), key],
      requestBody: body({
        type: 'object',
        required: ['reason'],
        additionalProperties: false,
        properties: { reason: { type: 'string', minLength: 1, maxLength: 2000 } },
      }),
      responses: { '200': result(ref('Booking')), ...errors },
    },
  },
};
