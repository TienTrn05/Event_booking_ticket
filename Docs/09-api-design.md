# 09. Thiết kế REST API

> Quyết định hiện hành 2026-10-11: ADR-028 dùng một FE với ba khu vực; ADR-029 cho chọn Customer hoặc Organizer khi onboarding bằng Google/email cá nhân. Không còn yêu cầu domain/phiên công ty để vận hành Organizer. Vai trò, tên, giới tính và ngày sinh bắt buộc; sở thích/thành phố/theo dõi có thể bỏ qua. Organizer không tự nhận Customer; tạo nháp ngay, Admin vẫn duyệt tổ chức và sự kiện trước mở bán. Các đoạn mô tả cơ chế cũ dưới đây được thay thế trong phạm vi này. Xem [33](33-registration-onboarding.md) và [34](34-organizer-event-api.md).

Nguồn quyết định hiện hành: [18](18-open-questions.md), [23](23-organization-review-seatmap.md). API catalog, auth Customer/linking, hold/booking/phòng chờ và payOS/phát vé/check-in/admission đã có mã nguồn. Hợp đồng payment hiện hành và giới hạn kiểm chứng ở [32](32-payos-booking-ticket-flow.md); mutation/onboarding Organizer đầy đủ vẫn là hợp đồng đích.

## Upload ảnh R2 — ADR-022

Ngày 2026-10-10 đã thêm `GET /media/config`, `GET /media/avatar`, `POST /media/uploads`, `POST /media/uploads/complete`. Client upload File trực tiếp lên R2 bằng presigned PUT 5 phút; BE xác minh rồi lưu URL. Avatar cần profile.update_self; event/merchandise cần event.update_own, company session, membership/Organization/ownership và bản nháp đúng version. Không thay cơ chế auth. Hợp đồng input/output trong OpenAPI; luồng, CORS và giới hạn kiểm chứng tại [28](28-r2-image-upload.md). Editor và company login Organizer vẫn chưa có.

## Quy ước chung

ADR-023 ngày 2026-10-11: hồ sơ gender/dateOfBirth, follows/inbox, minimumAge/ageTag và attendee riêng mỗi vé; CCCD mã hóa, che số, purge 30 ngày sau suất. Theo ADR-027, FE checkout/vé/kiểm tra cửa đã nối API và kiểm thử bằng provider giả; payOS live tạo/hủy link và xác nhận webhook đã qua, giao dịch chuyển tiền thật chưa kiểm thử. Xem [29](29-profile-follow-age-attendees.md) và [32](32-payos-booking-ticket-flow.md).

API hồ sơ cá nhân đã triển khai ngày 2026-10-10: GET/PATCH `/users/me` no-store, scope lấy từ JWT/phiên, không nhận userId hoặc các trường quyền/email/phone/status/avatarUrl. PATCH recheck User/session/authVersion/permission dưới khóa, audit trong transaction khi tên thực sự đổi. Không đổi hợp đồng auth hoặc quy tắc liên kết. 26 kiểm tra HTTP/PostgreSQL riêng qua; FE sửa tên chưa nối.

Prefix `/api/v1`; JSON UTF-8; HTTPS ở staging/production. ID và tiền là chuỗi; timestamp ISO 8601 UTC dạng `2026-10-01T12:00:00Z`. `Content-Type: application/json`; giới hạn body và page size; không chấp nhận trường ngoài schema ở mutation. Không gửi body trong GET. PATCH chỉ chấp nhận allowlist, có `version` cho sửa nội dung để trả 409 khi xung đột.

Validation BE chuẩn hóa ngày 2026-10-11: ID DB chuỗi số dương canonical ≤9223372036854775807; version 0–2147483647; page 1–100000/pageSize 1–100. Query số chỉ nhận chuỗi thập phân đơn, không query lặp/array/object; catalog từ chối query ngoài allowlist và boolean khác true/false. Default pageSize catalog 24, inbox/booking 20. Mutation có body sai Content-Type trả 415 `UNSUPPORTED_MEDIA_TYPE`; JSON hỏng trả 400 `INVALID_JSON`, schema sai trả 400 `VALIDATION_ERROR`. Google callback vẫn cho phép query bổ sung từ provider. Xem [cấu trúc và kiểm chứng](31-backend-code-structure.md).

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

### Endpoint catalog đã triển khai

| Method / path | Phạm vi | Kết quả |
| --- | --- | --- |
| GET `/catalog/home` | Công khai | Graph Home gồm category, event, organizer, merchandise, article, địa điểm và hồ sơ mở bán lại đã duyệt |
| GET `/event-categories` | Công khai | Danh mục đang hoạt động và số event `PUBLISHED` |
| GET `/events`, `/events/:id` | Công khai | Lọc `q/category/city/featured/spotlight`, phân trang tối đa 100; chi tiết theo public ID |
| GET `/organizers`, `/organizers/:id` | Công khai | Organization `APPROVED`, hồ sơ hiển thị và sự kiện sắp tới |
| GET `/venues`, `/venues/:id` | Công khai | Venue `ACTIVE`, có thể lọc city |
| GET `/merchandise`, `/merchandise/:id` | Công khai | Sản phẩm `PUBLISHED` thuộc event và Organization tương ứng |
| GET `/articles`, `/articles/:id` | Công khai | Bài viết `PUBLISHED` |
| GET `/event-change-requests` | Công khai | Chỉ hồ sơ `APPROVED` được phép hiện catalog; không phải marketplace cá nhân |
| GET `/locations` | Công khai | Thành phố, ảnh đại diện và số event công khai |

Các endpoint này đọc PostgreSQL qua repository/service, dùng envelope chung và validation Zod. Giá hiển thị là chuỗi minor unit; `starting_price_minor` chỉ phục vụ catalog, không được dùng thay giá tồn kho lúc hold/checkout.

OpenAPI 3.0 của phần đã triển khai được phục vụ tại `GET /api/v1/openapi.json`; Swagger UI ở `GET /api/docs/`. Tài liệu chỉ mô tả endpoint đang chạy, không đưa các endpoint nghiệp vụ đích chưa triển khai vào Swagger để tránh tạo cảm giác chúng đã sẵn sàng.

### Endpoint nghiệp vụ đích

Các đường dẫn sau đều có prefix `/api/v1`. “Chủ” luôn kiểm tra ở service. Chỉ phần Q còn mở mới cần chốt thêm; quy tắc đã duyệt ở 18 không cần xin duyệt lại.

| Method / path | Quyền | Input → output; HTTP |
| --- | --- | --- |
| GET `/auth/config` | Công khai | `{googleEnabled,emailOtpEnabled,sessionEnabled}`; 200 |
| GET `/auth/me` | Access JWT + phiên DB hợp lệ | hồ sơ tối thiểu; 200 |
| POST `/auth/google/start` | Same-origin + CSRF | tạo state/nonce/PKCE verifier trong cookie ngắn hạn → authorizationUrl; 200 |
| GET `/auth/google/callback` | Google code + state | đổi code và xác minh ID token ở backend, tạo phiên + refresh cookie, redirect về FE; 302 |
| POST `/auth/otp/request` | Guest, rate limit | Customer: identifier=email/SĐT,phone?,purpose → challengeId; 202 chung theo ADR-021; COMPANY_EMAIL là đợt sau |
| POST `/auth/otp/verify` | Challenge + code, rate limit | Customer: challengeId,code → user + app tokens/cookie; 200; purpose/target/browser do server bind |
| POST `/auth/identities/link` | Phiên + reauthentication + proof identity mới | liên kết identity chưa thuộc User khác; 200; không merge bằng email |
| POST `/auth/refresh` | Cookie + CSRF | accessToken mới + cookie; 200 |
| POST `/auth/logout` | Phiên/cookie + CSRF | thu hồi session, xóa cookie; 204 |
| POST `/auth/logout-all` | Đã xác thực | thu hồi mọi thiết bị; 204 |
| GET `/auth/csrf` | Origin hợp lệ | CSRF token gắn ngữ cảnh trình duyệt; 200, no-store |
| GET `/auth/sessions` | Chủ | danh sách thiết bị đã che thông tin; 200 |
| DELETE `/auth/sessions/:sessionId` | Chủ | thu hồi thiết bị; 204 |
| GET/PATCH `/users/me` | JWT + phiên DB; PATCH thêm Origin + profile.update_self | `{id,displayName,avatarUrl,gender,dateOfBirth}` / PATCH strict displayName/gender/dateOfBirth, ít nhất một field; DOB/gender private, nullable; avatar chỉ qua media |
| GET `/event-categories` | Công khai | danh mục hoạt động; 200 |
| GET `/events` | Công khai | bộ lọc bên dưới → danh sách; 200 |
| GET `/events/:eventId` | Công khai | Chỉ DTO sự kiện công khai; bản nháp dùng management endpoint riêng; 200 |
| POST `/events` | event.create + membership | organizationId (server kiểm tra scope),title, categoryId, description → nháp; 201 |
| PATCH/DELETE `/events/:eventId` | Chủ | trường cho phép + version / xóa nháp rỗng; 200/204 |
| POST `/events/:eventId/submit` | event.submit_own, membership | version → EventReview PENDING + expiresAt; 201; event PENDING_REVIEW |
| POST `/events/:eventId/withdraw` | Chủ tổ chức | version → DRAFT, review WITHDRAWN; 200 |
| GET `/admin/event-reviews` | event.review | status,page,pageSize → hàng đợi có deadline; 200 |
| GET `/admin/event-reviews/:reviewId` | event.review | bản event/session/layout đã submit + version; 200 |
| POST `/admin/event-reviews/:reviewId/approve` | event.review | version + key → PUBLISHED; 200; quá hạn 409 REVIEW_EXPIRED |
| POST `/admin/event-reviews/:reviewId/reject` | event.review | version,reasonCode,reasonText,guidance + key → REJECTED và phiếu; 200 |
| GET `/admin/event-reviews/:reviewId/reason-notice` | event.review | metadata/form nháp hoặc phiếu đã gửi; 200 |
| PUT `/admin/event-reviews/:reviewId/reason-notice` | event.review | reasonCode,reasonText,guidance,version → lưu nháp; 200; không sửa SENT |
| POST `/admin/event-reviews/:reviewId/reason-notice/send` | event.review | version + key → phiếu SENT và notification bền vững; 200 |
| POST `/events/:eventId/cancel` | Chủ, policy | reason → trạng thái và job xử lý; 202 |
| GET `/organizer/events` | Organizer | danh sách sở hữu gồm nháp; 200 |
| GET `/organizer/events/:eventId` | Chủ | chi tiết quản lý; 200 |
| GET `/venues` | venue.read_catalog | q,city,page,pageSize → danh mục địa điểm có sẵn; 200 |
| GET `/venues/:venueId` | venue.read_catalog | địa chỉ/timezone/capacity/bounds/version; 200; không expose thông tin nội bộ |
| GET/POST `/events/:eventId/layouts` | Organization sở hữu | danh sách / venueId → bản layout DRAFT; 200/201 |
| GET/PUT `/events/:eventId/layouts/:layoutId` | layout.manage_own | geometry,sections,rows,seats,version → snapshot; 200; bounds/capacity validate server |
| POST `/events/:eventId/layouts/:layoutId/freeze` | layout.manage_own | version → FROZEN bất biến; 200 |
| GET/POST `/events/:eventId/sessions/:sessionId/ticket-types` | ticket_type.manage_own | danh sách / code,name → type; 200/201; chỉ event DRAFT |
| GET/POST `/events/:eventId/sessions` | Công khai / Chủ | suất công khai / venueId,layoutId,lịch,cửa sổ bán/quầy/vào cửa; 200/201 |
| PATCH `/events/:eventId/sessions/:sessionId` | Chủ | thay đổi cho phép trước bán; 200 |
| PUT `/events/:eventId/sessions/:sessionId/seat-prices` | Chủ | batch sessionSeatId,ticketTypeId,priceMinor,currency; 200 |
| GET `/events/:eventId/sessions/:sessionId/seats` | Công khai | snapshot ghế/giá, serverTime; 200 |
| POST `/events/:eventId/sessions/:sessionId/seats/hold` | Customer | seatIds + Idempotency-Key → hold,items,expiresAt; 201 |
| GET/DELETE `/holds/:holdId` | Chủ | hold / nhả trước chuyển booking; 200/204 |
| POST `/bookings` | Customer | holdId,attendees[{sessionSeatId,attendeeName}] + Idempotency-Key → booking; 201 |
| GET `/bookings` | Chủ | đơn của mình, phân trang; 200 |
| GET `/bookings/:bookingId` | Chủ hoặc Admin có reportId liên quan + audit | chi tiết, payment summary; 200 |
| POST `/bookings/:bookingId/cancel` | Chủ | reason + key → booking; 200 |
| POST `/bookings/:bookingId/payments` | Chủ | key, adapter được server chọn → payment attempt; 201 |
| GET `/payments/:paymentId` | Chủ booking | trạng thái và reconciliation; 200 |
| POST `/payments/webhooks/:provider` | Xác thực provider | payload riêng/raw body → ack; 200 hoặc 202 sau ghi bền vững |
| POST `/internal/mock-payments/:paymentId/outcome` | Dev/test có bảo vệ; staging theo Q-012 | scenario SUCCESS/FAILED/TIMEOUT + key → kết quả mô phỏng; 200; TIMEOUT giữ payment PENDING |
| GET `/bookings/:bookingId/tickets` | Chủ | danh sách vé/QR, no-store; 200 |
| GET `/tickets/:ticketId` | Chủ | vé, no-store; 200 |
| POST `/tickets/:ticketId/check-in` | ticket.checkin_self, chủ booking | attendeeName,ticketCode + key → CheckIn ONLINE; 200; cửa sổ 24h trước diễn |
| POST `/sessions/:sessionId/check-ins` | ticket.checkin_own, Organization | attendeeName,ticketCode + key → CheckIn COUNTER; 200; không USED |
| POST `/sessions/:sessionId/admissions` | ticket.checkin_own, Organization | qrToken hoặc ticketCode + key → admittedAt, USED; 200; cần CheckIn |
| POST `/bookings/:bookingId/refunds` | Chủ, policy | reason + key → refund REQUESTED; 201 |
| GET `/refunds/:refundId` | Chủ/Organizer đúng scope/Admin theo report | trạng thái; 200 |
| GET `/organizer/refunds` | refund.approve, Organization | status,page,pageSize → danh sách của tổ chức; 200 |
| GET `/admin/refunds` | refund.approve + report liên quan | reportId,status,page,pageSize → danh sách hỗ trợ đúng report; 200 |
| POST `/admin/refunds/:refundId/approve` | refund.approve + report | reportId,reason + key → PROCESSING; 202 |
| POST `/admin/refunds/:refundId/reject` | refund.approve + report | reportId,reason → REJECTED; 200 |
| POST `/admin/refunds/:refundId/retry` | refund.approve + report | reportId,key,reason → cùng khoản hoàn; 202 |
| POST `/organizer/refunds/:refundId/approve` | refund.approve + Organization | reason + key → PROCESSING; 202 |
| POST `/organizer/refunds/:refundId/reject` | refund.approve + Organization | reason + key → REJECTED; 200 |
| POST `/organizer/refunds/:refundId/retry` | refund.approve + Organization | reason + key → cùng refund; 202 |
| GET `/organizer/events/:eventId/sales` | sales.read_own | from,to → số liệu tổng hợp; 200 |
| GET `/admin/users` | booking.read_support + report | reportId → thông tin tối thiểu liên quan, phân trang; 200 |
| POST `/admin/users/:userId/block` | user.block + report | reportId,reason → trạng thái; 200 |
| POST `/admin/users/:userId/unblock` | user.block + report | reportId,reason → trạng thái; 200 |
| POST `/organizations/applications` | Phiên email công ty verified | name,companyDomain,companyIdentityId → hồ sơ; 201 |
| GET/PATCH `/organizations/applications/:organizationId` | Đại diện hồ sơ/company session | đọc / sửa REJECTED và nộp lại với version, name,companyDomain,companyIdentityId; 200; phải verify lại nếu đổi identity |
| GET `/admin/organization-applications` | organizer.approve | status,page,pageSize → hồ sơ chờ; 200 |
| POST `/admin/organization-applications/:organizationId/approve` | organizer.approve | version,reason → Organization APPROVED + membership/role; 200 |
| POST `/admin/organization-applications/:organizationId/reject` | organizer.approve | version,reason → REJECTED; 200 |
| PUT `/admin/users/:userId/roles` | role.assign | roleCodes,reason → vai trò; 200 |
| POST `/admin/events/:eventId/block` | event.block_any + report | reportId,reason → trạng thái/job; 202 |
| POST `/reports` | report.create + scope | eventId,bookingId nếu có,reason → OPEN; 201 |
| GET `/reports/:reportId` | Người gửi/Organization đúng scope/Admin xử lý | DTO tối thiểu; 200 |
| GET `/admin/reports` | report.handle | status,page,pageSize → hàng đợi; 200 |
| POST `/admin/reports/:reportId/claim` | report.handle | version + key → IN_REVIEW, gán Admin đang xử lý; 200 |
| POST `/admin/reports/:reportId/resolve` | report.handle | resolution,version + key → RESOLVED; 200 |
| GET `/notifications` | Chủ | Đã triển khai inbox review + event Organizer theo dõi; items/unreadCount/pagination; 200 |
| POST `/notifications/:notificationId/read` | Chủ | đánh dấu đọc; 204 |
| GET `/admin/audit-logs` | audit.read | lọc thời gian/tài nguyên, phân trang; 200 |
| GET `/admin/statistics` | statistics.read_system | số liệu tổng hợp; 200 |

Route lồng phải kiểm tra `session.event_id == eventId`, layout thuộc event/Organization, row/section/seat thuộc layout; không chỉ kiểm tra ID cuối. Endpoint mock không được mount ở production; môi trường demo không công khai quyền mô phỏng tùy ý.

### Mock trên staging — chính sách Q-012 đã duyệt

Staging là đích demo MVP theo [14](14-environment-deployment.md), chính sách Q-012 đã được duyệt cho phép endpoint mock trên staging có bảo vệ, không chỉ dev/test. Server yêu cầu phiên hợp lệ, actor nằm trong allowlist tài khoản demo cấu hình ở backend và sở hữu booking của payment; kiểm tra payment thuộc provider mock. Không tự cấp quyền này cho mọi Customer hoặc Admin. Phải cấu hình allowlist tài khoản demo thực trước khi bật; thiếu allowlist thì fail startup theo 14. Dev/test dùng danh tính kiểm thử được cấu hình rõ, không bỏ kiểm tra ownership trong luồng UI.

Server chỉ mount khi môi trường được phép và mock bật; APP_ENV=production luôn cấm, dù client gửi request trực tiếp hoặc đổi cờ VITE. SUCCESS/FAILED đi qua mock adapter rồi processor kết quả bình thường; TIMEOUT mô phỏng chưa rõ kết quả, không ghi Payment FAILED và không cho tạo attempt chồng. Ghi audit actor/payment/scenario, không ghi secret. Cờ frontend chỉ điều khiển hiển thị.

### Review, report và danh sách refund

Cấp role ORGANIZER qua PUT roles vẫn phải kiểm tra hồ sơ Organization/membership đã duyệt, không bypass application. Identity/membership liên quan phải được xác minh từ DB.

Mọi mutation review/phiếu/report và approval refund yêu cầu Idempotency-Key, version khi sửa bản nháp. Trạng thái quá hạn được tính bằng giờ DB dù worker chưa chạy. Event PATCH chỉ DRAFT; PENDING_REVIEW phải withdraw trước sửa, PUBLISHED không sửa nội dung qua endpoint nháp. Không có endpoint Organizer tự publish. Form lý do và tháng lịch/15 ngày theo [23](23-organization-review-seatmap.md).

Danh sách Organizer refund mặc định REQUESTED, status allowlist Refund, page/pageSize theo quy ước chung, sort created_at ASC,id ASC. Trả id,bookingId,paymentId,type,status,amountMinor,currency,reason,createdAt. Scope Organization lọc trước query/count; không trả QR hoặc hồ sơ khách dư thừa. Admin dùng collection tương tự nhưng bắt buộc reportId còn mở liên quan đúng refund; không dùng report của A đọc B. Approval khóa và kiểm tra lại dù màn hình đang hiển thị REQUESTED.

Thông báo review expiry tạo tự động cùng quyết định hết hạn; phiếu lý do gửi sau khi Admin hoàn tất form. Endpoint send ghi Notification/outbox nguyên tử, retry cùng key không gửi trùng. Người Organizer xem phiếu qua notification thuộc mình. Xem bản chờ duyệt bằng event.review không đòi report; quyền sửa quản lý khác phải có report.

## Hợp đồng checkout và idempotency

```json
{ "seatIds": ["101", "102"] }
```

Đây là `SessionSeat.id`, không phải Seat vật lý; tên API `seatIds` phải giải thích trong OpenAPI. Server trả `hold.id`, `expiresAt`, `serverTime`, từng ghế với giá snapshot. Checkout chỉ gửi `{ "holdId": "501" }`; không nhận total/customerId/status từ client.

Header `Idempotency-Key` bắt buộc cho hold, checkout, payment, cancel, check-in, refund. Scope gồm actor từ xác thực + operation code cố định, ví dụ `payment.create`. `request_hash` bao phủ toàn bộ request nghiệp vụ đã validate: method, route template, route params xác định tài nguyên đích, body và query nếu query ảnh hưởng mutation. Không đưa Authorization, cookie, CSRF token hoặc request ID vào hash. Chuẩn hóa thứ tự object key, giá trị mặc định, ID dạng chuỗi và tập seatIds đã kiểm tra không trùng; không sort mảng mà thứ tự có ý nghĩa nghiệp vụ.

Cùng actor/operation/key và cùng request chuẩn hóa trả mã kết quả và resource ID đã lưu; truy vấn resource để lấy trạng thái hiện tại sau kiểm tra quyền hiện tại. Cùng key nhưng khác target hoặc body → 409 `IDEMPOTENCY_CONFLICT`. Ví dụ `/bookings/A/payments` và `/bookings/B/payments` với body giống nhau vẫn khác request; không trả payment của A cho yêu cầu nhắm B. Không chuyển target vào scope để vô tình chấp nhận cùng key như hai thao tác mới. Request đang xử lý có thể trả 409 `REQUEST_IN_PROGRESS` kèm Retry-After; không tạo thao tác mới. Retention đề xuất 24 giờ, cần Q-013; unique nghiệp vụ/provider reference giữ lâu hơn để vẫn chống lặp sau cleanup key.

Nếu mất response hold và chưa biết holdId, client gửi lại đúng request/key ban đầu để lấy resource ID; không cần endpoint tìm hold theo key. Sau đó GET hold để lấy trạng thái hiện tại. Khôi phục key qua reload và giới hạn replay được mô tả ở [22](22-frontend-architecture.md). Hết retention không được xem như vẫn còn bảo đảm replay; client không tự gửi mutation cũ với key mới.

### DTO tình trạng ghế

Response ghế công khai dùng trường `availability` với các giá trị AVAILABLE/HELD/SOLD. Repository có thể trả `AVAILABLE_AFTER_CLEANUP` từ [query tồn kho](../database/queries/01-session-inventory.sql); service chuyển giá trị này thành AVAILABLE trong DTO vì đây là ghế có thể yêu cầu giữ lại sau cleanup. Không thêm trạng thái DB hoặc update dữ liệu bằng GET. Seat đang HELD còn hạn trả HELD; không lộ owner/holdId trong snapshot công khai. Khi giữ, service vẫn cleanup và kiểm tra lại dưới khóa theo [11](11-booking-concurrency.md); AVAILABLE trên UI không bảo đảm request sẽ thắng.

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

## Auth Customer hiện hành — ADR-021

- GET `/auth/config`: `{googleEnabled,emailOtpEnabled,sessionEnabled}`; session không phụ thuộc provider nào đang bật.
- POST `/auth/otp/request`: Origin/CSRF/IP limit, JSON strict `{identifier,phone?,purpose?}`. identifier=email hoặc alias SĐT; phone tùy chọn chỉ khi identifier=email; purpose LOGIN mặc định hoặc LINK_IDENTITY. Linking thêm Bearer JWT và login mới trong 5 phút. 202 chung `{challengeId,expiresIn:300,resendAfter:60}`, không OTP/email tra cứu.
- POST `/auth/otp/verify`: Origin/CSRF/browser cookie, JSON strict `{challengeId,code}` (6 số). Linking thêm cùng User/JWT/login mới; 200 `{accessToken,user:{id,displayName}}` + refresh cookie. JWT chỉ ở memory.
- POST `/auth/google/start`: JSON strict `{link?:boolean}`; link=true cần Bearer JWT/phiên EMAIL mới; state ký gắn User/session; proof Google cùng email EMAIL đã xác minh.
- `/auth/me`, refresh/logout giữ hợp đồng. Lỗi: INVALID_OTP chung; OTP_RATE_LIMITED; EMAIL_UNAVAILABLE; LINK_REQUIRED sau proof khi cần liên kết, IDENTITY_CONFLICT/PHONE_CONFLICT khi identity đã thuộc User khác, REAUTHENTICATION_REQUIRED khi phiên linking cũ.

COMPANY_EMAIL Organizer, logout-all/danh sách thiết bị vẫn chưa triển khai; EMAIL không thay COMPANY_EMAIL.

## Hoàn thiện UX phiên — 2026-10-10

GET `/auth/methods` cần Bearer JWT + phiên/User hợp lệ, trả `{email,googleLinked,emailLinked,phones}` của chính User, không nhận userId và không trả permission/secret. Google callback chỉ bổ sung `authReason` từ allowlist mã lỗi an toàn khi thất bại, không đưa token/email/exception vào URL. FE dùng mã này làm thông báo rồi xóa khỏi URL. Lifetime, cookie, CSRF và chính sách liên kết giữ nguyên.

ADR-030 / chủ dự án chốt2026-10-12: Admin có onboarding.manage để cấu hình câu hỏi bổ sung (thêm/bỏ/required/nhãn/thứ tự). Bốn trường role/displayName/gender/DOB luôn bắt buộc. Bộ câu hỏi có phiên bản; giữ câu trả lời cũ, không cấp quyền từ custom answers. Xem Docs/35.

## Hoàn tiền/feedback đã triển khai — ADR-032

API refund/report/feedback đã mount và có Swagger. Request refund trước suất ít nhất24 giờ; approve thu hồi vé trước chuyển tiền thủ công; ghi SUCCESS bằng chứng từ, không giả xác nhận payOS. Feedback tổ chức sau suất/khi hủy, sửa7 ngày; feedback app riêng tư. Mutation có key/Origin/version, scope do DB; GET booking thêm eventId số để người mua gửi review, không phải ID catalog. [Danh sách API/body/quyền](37-refunds-reviews-app-feedback.md). FE ba chức năng mới chưa nối.

## API đọc hồ sơ vận hành — 2026-10-12

Thêm năm GET lịch sử duyệt/snapshot/CONTENT comparison cho Organizer/Admin; scope dựa quyền/membership hiện có, no-store và strict pagination/filter. Paths/response/giới hạn ở [38](38-organizer-sales-operations.md). Không đổi response list pending hiện có, token/CSRF hoặc provider; không thêm bảng/cột.


## Hoàn thiện BE 2026-10-14 — hợp đồng hiện hành

Docs40 ghi API đã mount: sessions/logout-all, event date/price/availability/sort, DELETE nháp rỗng, reports/Admin support-booking/audit, reason draft/preview/queue và personal blocked-organizers. ADR-035 thay API Admin user block/unblock/event block đề xuất bằng POST /admin/events/{id}/unpublish theo report scope: ARCHIVED dừng public/bán/check-in/vào cửa, giữ lịch sử, không xử lý đền bù. Catalog nhận Bearer tùy chọn cho feed cá nhân, không nhận excludedForUserId từ client. Swagger chỉ API thực. Role assignment/venue maintenance/CMS/merchandise purchase chưa chốt không được suy triển khai từ bảng endpoint đích cũ.

## Home event search — ADR-036

GET /search/events và /search/events/suggestions đã mount/Swagger, optional Bearer luôn xác minh khi gửi, no-store/Vary Authorization. Keyword title/Organizer/venue/public description; English fuzzy/prefix/N-gram/completion, strict filter/sort/pagination, PG hydrate current visibility/price/availability/personal blocks. Response thêm total/degraded/engine/pagination; suggestions≤6, q≥2. FE Home đã nối server search và preview ngoài danh sách Home. [Query/body/consistency/fallback/limits](41-home-event-search.md).

## Outdoor BE — ADR-037

POST draft thêm ticketingMode NUMBERED/QUANTITY. POST Organizer zone-layouts, PUT session zone-prices, GET public session zones và POST zones/hold đã mount/Swagger. Zone/sức chứa/type/price, server chọn units, tối đa6 vé/hold5 phút, không gia hạn hoặc physical seats giả; checkout/payment/attendees/QR/check-in/refund/cancel dùng hợp đồng hiện có. [Payload và phạm vi](42-outdoor-zone-ticketing.md).
