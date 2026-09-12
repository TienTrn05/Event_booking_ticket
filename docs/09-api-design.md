# 09. Thiết kế REST API

## Quy ước chung

Prefix `/api/v1`; JSON UTF-8; HTTPS ở staging/production. ID và tiền là chuỗi; timestamp ISO 8601 UTC dạng `2026-10-01T12:00:00Z`. `Content-Type: application/json`; giới hạn body và page size; không chấp nhận trường ngoài schema ở mutation. Không gửi body trong GET. PATCH chỉ chấp nhận allowlist, có `version` cho sửa nội dung để trả 409 khi xung đột.

Envelope thành công (ngoại trừ 204 không có body):

```json
{
  "data": { "id": "120", "status": "AWAITING_PAYMENT", "totalMinor": "500000", "currency": "VND" },
  "meta": { "requestId": "req-example" }
}
```

Currency và giá ví dụ không chốt chính sách Q-003. Lỗi:

```json
{
  "error": {
    "code": "SEAT_UNAVAILABLE",
    "message": "Một hoặc nhiều ghế không còn khả dụng.",
    "details": [{ "field": "seatIds", "code": "CONFLICT" }]
  },
  "meta": { "requestId": "req-example" }
}
```

`details` chỉ chứa dữ liệu an toàn, không lộ chủ hold, SQL, token hoặc stack trace. Client xử lý bằng code ổn định, không parse câu tiếng Việt.

## Endpoint đề xuất

Các đường dẫn sau đều có prefix `/api/v1`. “Chủ” luôn kiểm tra ở service. Các thao tác gắn Q trong đặc tả nghiệp vụ chỉ triển khai sau khi chốt.

| Method / path | Quyền | Input → output; HTTP |
| --- | --- | --- |
| POST `/auth/register` | Guest | email, password, displayName → thông báo chung; 202 |
| POST `/auth/login` | Guest | email, password → accessToken, expiresIn, user + cookie; 200 |
| POST `/auth/refresh` | Cookie + CSRF | không body → accessToken mới + cookie; 200 |
| POST `/auth/logout` | Phiên/cookie + CSRF | thu hồi, xóa cookie; 204 idempotent |
| POST `/auth/logout-all` | Đã xác thực | thu hồi mọi phiên; 204 |
| POST `/auth/forgot-password` | Guest, rate limit | email → thông báo chung; 202 |
| POST `/auth/reset-password` | Reset token | token, newPassword → 204 |
| POST `/auth/verify-email` | Verify token | token → 204 |
| POST `/auth/resend-verification` | Guest, rate limit | email → 202 chung |
| GET `/auth/csrf` | Origin hợp lệ | CSRF token gắn ngữ cảnh trình duyệt; 200, no-store |
| GET `/auth/sessions` | Chủ | danh sách thiết bị đã che thông tin; 200 |
| DELETE `/auth/sessions/:sessionId` | Chủ | thu hồi thiết bị; 204 |
| GET/PATCH `/users/me` | Đã xác thực | profile / displayName allowlist; 200 |
| POST `/users/me/change-password` | Đã xác thực | currentPassword, newPassword → 204 |
| GET `/event-categories` | Công khai | danh mục hoạt động; 200 |
| POST `/admin/event-categories` | category.manage | name,slug → danh mục theo Q-005; 201 |
| PATCH `/admin/event-categories/:categoryId` | category.manage | name,slug,isActive → danh mục; 200 |
| GET `/events` | Công khai | bộ lọc bên dưới → danh sách; 200 |
| GET `/events/:eventId` | Công khai | Chỉ DTO sự kiện công khai; bản nháp dùng management endpoint riêng; 200 |
| POST `/events` | event.create | title, categoryId, description → nháp; 201 |
| PATCH/DELETE `/events/:eventId` | Chủ | trường cho phép + version / xóa nháp rỗng; 200/204 |
| POST `/events/:eventId/publish` | Chủ | version → event; 200 |
| POST `/events/:eventId/cancel` | Chủ, policy | reason → trạng thái và job xử lý; 202 |
| GET `/organizer/events` | Organizer | danh sách sở hữu gồm nháp; 200 |
| GET `/organizer/events/:eventId` | Chủ | chi tiết quản lý; 200 |
| GET/POST `/venues` | Organizer | danh sách thuộc quyền / name,address,city,timezone; 200/201 |
| PATCH `/venues/:venueId` | Chủ | trường cho phép, version; 200 |
| POST `/venues/:venueId/sections` | Chủ | code,name → section; 201 |
| POST `/venues/:venueId/sections/:sectionId/rows` | Chủ | code → row; 201 |
| POST `/venues/:venueId/rows/:rowId/seats` | Chủ | batch number,mapX,mapY → seats; 201 |
| GET `/venues/:venueId/seat-map` | Chủ | layout quản lý; 200; khách dùng session seats công khai |
| PUT `/venues/:venueId/seat-map` | Chủ | toàn bộ section/row/seat + version, chỉ khi chưa có session tham chiếu; thay nguyên tử; 200 |
| GET/POST `/events/:eventId/sessions` | Công khai / Chủ | suất công khai / venueId,lịch,cửa sổ bán; 200/201 |
| PATCH `/events/:eventId/sessions/:sessionId` | Chủ | thay đổi cho phép trước bán; 200 |
| PUT `/events/:eventId/sessions/:sessionId/seat-prices` | Chủ | batch sessionSeatId,priceMinor,currency; 200 |
| GET `/events/:eventId/sessions/:sessionId/seats` | Công khai | snapshot ghế/giá, serverTime; 200 |
| POST `/events/:eventId/sessions/:sessionId/seats/hold` | Customer | seatIds + Idempotency-Key → hold,items,expiresAt; 201 |
| GET/DELETE `/holds/:holdId` | Chủ | hold / nhả trước chuyển booking; 200/204 |
| POST `/bookings` | Customer | holdId + Idempotency-Key → booking; 201 |
| GET `/bookings` | Chủ | đơn của mình, phân trang; 200 |
| GET `/bookings/:bookingId` | Chủ/hỗ trợ có audit | chi tiết, payment summary; 200 |
| POST `/bookings/:bookingId/cancel` | Chủ | reason + key → booking; 200 |
| POST `/bookings/:bookingId/payments` | Chủ | key, adapter được server chọn → payment attempt; 201 |
| GET `/payments/:paymentId` | Chủ booking | trạng thái và reconciliation; 200 |
| POST `/payments/webhooks/:provider` | Xác thực provider | payload riêng/raw body → ack; 200 hoặc 202 sau ghi bền vững |
| POST `/internal/mock-payments/:paymentId/outcome` | Chỉ test/dev có bảo vệ | SUCCESS/FAILED + key → kết quả mô phỏng; 200 |
| GET `/bookings/:bookingId/tickets` | Chủ | danh sách vé/QR, no-store; 200 |
| GET `/tickets/:ticketId` | Chủ | vé, no-store; 200 |
| POST `/sessions/:sessionId/check-ins` | ticket.checkin_own | qrToken + key → checkedInAt; 200 |
| POST `/bookings/:bookingId/refunds` | Chủ, policy | reason + key → refund REQUESTED; 201 |
| GET `/refunds/:refundId` | Chủ/Admin được cấp | trạng thái; 200 |
| POST `/admin/refunds/:refundId/approve` | refund.approve | reason + key → PROCESSING; 202 |
| POST `/admin/refunds/:refundId/reject` | refund.approve | reason → REJECTED; 200 |
| POST `/admin/refunds/:refundId/retry` | refund.approve | key,reason → cùng khoản hoàn; 202 |
| GET `/organizer/events/:eventId/sales` | sales.read_own | from,to → số liệu tổng hợp; 200 |
| GET `/admin/users` | user.manage | phân trang, lọc status; 200 |
| POST `/admin/users/:userId/block` | user.block | reason → trạng thái; 200 |
| POST `/admin/users/:userId/unblock` | user.block | reason → trạng thái; 200 |
| POST `/admin/organizers/:userId/approve` | organizer.approve | reason → cấp role có audit; 200 |
| PUT `/admin/users/:userId/roles` | role.assign | roleCodes,reason → vai trò; 200 |
| POST `/admin/events/:eventId/block` | event.block_any | reason → trạng thái/job; 202 |
| GET `/admin/audit-logs` | audit.read | lọc thời gian/tài nguyên, phân trang; 200 |
| GET `/admin/statistics` | statistics.read_system | số liệu tổng hợp; 200 |

Route lồng phải kiểm tra `session.event_id == eventId`, row thuộc venue, section thuộc venue; không chỉ kiểm tra ID cuối. Endpoint mock không được mount ở production; môi trường demo không công khai quyền mô phỏng tùy ý.

## Hợp đồng checkout và idempotency

```json
{ "seatIds": ["101", "102"] }
```

Đây là `SessionSeat.id`, không phải Seat vật lý; tên API `seatIds` phải giải thích trong OpenAPI. Server trả `hold.id`, `expiresAt`, `serverTime`, từng ghế với giá snapshot. Checkout chỉ gửi `{ "holdId": "501" }`; không nhận total/customerId/status từ client.

Header `Idempotency-Key` bắt buộc cho hold, checkout, payment, cancel, check-in, refund. Scope gồm actor + thao tác; canonical hash payload theo schema (danh sách ghế được chuẩn hóa). Cùng key/cùng payload trả mã kết quả và resource ID đã lưu; truy vấn resource để lấy trạng thái hiện tại. Cùng key khác payload → 409 `IDEMPOTENCY_CONFLICT`. Request đang xử lý có thể trả 409 `REQUEST_IN_PROGRESS` kèm Retry-After; không tạo thao tác mới. Retention đề xuất 24 giờ, cần Q-013; unique nghiệp vụ/provider reference giữ lâu hơn để vẫn chống lặp sau cleanup key.

## Phân trang, lọc, tìm kiếm

`GET /events?q=nhac&categoryId=2&city=...&from=...&to=...&minPrice=...&maxPrice=...&available=true&sort=startsAt&order=asc&page=1&pageSize=20`.

MVP page >= 1, pageSize 1–100, mặc định 20; trả `meta.pagination {page,pageSize,total,totalPages}`. Danh sách rỗng 200; sort allowlist `startsAt`, `createdAt`, `price` với ID làm tie-breaker. `startsAt` là suất sắp tới sớm nhất phù hợp filter; `price` là giá ghế nhỏ nhất trong các suất phù hợp. Snapshot kết quả có thể dịch chuyển khi dữ liệu đổi; cursor/keyset là mở rộng nếu offset lớn. Không nội suy tên cột sort trực tiếp vào SQL.

## Lỗi tập trung

| Lớp / HTTP | Khi dùng | Code ví dụ |
| --- | --- | --- |
| ValidationError / 400 | JSON/schema/query không hợp lệ | VALIDATION_ERROR |
| AuthenticationError / 401 | Thiếu, hết hạn, thu hồi token/phiên | UNAUTHENTICATED |
| AuthorizationError / 403 | Có danh tính nhưng thiếu quyền chung | FORBIDDEN |
| NotFoundError / 404 | Không tồn tại hoặc ngoài ownership cần che giấu | RESOURCE_NOT_FOUND |
| ConflictError / 409 | Ghế bị giữ, expiry, version/key conflict, vé đã quét | SEAT_UNAVAILABLE, HOLD_EXPIRED, TICKET_ALREADY_USED |
| BusinessRuleError / 422 | Input đúng nhưng publish/refund/check-in không đạt chính sách | REFUND_NOT_ALLOWED |
| RateLimitError / 429 | Vượt giới hạn | RATE_LIMITED, Retry-After |
| DatabaseError / 500 | Lỗi nội bộ chưa phân loại | INTERNAL_ERROR |
| DependencyUnavailable / 503 | DB/adapter tạm lỗi, retry khóa đã hết | TEMPORARILY_UNAVAILABLE |

Middleware cuối cùng map lỗi domain sang HTTP và log request ID; rollback do service/transaction helper chịu trách nhiệm trước khi phản hồi. UQ đã biết map 409 phù hợp; không map mọi lỗi DB thành lỗi người dùng. Callback chỉ ack thành công sau khi lưu inbox hoặc áp dụng transaction thành công; thất bại trước ghi bền vững trả lỗi để provider retry.
