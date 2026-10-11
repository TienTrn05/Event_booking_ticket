type Schema = Record<string, unknown>;
const text: Schema = { type: 'string' };
const id: Schema = { type: 'string', pattern: '^[1-9][0-9]*$' };
const bearer = [{ bearerAuth: [] }];
const json = (schema: Schema) => ({ 'application/json': { schema } });
const result = (schema: Schema) => ({
  description: 'Kết quả trong phạm vi tài khoản hiện tại.',
  content: json({ type: 'object', properties: { data: schema } }),
});
const param = (name: string) => ({ name, in: 'path', required: true, schema: id });
const key = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  schema: { type: 'string', minLength: 8, maxLength: 191 },
  description: 'Giữ nguyên key và payload khi retry; giữ 24 giờ.',
};
const origin = {
  name: 'Origin',
  in: 'header',
  required: true,
  schema: text,
  description: 'Origin website đã cấu hình; browser tự gửi.',
};
const body = (schema: Schema) => ({ required: true, content: json(schema) });
const errors = {
  '400': { description: 'Input/key/chữ ký không hợp lệ.' },
  '401': { description: 'Cần phiên hợp lệ.' },
  '403': { description: 'Origin/quyền công ty/tổ chức không hợp lệ.' },
  '404': { description: 'Không tồn tại hoặc ngoài phạm vi.' },
  '409': { description: 'Đơn/vé/cửa đã đóng hoặc key xung đột.' },
  '422': { description: 'Thiếu thông tin, không đủ tuổi hoặc giấy tờ không khớp.' },
  '429': { description: 'Quá nhiều yêu cầu.' },
  '503': { description: 'Thanh toán tạm không khả dụng.' },
};
const ticketCode = { type: 'string', pattern: '^EVX-[A-F0-9]{32}$' };
const checkIn = {
  type: 'object',
  additionalProperties: false,
  required: ['ticketCode', 'attendeeName'],
  properties: { ticketCode, attendeeName: { type: 'string', minLength: 1, maxLength: 200 } },
};
const payment: Schema = {
  type: 'object',
  properties: {
    id,
    bookingId: id,
    provider: { type: 'string', enum: ['PAYOS'] },
    status: { type: 'string', enum: ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] },
    amountMinor: text,
    receivedMinor: text,
    currency: { type: 'string', enum: ['VND'] },
    checkoutUrl: { type: 'string', nullable: true },
    reconciliationStatus: text,
    reconciliationReason: { type: 'string', nullable: true },
  },
};
const ticket: Schema = {
  type: 'object',
  properties: {
    id,
    bookingId: id,
    sessionId: id,
    eventId: text,
    title: text,
    status: text,
    attendeeName: text,
    seatLabel: text,
    startsAt: { type: 'string', format: 'date-time' },
    timezone: text,
    checkedInAt: { type: 'string', format: 'date-time', nullable: true },
    admittedAt: { type: 'string', format: 'date-time', nullable: true },
    onlineCheckInOpen: { type: 'boolean' },
    ticketCode: {
      ...ticketCode,
      nullable: true,
      description: 'Chỉ chủ vé đang VALID nhận được mã; không lưu trong URL/log/storage.',
    },
  },
};
const get = (operationId: string, summary: string, schema: Schema, parameters: unknown[] = []) => ({
  tags: ['Tickets'],
  operationId,
  summary,
  security: bearer,
  parameters,
  responses: { '200': result(schema), ...errors },
});
const mutation = (operationId: string, summary: string, input: Schema, parameters: unknown[]) => ({
  tags: ['Tickets'],
  operationId,
  summary,
  security: bearer,
  parameters: [...parameters, origin, key],
  requestBody: body(input),
  responses: { '200': result({ type: 'object' }), ...errors },
});
export const paymentPaths = {
  '/bookings/{bookingId}/payments': {
    post: {
      tags: ['Payment'],
      operationId: 'createPayosPayment',
      summary: 'Kiểm tra từng attendee và chuẩn bị link payOS; không gia hạn hold.',
      security: bearer,
      parameters: [param('bookingId'), origin, key],
      requestBody: body({ type: 'object', additionalProperties: false }),
      responses: { '201': result(payment), ...errors },
    },
  },
  '/payments/{paymentId}': {
    get: {
      ...get('getOwnPayment', 'Kết quả thanh toán do BE xác minh.', payment, [param('paymentId')]),
      tags: ['Payment'],
    },
  },
  '/payments/webhooks/payos': {
    post: {
      tags: ['Payment'],
      operationId: 'receivePayosWebhook',
      summary:
        'Webhook payOS có chữ ký. Callback trùng không phát lại vé; tiền muộn được đối soát.',
      security: [],
      requestBody: body({
        type: 'object',
        required: ['code', 'desc', 'success', 'data', 'signature'],
        properties: {
          code: text,
          desc: text,
          success: { type: 'boolean' },
          data: { type: 'object', additionalProperties: true },
          signature: { type: 'string', pattern: '^[a-fA-F0-9]{64}$' },
        },
      }),
      responses: {
        '200': {
          description: 'Đã lưu bền vững và xử lý hoặc bỏ qua callback trùng/probe không có đơn.',
        },
        '400': errors['400'],
        '429': errors['429'],
        '503': errors['503'],
      },
    },
  },
};
export const ticketPaths = {
  '/users/me/tickets': {
    get: get('listOwnTickets', 'Vé của chính Customer.', { type: 'array', items: ticket }),
  },
  '/bookings/{bookingId}/tickets': {
    get: get(
      'listOwnBookingTickets',
      'Vé thuộc đơn của chính Customer.',
      { type: 'array', items: ticket },
      [param('bookingId')],
    ),
  },
  '/tickets/{ticketId}': {
    get: get('getOwnTicket', 'Chi tiết vé của chính Customer.', ticket, [param('ticketId')]),
  },
  '/organizer/ticket-sessions': {
    get: get(
      'listStaffTicketSessions',
      'Suất thuộc tổ chức của nhân viên có phiên công ty và ticket.checkin_own.',
      {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id,
            title: text,
            eventId: text,
            startsAt: { type: 'string', format: 'date-time' },
            timezone: text,
          },
        },
      },
    ),
  },
  '/sessions/{sessionId}/ticket-lookup': {
    post: {
      ...mutation(
        'lookupStaffTicket',
        'Tra QR trong đúng suất và tổ chức; không trả CCCD/ngày sinh.',
        {
          type: 'object',
          additionalProperties: false,
          required: ['ticketCode'],
          properties: { ticketCode },
        },
        [param('sessionId')],
      ),
      parameters: [param('sessionId'), origin],
    },
  },
  '/tickets/{ticketId}/check-in': {
    post: mutation(
      'onlineTicketCheckIn',
      'Chủ vé check-in trước suất 24 giờ; vé vẫn VALID.',
      checkIn,
      [param('ticketId')],
    ),
  },
  '/sessions/{sessionId}/check-ins': {
    post: mutation(
      'counterTicketCheckIn',
      'Nhân viên check-in tại quầy trong thời gian cấu hình; vé vẫn VALID.',
      checkIn,
      [param('sessionId')],
    ),
  },
  '/sessions/{sessionId}/admissions': {
    post: mutation(
      'admitTicket',
      'Đối chiếu CCCD thật và sử dụng vé một lần trong cửa sổ vào cửa.',
      {
        type: 'object',
        additionalProperties: false,
        required: ['ticketCode', 'cccd', 'fullName', 'dateOfBirth', 'physicalDocumentSeen'],
        properties: {
          ticketCode,
          cccd: { type: 'string', pattern: '^[0-9]{12}$' },
          fullName: { type: 'string', minLength: 1, maxLength: 200 },
          dateOfBirth: { type: 'string', format: 'date' },
          physicalDocumentSeen: { type: 'boolean', enum: [true] },
        },
      },
      [param('sessionId')],
    ),
  },
};
