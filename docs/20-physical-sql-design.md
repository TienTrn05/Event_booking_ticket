# 20. Thiết kế SQL vật lý hiện hành

[schema.sql](../database/schema.sql) có **38 bảng**, đã đồng bộ yêu cầu Organization/review/layout/Google-OTP/CheckIn theo [23](23-organization-review-seatmap.md), ADR-014 ngày 2026-09-13. Đây là DDL cho **database rỗng để review và triển khai migration sau này**, không phải script nâng cấp dữ liệu cũ hoặc database production đã triển khai.

## Bản đồ bảng

| Miền | Bảng |
| --- | --- |
| Identity và tổ chức (11) | users, roles, permissions, user_roles, role_permissions, external_identities, otp_challenges, organizations, organization_memberships, auth_sessions, refresh_tokens |
| Event và layout (9) | event_categories, events, venues, seat_layouts, layout_sections, layout_rows, seats, event_sessions, ticket_types |
| Đặt vé và tiền (10) | reservation_quotas, seat_holds, seat_hold_items, bookings, booking_items, session_seats, payments, refunds, tickets, check_ins |
| Duyệt và vận hành (8) | event_reviews, reason_notices, notifications, support_reports, idempotency_records, payment_webhooks, outbox_messages, audit_logs |

## Quyết định vật lý

ID là BIGINT UNSIGNED, API trả chuỗi. Tiền BIGINT đơn vị nhỏ nhất, CHECK không âm và currency bắt buộc ba chữ hoa; service chỉ chấp nhận currency đã duyệt và giá lớn hơn 0 trong MVP. Không tự chọn currency hoặc cấu hình cửa sổ quầy/vào cửa. Datetime UTC microsecond; connection phải SET time_zone='+00:00'. Timezone IANA được lưu để service tính lịch và hiển thị.

Text dùng utf8mb4_0900_as_cs; mã/status/provider dùng ascii_bin. Identity unique theo `(provider,subject)`, không unique email trên User và không tự gộp Google account theo email. Phone dùng E.164; service chuẩn hóa domain/email theo [04](04-authentication-authorization.md). `email_verified_at` tách khỏi `verified_at`: xác minh Google sub không tự chứng minh mọi email có thể dùng cho tổ chức.

Email công ty của đại diện nằm ở ExternalIdentity, liên kết đúng User/provider bằng composite FK ở Organization/Membership. Provider phải GOOGLE hoặc COMPANY_EMAIL. Service kiểm tra email đã xác minh, domain công ty, trạng thái identity, Admin duyệt, membership và phiên công ty. Seed role chỉ cấp tập permission cho role; không tạo UserRole hoặc biến domain thành quyền tự động. Catalog không có owner Organizer; tổ chức lưu layout riêng và snapshot giới hạn venue.

Một credential ngẫu nhiên cho mỗi vé, nhập tay hoặc biểu diễn trong QR: `ticket_code_hash`, `ticket_code_ciphertext`, `ticket_key_version`. Không có mã thẻ ngân hàng/giấy tờ, không lưu thêm một QR secret độc lập. Key mã hóa/HMAC nằm ngoài DB. OTP dùng keyed MAC và browser binding, không hash trần mã ngắn.

FK mặc định RESTRICT/NO ACTION; không cascade xóa lịch sử tiền/vé. Mọi khóa tham chiếu có PK/UQ rõ ràng. Ba vòng Booking→Payment, Ticket→CheckIn và Event→EventReview được thêm bằng ALTER sau CREATE; không tắt foreign_key_checks. DDL MySQL có implicit commit nên không coi transaction bọc file là rollback được toàn schema.

## DB bảo vệ trực tiếp

| Bất biến | Ràng buộc |
| --- | --- |
| Identity không thuộc hai người | UQ(provider,subject), composite FK identity/user/provider |
| Đăng nhập nhiều thiết bị, không gắn nhầm identity | UQ family_id; FK AuthSession(identity_id,user_id), không unique user_id |
| OTP có hạn, mục đích, số lần thử | CHECK expiry, attempts/max_attempts, purpose/user; challenge_id unique |
| Layout đúng tổ chức và event | FK SeatLayout(event_id,organization_id) |
| Suất đúng event/venue/layout; ghế đúng layout | Composite FK Session→Layout, Seat→Row→Section, SessionSeat→Session/Seat |
| Mỗi loại vé có code riêng trong suất | UQ TicketType(session_id,code), FK SessionSeat(type,session) |
| Không trùng ghế trong suất | UQ SessionSeat(session_id,seat_id) |
| Booking đúng chủ/suất/hold/event | Composite FK tới Hold và Session, UQ hold_id |
| Items đúng suất, vé đúng item/ghế | Composite FK items và Ticket, UQ ticket.booking_item_id |
| Một vé VALID/USED trên mỗi ghế suất | Generated active_seat_guard + UQ |
| CheckIn khác admission | UQ CheckIn.ticket_id; USED cần actor/time + FK admission_check_in_id trỏ CheckIn của chính vé |
| Allocation có pointer đầy đủ | CHECK AVAILABLE/HELD/SOLD; FK booking/hold/session khi HELD đã checkout |
| Một payment đang chờ mỗi booking | Generated pending_booking_guard + UQ |
| Khoản xác nhận thuộc đúng booking | Composite FK confirmed_payment_id/id |
| Một full refund đang tồn tại mỗi receipt | Generated full_refund_guard + UQ; REJECTED trả guard NULL |
| Refresh chỉ một con và cùng phiên | UQ parent_id + FK(parent_id,session_id) |
| Một hồ sơ PENDING và một bản gửi mỗi version | pending_event_guard UQ, UQ(event_id,event_version) |
| Hạn hồ sơ chính xác 15×24h | CHECK expires_at=submitted_at+15 DAY; decision trước hạn, EXPIRED từ hạn trở đi |
| Published phải trỏ hồ sơ APPROVED đúng event/version ghi nhận | FK(approved_review_id,id,approved_event_version,approval_status) và CHECK pointer/status |
| Phiếu gửi phải có tác giả/nội dung/thời điểm | CHECK ReasonNotice SENT, UQ review_id |
| Không lặp thông báo chính; phiếu đúng review | UQ(recipient,type,review), composite FK notice/review |
| Report booking đúng event | FK(booking_id,event_id); RESOLVED cần Admin, nội dung và thời điểm |
| Worker có quyền sở hữu lease rõ ràng | CHECK PROCESSING cần lease_until/token; ack bằng token có điều kiện |

Generated guard trả NULL ngoài tập cần unique; expiry cần worker đổi trạng thái, không dùng thời gian hiện tại trong index. CHECK nullable ghi rõ IS NULL/IS NOT NULL để tránh UNKNOWN lọt qua. JSON chỉ CHECK là object, không thay JSON schema validation.

## Service và transaction vẫn phải thực thi

- Xác minh Google/OTP, chống brute force, one-time consume, rotation, thu hồi phiên; xác minh domain công ty, role và report liên quan OPEN/IN_REVIEW. SQL không xác thực người gọi và không tự bắt Admin phải có report cho mọi mutation.
- Tính cutoff **trừ một tháng lịch trong timezone suất sớm nhất**, clamp ngày cuối tháng rồi đổi UTC. DB chỉ kiểm tra cutoff đã ghi và hạn 15 ngày; client không được tự gửi cutoff đáng tin. Khóa Event rồi Review, đọc giờ DB mới sau khóa; không duyệt snapshot cũ hoặc gia hạn hồ sơ.
- Event PENDING_REVIEW và snapshot/layout FROZEN bất biến; SENT notice không sửa. Ghi review, trạng thái event, reason task, Notification, audit/outbox cùng transaction. Worker hết hạn không tự soạn lý do thay Admin; nó tạo DRAFT để Admin hoàn tất trên form đặc tả ở 23.
- Validate polygon, sân khấu/lối đi, ghế chồng lấn, capacity và tính đúng của snapshot; khóa layout khi freeze. FK không ngăn sửa trực tiếp geometry của bản frozen. Catalog đổi version không sửa snapshot lịch sử. Counter/admission phải mở trước đóng; counter đóng không muộn hơn admission đóng và admission đóng không sau ends_at; thời điểm cụ thể do cấu hình đã duyệt.
- ReservationQuota chỉ là hàng khóa `(customer_id,session_id)`. Khóa trước Event, đếm hold/booking chờ; tối đa 6 ghế, một phân bổ đang hoạt động, TTL hold 5 phút không kéo dài. CHECK không thể tự đếm quota liên bảng.
- Tính tổng/giá/currency và tên/type snapshot từng item; khóa cùng connection, idempotency và chuyển trạng thái đầy đủ. Không phát vé từ redirect hoặc payment đến muộn; không bán lại tự động sau refund.
- Check-in online `[starts_at-24h,starts_at)`: xác thực owner, tên và code; quầy theo membership/window. Admission yêu cầu CheckIn, VALID, đúng window, UPDATE một lần dưới khóa; CheckIn tự nó không chặn refund theo policy vé chưa USED.
- Append-only audit, redaction, giới hạn tổng hoàn, lịch sử payment ngoài dự kiến, queue fencing và quyền DB runtime phải triển khai trong ứng dụng/vận hành.

Không có successful_booking_guard: mọi khoản tiền thực nhận phải lưu được. Booking chọn một confirmed_payment_id; khoản SUCCESS khác được ghi reconciliation REQUIRED và công việc xử lý. Không ghi đè receipt hoặc pointer đã xác nhận để che thu trùng.

## Seed, truy vấn, sơ đồ và kiểm chứng

[Seed quyền](../database/seeds/001-reference-data.sql): 3 role, 29 permission và ánh xạ theo 03; chạy lại không tạo lặp hoặc cấp UserRole. [Venue demo](../database/seeds/002-demo-venues.sql) là dữ liệu giả tùy chọn, không phải thông tin giới hạn địa điểm thật. Bốn [truy vấn](../database/README.md) đọc tồn kho từ layout, sales theo tổ chức/đại diện, audit liên bảng và hàng đợi duyệt/phiếu lý do.

Sales aggregate refund trước join, chỉ tính receipt được chọn xác nhận booking. Audit chỉ phát hiện các bất biến được liệt kê, gồm bounds chữ nhật, capacity và cửa sổ check-in/admission; không thay validator polygon/permission. Chạy audit trong read-only consistent snapshot. Mọi tham số query phải được bind từ service, không ghép chuỗi từ client.

67 kiểm tra đạt trên MySQL **8.0.46**, database tạm riêng ngày 2026-09-13: DDL, seed chạy lại, các FK/UQ/CHECK, bốn query và tranh chấp hai connection cho ghế/OTP/admission. Kết quả này là kiểm tra DB, không đánh dấu T-032–T-041 API/E2E đã pass. Chi tiết phạm vi ở [database README](../database/README.md), [13](13-testing-strategy.md). ERD được đối chiếu 38 bảng và FK từ information_schema, SVG/gallery đã xuất lại.

Các lựa chọn vật lý nằm ở ADR-014. Currency, hạ tầng production và tham số nghiệp vụ còn mở vẫn theo [18](18-open-questions.md); không tự điền bằng dữ liệu test.
