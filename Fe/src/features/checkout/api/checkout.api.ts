import { z } from 'zod';
import { apiRequest, ApiError } from '../../../shared/api/client';
const id = z.string(),
  nullable = z.string().nullable();
const minor = z.string().regex(/^\d+$/);
export const sessionSchema = z.object({
  id,
  startsAt: id,
  endsAt: id,
  timezone: id,
  saleOpen: z.boolean(),
});
export const seatSchema = z.object({
  id,
  label: id,
  priceMinor: minor,
  currency: id,
  ticketTypeName: id,
  availability: z.enum(['AVAILABLE', 'HELD', 'SOLD', 'BLOCKED']),
});
const rectangleSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
});
export const zoneInventorySchema = z.object({
  sessionId: id,
  serverTime: id,
  layout: z.object({
    width: z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)]).transform(Number),
    height: z.union([z.number(), z.string().regex(/^\d+(?:\.\d+)?$/)]).transform(Number),
    geometry: z.object({
      stage: rectangleSchema.nullish(),
      blocked: z.array(rectangleSchema).optional(),
    }),
  }),
  items: z.array(
    z.object({
      sectionId: id,
      code: id,
      name: id,
      capacity: z.number().int().positive(),
      geometry: rectangleSchema,
      ticketTypeName: id,
      priceMinor: minor,
      currency: id,
      available: z.number().int().nonnegative(),
      sold: z.number().int().nonnegative(),
    }),
  ),
});
export const roomSchema = z.object({
  status: z.enum(['NOT_JOINED', 'WAITING', 'ADMITTED', 'PAUSED', 'SOLD_OUT', 'CLOSED', 'LEFT']),
  position: z.number().nullable(),
  admissionExpiresAt: nullable,
  pollAfterSeconds: z.number(),
});
export const holdSchema = z.object({
  id,
  sessionId: id,
  status: id,
  expiresAt: id,
  expired: z.boolean(),
  items: z.array(
    z.object({
      sessionSeatId: id,
      sectionId: id.optional(),
      zoneName: nullable.optional(),
      priceMinor: minor,
      currency: id,
    }),
  ),
});
export const bookingSchema = z.object({
  id,
  sessionId: id,
  holdId: id,
  status: id,
  totalMinor: minor,
  currency: id,
  expiresAt: id,
  expired: z.boolean(),
  paymentId: nullable.optional(),
  items: z.array(
    z.object({
      id,
      sessionSeatId: id,
      attendeeName: id,
      seatLabel: id,
      priceMinor: minor,
      currency: id,
    }),
  ),
});
export const paymentSchema = z.object({
  id,
  bookingId: id,
  status: id,
  amountMinor: minor,
  receivedMinor: minor,
  currency: id,
  checkoutUrl: nullable,
  reconciliationStatus: id,
  reconciliationReason: nullable,
  outcome: z.enum(['SUCCESS', 'FAILED']).nullable(),
  canRetry: z.boolean(),
  expiresAt: id,
});
export const attendeeSchema = z.object({
  bookingItemId: id,
  fullName: nullable,
  dateOfBirth: nullable,
  phone: nullable,
  maskedCccd: nullable,
});
export type Session = z.infer<typeof sessionSchema>;
export type Seat = z.infer<typeof seatSchema>;
export type Room = z.infer<typeof roomSchema>;
export type ZoneInventory = z.infer<typeof zoneInventorySchema>;
export type Booking = z.infer<typeof bookingSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type AttendeeForm = {
  bookingItemId: string;
  fullName: string;
  dateOfBirth: string;
  phone: string;
  cccd: string;
  maskedCccd?: string | null | undefined;
};
export async function checkoutRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  token?: string | null,
  method = 'GET',
  body?: unknown,
  key?: string,
  signal?: AbortSignal,
) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;
  const raw = await apiRequest(path, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
  if (raw === undefined) return schema.parse(undefined);
  return z.object({ data: schema }).parse(raw).data;
}
export function stableKey(userId: string, operation: string, target: string) {
  const name = `eventix.mutation.${userId}.${operation}.${target}`;
  try {
    const raw = sessionStorage.getItem(name);
    if (raw) {
      const item = JSON.parse(raw) as { key: string; expires: number };
      if (item.expires > Date.now() && /^[a-f0-9-]{36}$/i.test(item.key)) return item.key;
    }
  } catch {
    /* a blocked storage API does not block the in-memory operation */
  }
  const key = crypto.randomUUID();
  try {
    sessionStorage.setItem(name, JSON.stringify({ key, expires: Date.now() + 86400000 }));
  } catch {
    /* caller keeps the key for retries */
  }
  return key;
}
export function clearMutationKeys() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i);
      if (key?.startsWith('eventix.mutation.')) sessionStorage.removeItem(key);
    }
  } catch {
    /* optional storage */
  }
}
export function checkoutError(error: unknown, locale: 'vi' | 'en' = 'vi') {
  if (error instanceof ApiError) {
    if (locale === 'en') {
      const messages: Record<string, string> = {
        UNAUTHENTICATED: 'Your session expired. Please sign in again.',
        FORBIDDEN: 'Your account does not have permission to perform this action.',
        SEAT_UNAVAILABLE: 'A selected seat is no longer available. Please update your selection.',
        ZONE_UNAVAILABLE:
          'The selected zone no longer has enough tickets. Please update your quantities.',
        TICKETING_MODE_CONFLICT: 'The ticket selection mode is not valid. Please reload the event.',
        ACTIVE_ALLOCATION_EXISTS:
          'You already have a reservation or an unfinished booking for this session.',
        HOLD_EXPIRED: 'Your reservation expired. Please select your tickets again.',
        BOOKING_NOT_PAYABLE: 'This booking expired or cannot be paid.',
        ATTENDEE_TOO_YOUNG: 'An attendee does not meet the age requirement.',
        ATTENDEE_CREDENTIALS_REQUIRED:
          'Complete the required attendee details for every ticket before paying.',
        ATTENDEE_IDENTITY_MISMATCH: 'The identity document does not match this ticket.',
        ATTENDEES_LOCKED: 'Attendee details are locked while payment is being processed.',
        TICKET_NOT_VALID: 'This ticket was already used or is no longer valid.',
        CHECK_IN_CLOSED: 'Check-in is not open at this time.',
        ADMISSION_CLOSED: 'Admission is not open at this time.',
        CHECK_IN_REQUIRED: 'Online or counter check-in is required before admission.',
        RATE_LIMITED: 'Too many requests. Please wait and try again.',
        WAITING_ROOM_REQUIRED:
          'Your admission to ticket sales expired. Please rejoin the waiting room.',
        SALE_CLOSED: 'Ticket sales have not opened or have closed.',
        PAYMENT_UNAVAILABLE: 'Payment is temporarily unavailable.',
        ADMISSION_UNAVAILABLE: 'The waiting room is temporarily unavailable.',
        PAYMENT_CONFIRMATION_REQUIRED:
          'We are confirming a payment already received. Please do not pay again.',
        ORDER_NOT_PAYABLE: 'This order has expired or can no longer be paid.',
        STOCK_UNAVAILABLE: 'The selected product no longer has enough stock.',
      };
      return (
        messages[error.code ?? ''] ??
        'The action could not be completed. Retry the same request if the result is uncertain.'
      );
    }
    const messages: Record<string, string> = {
      UNAUTHENTICATED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
      FORBIDDEN: 'Tài khoản chưa có quyền thực hiện thao tác này.',
      SEAT_UNAVAILABLE: 'Ghế vừa được người khác giữ. Vui lòng chọn ghế khác.',
      ZONE_UNAVAILABLE: 'Khu đã chọn không còn đủ vé. Vui lòng cập nhật lại số lượng.',
      TICKETING_MODE_CONFLICT: 'Hình thức chọn vé không còn phù hợp. Vui lòng tải lại sự kiện.',
      PAYMENT_CONFIRMATION_REQUIRED:
        'Hệ thống đang xác nhận khoản tiền đã nhận. Vui lòng không thanh toán thêm.',
      ACTIVE_ALLOCATION_EXISTS: 'Bạn đang có lượt giữ ghế hoặc đơn chưa kết thúc cho suất này.',
      HOLD_EXPIRED: 'Giữ chỗ đã hết hạn. Vui lòng chọn ghế lại.',
      BOOKING_NOT_PAYABLE: 'Đơn đã hết hạn hoặc không còn được thanh toán.',
      ATTENDEE_TOO_YOUNG: 'Có người tham dự chưa đủ tuổi.',
      ATTENDEE_CREDENTIALS_REQUIRED: 'Cần đủ thông tin hợp lệ cho từng vé trước khi thanh toán.',
      ATTENDEE_IDENTITY_MISMATCH: 'Thông tin trên giấy tờ không khớp vé.',
      ATTENDEES_LOCKED: 'Thanh toán đang xử lý; thông tin người tham dự đã được khóa.',
      TICKET_NOT_VALID: 'Vé đã sử dụng hoặc không còn hiệu lực.',
      CHECK_IN_CLOSED: 'Chưa đến hoặc đã hết thời gian check-in.',
      ADMISSION_CLOSED: 'Chưa đến hoặc đã hết thời gian vào cửa.',
      CHECK_IN_REQUIRED: 'Cần check-in online hoặc tại quầy trước khi vào cửa.',
      RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng đợi rồi thử lại.',
      WAITING_ROOM_REQUIRED: 'Lượt vào mua đã hết hạn. Vui lòng vào phòng chờ lại.',
      SALE_CLOSED: 'Suất diễn chưa mở hoặc đã đóng bán.',
      PAYMENT_UNAVAILABLE: 'Thanh toán tạm thời chưa sẵn sàng.',
      ADMISSION_UNAVAILABLE: 'Phòng chờ tạm thời không khả dụng.',
      ORDER_NOT_PAYABLE: 'Đơn sản phẩm đã hết hạn hoặc không còn được thanh toán.',
      STOCK_UNAVAILABLE: 'Sản phẩm không còn đủ số lượng đã chọn.',
    };
    return (
      messages[error.code ?? ''] ??
      'Không thể hoàn tất thao tác. Hãy thử lại; giữ nguyên đơn hiện tại nếu thanh toán đang xử lý.'
    );
  }
  return locale === 'en'
    ? 'The connection was interrupted. Please retry the same request.'
    : 'Kết nối bị gián đoạn. Vui lòng thử lại với yêu cầu hiện tại.';
}
