# 20. Thiết kế SQL vật lý hiện hành

> Quyết định hiện hành 2026-10-11: ADR-028 dùng một FE với ba khu vực; ADR-029 cho chọn Customer hoặc Organizer khi onboarding bằng Google/email cá nhân. Không còn yêu cầu domain/phiên công ty để vận hành Organizer. Vai trò, tên, giới tính và ngày sinh bắt buộc; sở thích/thành phố/theo dõi có thể bỏ qua. Organizer không tự nhận Customer; tạo nháp ngay, Admin vẫn duyệt tổ chức và sự kiện trước mở bán. Các đoạn mô tả cơ chế cũ dưới đây được thay thế trong phạm vi này. Xem [33](33-registration-onboarding.md) và [34](34-organizer-event-api.md).

[schema.sql](../database/schema.sql) có **46 bảng** sau ADR-032/012: metadata công khai nằm trên organizations/events, onboarding_questionnaires giữ các phiên bản câu hỏi, feedback chứa đánh giá/góp ý; xem [36](36-schema-audit.md). Database mới dùng schema.sql; database cũ dùng migration phù hợp sau backup/review, không chạy lại schema.

## URL ảnh R2 — ADR-022, 2026-10-10

Migration [003](../database/migrations/003-r2-images.sql) thêm `users.avatar_url VARCHAR(1000) NULL` và `events.cover_image_url VARCHAR(1000) NULL`. `merchandise_products.image_url` tiếp tục lưu URL. Thay đổi R2 không tạo bảng mới hoặc lưu binary/base64; schema hiện có46 bảng sau ADR-032. Catalog ưu tiên events.cover_image_url, fallback events.publication_cover_image_url. Luồng quyền, version và kiểm chứng tại [28](28-r2-image-upload.md). Các file sơ đồ đã bị xóa trong working tree trước đợt này; không khôi phục đè thay đổi của chủ dự án.

## Bản đồ bảng

ADR-031/011: metadata công khai đã gộp vào organizations/events. Unique public IDs/ranks giữ trên bảng cha; nhóm nullable trước công bố có CHECK không cho thiếu field. Giữ ảnh nháp/ảnh công bố và timestamps cũ. Deferred outbox trigger theo status/published_at trên events, dedupe nguyên trạng. Local/fresh45 bảng; ERD và bằng chứng [36](36-schema-audit.md).

ADR-023/024: users.gender/date_of_birth private; events.minimum_age và ageTag tính từ minimum_age ở query/DTO. organization_follows PK(user_id,organization_id), preference/timestamp; notifications thêm event_id nullable, unique recipient/type/event và CHECK giữ review_id cho loại review. booking_items dùng lại attendee_name_snapshot, thêm DOB/SĐT người tham dự, CCCD AES-GCM/MAC/last four nullable cùng purge marker, actor/time đối chiếu. Migration 004/005/006 và ERD phần bổ sung tại [29](29-profile-follow-age-attendees.md); không khôi phục các sơ đồ đã bị chủ dự án xóa.

| Miền | Bảng |
| --- | --- |
| Identity và tổ chức (11) | users, roles, permissions, user_roles, role_permissions, external_identities, otp_challenges, organizations, organization_memberships, auth_sessions, refresh_tokens |
| Event và layout (9) | event_categories, events, venues, seat_layouts, layout_sections, layout_rows, seats, event_sessions, ticket_types |
| Đặt vé và tiền (10) | reservation_quotas, seat_holds, seat_hold_items, bookings, booking_items, session_seats, payments, refunds, tickets, check_ins |
| Duyệt và vận hành (8) | event_reviews, reason_notices, notifications, support_reports, idempotency_records, payment_webhooks, outbox_messages, audit_logs |

## Quyết định vật lý

ID là BIGINT, API trả chuỗi. Tiền BIGINT đơn vị nhỏ nhất, CHECK không âm và currency bắt buộc ba chữ hoa; service chỉ chấp nhận currency đã duyệt và giá lớn hơn 0 trong MVP. Không tự chọn currency hoặc cấu hình cửa sổ quầy/vào cửa. Thời điểm dùng `TIMESTAMPTZ(6)`; connection chạy `SET TIME ZONE 'UTC'`. Timezone IANA được lưu để service tính lịch và hiển thị.

PostgreSQL lưu text theo encoding UTF-8 của database; so sánh mã/status/provider dùng giá trị chính xác theo ràng buộc và truy vấn, không áp dụng collation MySQL. Identity unique theo `(provider,subject)`, không unique email trên User và không tự gộp Google account theo email. Phone dùng E.164; service chuẩn hóa domain/email theo [04](04-authentication-authorization.md). `email_verified_at` tách khỏi `verified_at`: xác minh Google sub không tự chứng minh mọi email có thể dùng cho tổ chức.

Email công ty của đại diện nằm ở ExternalIdentity, liên kết đúng User/provider bằng composite FK ở Organization/Membership. Provider phải GOOGLE hoặc COMPANY_EMAIL. Service kiểm tra email đã xác minh, domain công ty, trạng thái identity, Admin duyệt, membership và phiên công ty. Seed role chỉ cấp tập permission cho role; không tạo UserRole hoặc biến domain thành quyền tự động. Catalog không có owner Organizer; tổ chức lưu layout riêng và snapshot giới hạn venue.

Một credential ngẫu nhiên cho mỗi vé, nhập tay hoặc biểu diễn trong QR: `ticket_code_hash`, `ticket_code_ciphertext`, `ticket_key_version`. Không lưu dữ liệu thẻ ngân hàng hoặc thêm QR secret độc lập. ADR-023 thêm CCCD mã hóa/HMAC trong booking_items bằng ATTENDEE_PII_KEY độc lập ngoài DB/Git, retention 30 ngày sau suất; không chứa CCCD rõ hoặc ảnh giấy tờ. OTP dùng keyed MAC và browser binding, không hash trần mã ngắn.

FK mặc định RESTRICT/NO ACTION; không cascade xóa lịch sử tiền/vé. Mọi khóa tham chiếu có PK/UQ rõ ràng. Ba vòng Booking→Payment, Ticket→CheckIn và Event→EventReview được thêm bằng ALTER sau khi các bảng liên quan đã tồn tại. PostgreSQL hỗ trợ transactional DDL; migration catalog được bọc trong `BEGIN`/`COMMIT` và dừng ngay khi có lỗi.

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
| Hạn hồ sơ chính xác 15×24h | `CHECK (expires_at = submitted_at + INTERVAL '15 days')`; decision trước hạn, EXPIRED từ hạn trở đi |
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

[Seed quyền](../database/seeds/001-reference-data.sql): 3 role, 29 permission và ánh xạ theo 03; chạy lại không tạo lặp hoặc cấp UserRole. [Seed catalog](../database/seeds/002-public-catalog.sql) là dữ liệu giả tùy chọn cho local/demo, gồm cả venue và không phải thông tin giới hạn địa điểm thật. Bốn [truy vấn](../database/README.md) đọc tồn kho từ layout, sales theo tổ chức/đại diện, audit liên bảng và hàng đợi duyệt/phiếu lý do.

Sales aggregate refund trước join, chỉ tính receipt được chọn xác nhận booking. Audit chỉ phát hiện các bất biến được liệt kê, gồm bounds chữ nhật, capacity và cửa sổ check-in/admission; không thay validator polygon/permission. Chạy audit trong read-only consistent snapshot. Mọi tham số query phải được bind từ service, không ghép chuỗi từ client.

67 kiểm tra ngày 2026-09-13 là kết quả lịch sử trên MySQL 8.0.46 cho 38 bảng lõi. Sau ADR-019, PostgreSQL **18** đã tạo thành công 44 bảng, chạy migration catalog, seed lặp, bốn query và repository catalog; kiểm thử tranh chấp hai connection trên PostgreSQL vẫn cần triển khai. Chi tiết ở [database README](../database/README.md), [13](13-testing-strategy.md).

Các lựa chọn vật lý nằm ở ADR-014. Currency, hạ tầng production và tham số nghiệp vụ còn mở vẫn theo [18](18-open-questions.md); không tự điền bằng dữ liệu test.

## ADR-021 — EMAIL và alias SĐT

Schema mới 45 bảng. EMAIL identity có subject=email_canonical đã xác minh; company FK vẫn chỉ GOOGLE/COMPANY_EMAIL. phone_login_aliases(phone PK,email_identity_id FK,created_at) không có verified_at; service chỉ trỏ EMAIL, không chuyển alias khác. otp_challenges thêm EMAIL/login_phone/delivery_ready mặc định false. Advisory target/email + row locks bảo vệ creation/linking/resend/consume. DB cũ nâng bằng migration 002 sau backup/review; giữ Google users/sessions, không chạy schema.sql trên dữ liệu thật.


ADR-024: migration [006](../database/migrations/006-consolidate-ticket-attendees.sql) gộp attendee vào booking_items, bỏ bảng 1:1 và cột events.age_tag; nhãn API vẫn giữ. Xem [rà soát](30-schema-consolidation.md).

ADR-027 / migration 007: payments thêm checkout_url (nullable), received_minor (BIGINT nonnegative mặc định 0, số tiền thực nhận độc lập expected amount_minor) và last_polled_at (nullable); index phục hồi polling. Reuse payments/payment_webhooks/outbox/tickets/check_ins, không thêm bảng. Chi tiết và kiểm chứng local/fresh/upgrade ở [32](32-payos-booking-ticket-flow.md).

ADR-029: migration008 thêm registration_role/onboarding_completed_at/favorite_categories/preferred_city vào Users, rename Organization contact/applicant và Membership member identity metadata, thêm PENDING. Migration009 thêm event_sessions.pricing_config nullable JSON array để lưu draft pricing; approval tạo SessionSeat trong transaction. Không bảng mới, không copy lịch sử giao dịch; ERD bổ sung tại Docs/08. DB local chưa chạy008/009, fresh/upgrade có seed đã kiểm chứng.

Migration010: questionnaire table dùng UNIQUE partial status ACTIVE; User FK giữ version đã trả lời, JSON answers chỉ custom. Publish archive/insert/audit/idempotency trong một transaction; onboarding khóa SHARE version trước role grant. Fresh/upgrade có dữ liệu qua, không thay DB local. Docs/35.

## Hoàn tiền/feedback — ADR-032/012

Refunds dùng lại, thêm version/decision/evidence/recording fields. Một bảng feedback chung ORGANIZATION/SYSTEM, CHECK target/status/stars/reply/history, FK event/org, unique author/event, index theo author/org/admin. History là dữ liệu phiên bản trên cùng entity, không đưa vào DTO/audit text. SupportReports giữ scope event/booking và chỉ report đang được giao mới cho Admin can thiệp refund. Schema/local46 bảng; ERD phần bổ sung và API [37](37-refunds-reviews-app-feedback.md).

## Organizer operations — ADR-034/013

CONTENT CHECK snapshot title/description/version; unique partial event_id khi CONTENT PENDING. Cancellation metadata nguyên bộ và chỉ đi cùng CANCELLED khi có cancelled_at; dữ liệu legacy CANCELLED có thể chưa metadata. Notification unique recipient/type/event/version, notification follow cũ giữ index unversioned. Không thêm bảng; dùng refunds full_refund_guard hiện có để không tạo trùng khoản hoàn do hủy. Worker cursor và xử lý một allocation cùng transaction, rollback/retry15 giây; lockUsers KEY SHARE trước quota để FK notifications/refunds không đảo User/aggregate lock. [38](38-organizer-sales-operations.md), migration013 đã apply local sau backup.


## Migration014 / ADR-035 — 2026-10-14

organization_blocks: PK(user_id,organization_id), FK Users/Organizations không cascade, index(organization_id,user_id). Không dùng follows để lưu block vì ẩn không được ngầm follow/mute. Metadata DB local đã đối chiếu trước thiết kế. Fresh47 bảng; readiness cần014. Gỡ dùng events.status ARCHIVED và audit/report hiện có; notice/sessions dùng lại bảng hiện tại. ERD, migration/rollback/khóa/test tại Docs40.

## Migration015 — public event search outbox

Local đã áp dụng sau backup verified, không chạy lại. Schema fresh/upgrade007–015 khớp, vẫn47 bảng; không cột/bảng/index PG mới. enqueue_search_event(bigint),5 trigger functions và5 triggers trên events/event_sessions/organizations/venues/event_categories; dedupe event/pg_current_xact_id, type SEARCH_EVENT_SYNC dùng outbox hiện có. Payload không PII. Đồng bộ index ngoài transaction mạng; backup/khôi phục/contract tại [Docs41](41-home-event-search.md).

## Migration016 — khu outdoor

Sau015: additive mode/zone fields/inventory XOR/FK/unique/index/trigger,47 bảng. Backfill admission QUANTITY và giữ timestamps; không tạo inventory cho catalog demo cũ. Fresh/upgrade kiểm tra cùng metadata; readiness đòi validate_zone_inventory(). Không nới các CHECK allocation/payment/ticket cũ. [DDL/ERD/khóa/vận hành/kiểm chứng](42-outdoor-zone-ticketing.md).
