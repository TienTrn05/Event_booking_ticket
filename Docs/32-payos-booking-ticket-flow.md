# payOS, thông tin từng vé và vào cửa

> Quyết định hiện hành 2026-10-11: ADR-028 dùng một FE với ba khu vực; ADR-029 cho chọn Customer hoặc Organizer khi onboarding bằng Google/email cá nhân. Không còn yêu cầu domain/phiên công ty để vận hành Organizer. Vai trò, tên, giới tính và ngày sinh bắt buộc; sở thích/thành phố/theo dõi có thể bỏ qua. Organizer không tự nhận Customer; tạo nháp ngay, Admin vẫn duyệt tổ chức và sự kiện trước mở bán. Các đoạn mô tả cơ chế cũ dưới đây được thay thế trong phạm vi này. Xem [33](33-registration-onboarding.md) và [34](34-organizer-event-api.md).

Quyết định chủ dự án ngày 2026-10-11: một kênh payOS trong BE/.env cho toàn hệ thống, VND; doanh thu truy về Organizer qua payment → booking → event → organization. Không tự chia tiền, chi trả hoặc hoàn tiền. Tiền đến muộn cần đối soát, không hồi sinh đơn/ghế/vé. Modular Monolith một API theo ADR-025.

## Trách nhiệm

- Booking sở hữu hold 5 phút, quota, ghế và trạng thái đơn. Checkout không kéo dài hold.
- `PaymentService` phụ thuộc `PaymentGateway`, `BookingPaymentPort`, `TicketIssuer`; `PayosGateway`, `BookingPaymentAdapter`, `DatabaseTicketIssuer` là các implementation. Constructor injection ở startup; SQL chỉ ở repository. TicketService dùng interface đọc purchase nhỏ hơn.
- Idempotency dùng chung ở `shared/idempotency`. Chữ ký, mã đơn payOS, tổng tiền, quyền và trạng thái đều do BE kiểm tra; FE không quyết định giá hoặc xác nhận đã trả tiền.
- Link tạo qua outbox sẵn có; request provider ở ngoài transaction. Nếu timeout sau khi provider đã tạo, tìm lại cùng orderCode; không sinh orderCode mới. Worker bookings phục hồi outbox/inbox và poll provider, không thêm broker/worker codebase hay hạ tầng phân tán.

## API và FE

| Bước | API |
| --- | --- |
| Nhập đúng một bộ họ tên, ngày sinh, SĐT, CCCD mỗi item | `PUT /api/v1/bookings/:id/attendees` |
| Chuẩn bị thanh toán, khóa sửa attendee | `POST /api/v1/bookings/:bookingId/payments`, body `{}`, Idempotency-Key |
| Xem kết quả của chính người mua | `GET /api/v1/payments/:paymentId` |
| payOS báo tiền, không dùng JWT/Origin | `POST /api/v1/payments/webhooks/payos`, chữ ký SDK kiểm tra |
| Vé của chính người mua | `GET /api/v1/users/me/tickets`, `/bookings/:bookingId/tickets`, `/tickets/:ticketId` |
| Check-in online trước suất 24 giờ đến trước lúc bắt đầu | `POST /api/v1/tickets/:ticketId/check-in` |
| Suất đúng tổ chức của staff | `GET /api/v1/organizer/ticket-sessions` |
| Tra QR đúng suất, không trả CCCD/ngày sinh | `POST /api/v1/sessions/:sessionId/ticket-lookup` |
| Check-in quầy trong cửa sổ cấu hình | `POST /api/v1/sessions/:sessionId/check-ins` |
| Đối chiếu CCCD thật và consume vé | `POST /api/v1/sessions/:sessionId/admissions` |

Check-in/admission yêu cầu Idempotency-Key; lookup không cần. Các mutation của người dùng cần JWT, Origin website cấu hình và JSON. Counter/lookup/admission yêu cầu user ACTIVE, phiên company identity đang hợp lệ, membership ACTIVE trong Organization APPROVED, domain/Google hosted-domain phù hợp và permission `ticket.checkin_own`; không suy quyền từ FE/email đơn thuần.

FE: `/events/:eventId/book` → `/checkout/:bookingId` → payOS → `/payments/return` hoặc `/payments/cancel` → `/my-tickets`. Trả về chỉ mang bookingId để đọc lại từ BE; `status=PAID` từ browser không phát vé. `/organizer/check-in` cho nhân viên: nhập/quét mã bằng máy đọc QR, check-in quầy nếu cần, nhập thông tin trên CCCD thật, xác nhận đã đối chiếu rồi cho vào cửa. Chưa có camera scanner.

## Tiền và vé

Webhook được xác minh trước khi lưu; lưu inbox trước transaction xử lý để phục hồi khi lỗi phát vé. Khóa booking/ghế/payment rồi cộng khoản nhận theo reference duy nhất. Callback trùng không cộng lại tiền hoặc phát lại vé. Amount/code/currency/link/order không khớp bị quarantine. Chỉ tổng nhận bằng giá đơn, đơn còn hạn và attendee đủ tuổi/thông tin mới cập nhật payment SUCCESS, booking CONFIRMED, ghế SOLD và phát một vé mỗi item trong cùng transaction. Lỗi issuance rollback cả xác nhận và trạng thái inbox processing; receipt đã nhận vẫn được giữ để retry.

Khoản thiếu, dư, đến sau hủy/hết hạn hoặc từ attempt đã đóng có reconciliation REQUIRED; không cấp vé bằng redirect/query. Khoản thiếu có thể được cộng tiếp tới đúng giá trong lúc đơn còn hiệu lực. Khoản thêm vào payment đã thành công cũng cần đối soát. Poll các attempt PENDING/FAILED trong 7 ngày, mỗi vòng tối đa 3, không quá một lần mỗi attempt/15 giây; webhook còn nhận sau đó. Chưa có giao diện xử lý đối soát/refund/payout.

QR chứa mã ngẫu nhiên 128 bit, không chứa CCCD/tên/JWT. DB lưu hash và mã AES-GCM gắn với bookingItem/session, dùng `TICKET_ENCRYPTION_KEY` ngoài Git, độc lập với `ATTENDEE_PII_KEY`. Chỉ chủ vé nhận mã còn VALID; không ghi vào URL/log/storage. Check-in không consume vé. Admission recheck VALID/đơn/event/session/org/cửa sổ, CCCD HMAC, tên/ngày sinh/tuổi và check-in trước khi đánh dấu USED; hai lượt vào cửa chỉ một lượt thành công. CCCD vẫn purge theo suất +30 ngày như ADR-023/024.

## Chạy local và kiểm thử

BE/.env cần `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`, `PUBLIC_APP_URL`, `TICKET_ENCRYPTION_KEY`, cùng `ATTENDEE_PII_KEY` đã có. Không đưa key sang FE. URL webhook không cần biến env cho receiver; đăng ký đầy đủ `/api/v1/payments/webhooks/payos` trên kênh payOS. Quick tunnel đổi URL khi tạo lại thì phải đăng ký lại; giữ tiến trình tunnel hoạt động khi thử thanh toán.

Chạy API `npm.cmd run dev`, FE `npm.cmd run dev`; worker hiện có `npm.cmd run worker:bookings` xử lý expiry/recovery và `npm.cmd run worker:notifications` xử lý notification/retention. Chưa gộp worker vào npm dev và chưa tự khởi chạy worker nền. Swagger `/api/docs/`, JSON `/api/v1/openapi.json`; khi thao tác từ browser phải mở qua origin FE đã cấu hình để Origin hợp lệ.

Migration 007 chỉ thêm checkout_url, received_minor, last_polled_at và index vào payments; không thêm bảng. Schema mới và upgrade từ trước 007 đã được kiểm thử khớp nhau. DB local đã backup `backups/before-007-1791713695285.dump`, kiểm tra pg_restore --list và áp dụng 007; vẫn 46 bảng. Trước khi áp dụng trên DB khác phải backup/review lịch sử; local chưa có payments trước migration. Không sửa migration đã áp dụng.

`npm.cmd test` chạy kiểm tra unit/HTTP/schema/kiến trúc; `npm.cmd run test:commerce` dựng PostgreSQL tạm độc lập, kiểm tra schema fresh/upgrade rồi chạy các case callback/retry/atomicity/tuổi/ownership/check-in/admission. PostgreSQL tools mặc định Windows 18; đổi `PG_TEST_BIN` khi cần. Browser test cần build Fe trước, Edge Windows và `$env:COMMERCE_TEST_BROWSER='1'` trước test:commerce; dùng profile/DB/phiên/gateway giả, stub admission cho fixture, không đo Redis hay chuyển tiền thật. Script tự dọn tài nguyên.

Đã kiểm chứng trên kênh thật: tạo link thử 2.000 VND và hủy với amountPaid=0; payOS xác nhận webhook qua tunnel chủ dự án cung cấp. Link thử đầu được đặt expiredAt 5 phút nhưng hủy lỗi vì tham số harness sai; không chuyển tiền, không lưu URL/mã đó, không coi đã kiểm chứng hủy link đầu. Lần kế tiếp dùng đúng SDK đã hủy thành công. Chưa kiểm thử chuyển tiền thật hoặc full login company/onboarding Organizer; production vẫn cần phiên công ty/membership/quyền hợp lệ có sẵn, không tự cấp role.

Kiểm tra DB local 2026-10-11: catalog API qua FE trả 13 events khớp DB demo; 13 sessions nhưng chưa có seats/ticket_types/session_seats. Chưa thể tự mua vé trên catalog này. Test commerce tạo inventory riêng trong DB tạm; muốn thử thanh toán thật qua FE phải chuẩn bị dữ liệu bán vé local có chủ đích trước, không coi test fixture là dữ liệu ứng dụng hiện tại.
