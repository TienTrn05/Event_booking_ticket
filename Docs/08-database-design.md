# 08. Thiết kế cơ sở dữ liệu

> Quyết định hiện hành 2026-10-11: ADR-028 dùng một FE với ba khu vực; ADR-029 cho chọn Customer hoặc Organizer khi onboarding bằng Google/email cá nhân. Không còn yêu cầu domain/phiên công ty để vận hành Organizer. Vai trò, tên, giới tính và ngày sinh bắt buộc; sở thích/thành phố/theo dõi có thể bỏ qua. Organizer không tự nhận Customer; tạo nháp ngay, Admin vẫn duyệt tổ chức và sự kiện trước mở bán. Các đoạn mô tả cơ chế cũ dưới đây được thay thế trong phạm vi này. Xem [33](33-registration-onboarding.md) và [34](34-organizer-event-api.md).

## Quy ước

ADR-031/011: Organization chứa public_id/avatar_url/summary/category_label/featured_rank và profile timestamps nullable theo CHECK nguyên bộ. Event chứa metadata công bố và publication timestamps, CHECK nguyên bộ/giá/currency/admission/status. Không còn organization_profiles/event_publications sau migration011. Giữ cover_image_url riêng cho ảnh nháp và publication_cover_image_url cho ảnh công bố. DTO công khai riêng; ERD phần thay đổi tại [36](36-schema-audit.md).

Thiết kế logic theo [23](23-organization-review-seatmap.md), bổ sung profile/follow/tuổi/attendee ADR-023. [database/schema.sql](../database/schema.sql) có46 bảng sau ADR-032: gộp hai extension catalog vào organizations/events, thêm onboarding_questionnaires và feedback chung; xem [36](36-schema-audit.md). Database cũ nâng cấp bằng migration phù hợp sau backup/review; không chạy lại schema. PostgreSQL; phiên bản production cần chốt Q-016 và phải thực thi CHECK. API biểu diễn BIGINT ID và tiền thành chuỗi; timestamp UTC, FK lịch sử RESTRICT.

Users thêm gender/DOB nullable private; event minimum_age nullable và ageTag tính từ minimum_age ở query/DTO. Notification hỗ trợ event_id/type mới, giữ review FK/dedupe. Follows PK(User,Organization), preference; BookingItem chứa thông tin từng người, dùng lại attendee_name_snapshot, CCCD mã hóa và marker purge 30 ngày sau suất. Chi tiết và ERD phần mới tại [29](29-profile-follow-age-attendees.md).

Tiền `BIGINT` đơn vị nhỏ nhất + currency `CHAR(3)`, API dùng chuỗi số; CHECK amount >= 0, xử lý BigInt/decimal chính xác. Không mặc định mọi currency có hai chữ số thập phân. Identity unique theo provider/subject; không unique email User hoặc tự merge theo email. Token hash kiểu binary với unique index. Trạng thái dùng chuỗi có CHECK/lookup được quản lý bằng migration. Các giá trị bắt buộc NOT NULL, optional được ghi rõ bên dưới; không dùng NULL để biểu diễn trạng thái chưa được thiết kế.

## Danh mục thực thể

PK của mọi hàng là `id` trừ bảng nối ghi rõ composite PK. “UQ” = unique; các FK đều có chỉ mục đơn hoặc nằm đầu chỉ mục ghép.

| Thực thể / mục đích | Cột chính và FK | Ràng buộc / unique | Index truy vấn ngoài PK/UQ/FK |
| --- | --- | --- | --- |
| User — tài khoản | display_name, status, auth_version; email/phone đã xác minh qua identity | Identity unique ở ExternalIdentity; không password_hash bắt buộc; status ACTIVE/BLOCKED | `(status,created_at,id)` quản trị |
| Role — nhóm quyền | code, name | UQ code | Không thêm |
| Permission — thao tác | code, description | UQ code | Không thêm |
| UserRole — vai trò được cấp | PK `(user_id,role_id)`; FK User, Role; granted_by FK User nullable khi bootstrap | Không trùng cặp | `(role_id,user_id)` tìm theo vai trò |
| RolePermission — ánh xạ quyền | PK `(role_id,permission_id)`; FK Role, Permission | Không trùng cặp | `(permission_id,role_id)` kiểm tra phụ thuộc |
| EventCategory — danh mục | name, slug, is_active | UQ slug | Không thêm |
| Event — nội dung | organization_id FK Organization, created_by FK User, category_id FK EventCategory, title, slug, description, status, version | UQ slug; trạng thái DRAFT/PENDING_REVIEW/REJECTED/PUBLISHED/BLOCKED/CANCELLED/ARCHIVED | `(status,category_id,id)`, `(organization_id,created_at,id)`, `(status,title,id)` tìm prefix |
| Venue — catalog địa điểm | name, address, city, timezone, bounds, max_capacity, status, version | Không owner_id Organizer; CHECK capacity > 0; geometry validate service | (city,id) |
| LayoutSection — khu trong layout | layout_id FK SeatLayout, code, name | UQ (layout_id,code) | FK layout |
| LayoutRow — hàng trong khu | section_id FK LayoutSection, code | UQ (section_id,code) | FK section |
| Seat — vị trí ghế trong layout | row_id FK LayoutRow, layout_id FK SeatLayout, number, map_x/map_y, width/height | UQ (row_id,number); composite scope layout; không coi là ghế vật lý dùng chung venue | FK layout/row |
| EventSession — suất diễn | event_id FK Event, venue_id FK Venue, layout_id FK SeatLayout, starts_at, ends_at, timezone, sale_opens_at, sale_closes_at, counter_opens_at/closes_at, admission_opens_at/closes_at, status, version | CHECK ends_at > starts_at, sale_closes_at > sale_opens_at; status SCHEDULED/CANCELLED/COMPLETED | `(event_id,status,starts_at)`, `(venue_id,starts_at,ends_at)` kiểm tra lịch |
| SessionSeat — tồn kho suất | session_id FK EventSession, seat_id FK Seat, layout_id scope, ticket_type_id FK TicketType, price_minor, currency, status, hold_id FK SeatHold nullable, current_booking_id FK Booking nullable, hold_expires_at nullable, version | UQ `(session_id,seat_id)`; CHECK tổ hợp trạng thái bên dưới | `(session_id,status,price_minor)`, `(status,hold_expires_at)`, `(hold_id,id)`, `(current_booking_id,id)` |
| SeatHold — nhóm giữ | customer_id FK User, session_id FK EventSession, status, expires_at | ACTIVE/CONVERTED/RELEASED/EXPIRED; expiry sau created_at | `(status,expires_at,id)`, `(customer_id,status,id)` |
| SeatHoldItem — giá đã báo | hold_id, session_seat_id, session_id qua composite FK, price_minor, currency | UQ `(hold_id,session_seat_id)`; price >= 0; cùng session ở hai FK | `(session_seat_id,session_id)` giữ lịch sử |
| Booking — đơn | customer_id FK User, session_id/event_id scope FK EventSession/Event, hold_id FK SeatHold, status, total_minor, currency, expires_at, confirmed_at nullable, confirmed_payment_id nullable | UQ hold_id; FK cùng chủ/suất hold; FK khoản xác nhận cùng booking; tổng tính tại service | `(customer_id,created_at,id)`, `(status,expires_at,id)`, `(session_id,status,id)` |
| BookingItem — dòng đơn | booking_id, session_seat_id, session_id qua composite FK, price_minor, currency, seat_label_snapshot, attendee_name_snapshot, ticket_type_code/name_snapshot | UQ `(booking_id,session_seat_id)`; cùng session ở hai FK | `(session_seat_id,session_id)` tra lịch sử |
| Ticket — quyền vào cửa | booking_item_id, session_seat_id qua composite FK, ticket_code_hash/ciphertext, ticket_key_version, status, admission_check_in_id FK CheckIn nullable, admitted_at/by nullable | UQ booking_item_id, ticket_code_hash; UQ active_seat_guard cho VALID/USED; USED cần CheckIn cùng vé và thời gian/người quét | `(status,id)` job expiry; `(admitted_by,admitted_at)` audit |
| Payment — attempt | booking_id FK Booking, provider, provider_reference nullable, provider_key, amount_minor, currency, status, reconciliation_status, reconciliation_reason nullable | UQ `(provider,provider_reference)` và `(provider,provider_key)`; active guard bên dưới | `(booking_id,created_at,id)`, `(status,updated_at,id)`, `(reconciliation_status,updated_at,id)` |
| Refund — khoản hoàn | payment_id FK Payment, requested_by FK User nullable cho System, approved_by FK User nullable, support_report_id FK SupportReport nullable, type, status, amount_minor, reason, provider, provider_key, provider_reference nullable | UQ `(provider,provider_key)`; UQ `(provider,provider_reference)`; số tiền > 0; full-refund guard bên dưới | `(payment_id,status,id)`, `(status,updated_at,id)` |
| AuthSession — phiên thiết bị | user_id FK User, identity_id FK ExternalIdentity, authenticated_at, family_id, expires_at, revoked_at nullable, device_label nullable | UQ family_id | `(user_id,revoked_at,id)`, `(expires_at,id)` |
| RefreshToken — token luân chuyển | session_id FK AuthSession, parent_id FK RefreshToken nullable, token_hash, expires_at, used_at nullable, revoked_at nullable | UQ token_hash; UQ parent_id để một token có tối đa một con | `(session_id,id)`, `(expires_at,id)` |
| OtpChallenge — login/verify OTP | channel, purpose, target_canonical, target_hash, code_mac, expires_at, attempts, used_at, user_id nullable | Phạm vi challenge/identity; code không lưu rõ; consume nguyên tử, HMAC key ngoài DB | (target_hash,purpose,created_at), expiry |
| IdempotencyRecord — chống lặp | actor_scope, operation, key, request_hash, resource_type, resource_id nullable, response_code nullable, expires_at | UQ `(actor_scope,operation,key)`; scope System tách riêng Customer | `(expires_at,id)` cleanup |
| PaymentWebhook — hộp nhận callback | provider, provider_event_id, payment_id FK Payment nullable, payload_hash, normalized_payload, status, attempts, last_error_code nullable, received_at, processed_at nullable | UQ `(provider,provider_event_id)`; dữ liệu chuẩn hóa đủ replay, không lưu bí mật/raw payload | `(status,received_at,id)` retry |
| OutboxMessage — công việc sau commit | type, aggregate_type/id/version, dedupe_key, payload_minimal, status, attempts, available_at, lease_until/token nullable, last_error_code nullable | UQ dedupe_key; PROCESSING cần expiry/token; ack có điều kiện token hiện hành | `(status,available_at,id)`, `(status,lease_until,id)` thu hồi lease |
| AuditLog — lịch sử nghiệp vụ | actor_type, actor_id FK User nullable, organization_id/support_report_id FK nullable, action, resource_type, resource_id, request_id, reason nullable, before_redacted nullable, after_redacted nullable | Append-only; resource đa hình không FK, không xóa cứng tài nguyên lịch sử | `(resource_type,resource_id,created_at)`, `(actor_id,created_at)`, `(request_id)` |

### Thực thể mới cho yêu cầu đã chốt

| Thực thể | Trường/quan hệ | Bất biến DB và service |
| --- | --- | --- |
| ExternalIdentity | user_id, provider GOOGLE/PHONE/COMPANY_EMAIL, subject/canonical_target, verified_at | UQ(provider,subject); không tự merge khi trùng email; một identity không thuộc hai User |
| Organization | name, contact_domain, applicant_identity_id/provider, status, version, reviewed_by/at | Identity cá nhân đã xác minh; contact domain chỉ metadata. Admin duyệt tổ chức trước mở bán |
| OrganizationMembership | organization_id,user_id,member_identity_id/provider,status,approved_by/at | UQ(org,user); identity thuộc đúng User. PENDING soạn nháp, ACTIVE trong Organization APPROVED mới vận hành |
| ReservationQuota | customer_id,session_id | Composite PK; khóa FOR UPDATE trước Event; không cần cached counter, đếm phân bổ hiện hành dưới khóa |
| SeatLayout | organization_id,event_id,venue_id,venue_version,version,status DRAFT/FROZEN,geometry_json,bounds_snapshot,capacity_snapshot | UQ(id,event_id,venue_id) cho scope FK session; frozen bất biến; layout cùng Organization với Event |
| TicketType | session_id,code,name | UQ(session_id,code), scope FK SessionSeat; snapshot code/name vào item |
| EventReview | event_id,event_version,submitted_by/at,expires_at,earliest_session_starts_at,submission_cutoff_at,calendar_timezone,snapshot_json,status,decided_by/at | UQ(event_id,event_version); nullable pending guard UQ(event_id) cho PENDING; status transition/time ở service |
| ReasonNotice | review_id,reason_code,reason_text,guidance,status DRAFT/SENT,authored_by,sent_at | Một phiếu chính/review; SENT cần actor/text/time; phiếu đã gửi không sửa, message gửi thêm lưu riêng |
| Notification | recipient_user_id,type,review_id,reason_notice_id nullable,payload_redacted,read_at | UQ(recipient,type,review_id) cho notice chính; ghi cùng transaction/outbox; không phụ thuộc email |
| SupportReport | reporter_id,event_id,booking_id nullable,reason,status,assigned_admin_id | Scope rõ, booking nếu có phải thuộc event; UQ/FK phù hợp, không polymorphic scope không kiểm tra |
| CheckIn | ticket_id,method ONLINE/COUNTER,actor_id,checked_in_at | UQ ticket_id; không chuyển Ticket USED; actor khách đúng booking hoặc membership quầy đúng event |

Ticket mã nhập tay và QR dùng cùng secret ngẫu nhiên dưới hai cách biểu diễn để tránh hai nguồn quyền; hash lookup và ciphertext phục vụ chủ vé xem lại, không log. CheckIn tồn tại không thay kiểm tra VALID khi vào cửa. DDL dùng admitted_at/by và admission_check_in_id cho USED; CheckIn có checked_in_at riêng.

Các aggregate reference đa hình của audit/outbox/idempotency không có FK; service ghi trong transaction với tài nguyên tương ứng, job xử lý tài nguyên không tồn tại một cách tường minh. DDL thêm các FK vòng Booking–Payment, Ticket–CheckIn, Event–EventReview sau CREATE TABLE.

`IdempotencyRecord.request_hash` chứa hash request chuẩn hóa bao gồm route target và payload theo [09](09-api-design.md); không cần thêm cột target hoặc đổi unique scope hiện có. Metadata recovery phía trình duyệt không thay thế record DB và không có quyền tự xác nhận kết quả.

## Ràng buộc quan trọng

- AVAILABLE: hold_id, current_booking_id, hold_expires_at đều NULL.
- HELD: hold_id và hold_expires_at NOT NULL; current_booking_id NULL trước checkout, có giá trị sau checkout.
- SOLD: current_booking_id NOT NULL, hold_id và hold_expires_at NULL.
- Session-seat phải thuộc layout frozen của session, layout đúng venue/event/Organization; composite FK scope và service kiểm tra dưới khóa. Bản vật lý dùng composite FK để bắt buộc booking cùng chủ/suất hold và items cùng session; các cột scope lặp được DB ràng buộc. Giá, tổng tiền và trạng thái liên bảng vẫn cần service.
- Không đặt UQ riêng trên `BookingItem.session_seat_id`: đơn hết hạn phải giữ lịch sử nhưng ghế được mua lại. Phân bổ hiện tại do một hàng SessionSeat duy nhất quyết định; vé một lần/booking item được bảo vệ bằng UQ.
- Payment dùng generated nullable `pending_booking_guard` để bảo vệ tối đa một attempt chờ. Không dùng successful_booking_guard: mọi khoản thực nhận phải lưu được, kể cả khoản thừa. Booking chọn một confirmed_payment_id qua FK đúng booking; các SUCCESS không được chọn cần đối soát. Xem ADR-011.
- MVP refund toàn bộ dùng generated guard payment_id cho REQUESTED/PROCESSING/FAILED/SUCCESS, NULL cho REJECTED; UQ ngăn nhiều yêu cầu hoàn toàn bộ cùng khoản. FAILED retry cùng hàng. Hoàn một phần cần thay thiết kế này, kiểm tra tổng dưới khóa payment và ledger riêng.
- Quyền vé khi hoàn/hủy và SessionSeat phải đổi cùng transaction. UQ generated active_seat_guard trên Ticket chặn hai vé VALID/USED cùng session-seat; join vẫn cần để kiểm tra vé khớp phân bổ hiện tại và booking đã trả tiền.

## Quan hệ

```mermaid
erDiagram
    User ||--o{ OrganizationMembership : represents
    Organization ||--o{ OrganizationMembership : authorizes
    Organization ||--o{ Event : organizes
    Event ||--o{ EventReview : submits
    EventReview ||--o| ReasonNotice : explains
    Event ||--o{ SeatLayout : designs
    Venue ||--o{ SeatLayout : bounds
    User ||--o{ Booking : buys
    User ||--o{ SeatHold : holds
    EventCategory ||--o{ Event : categorizes
    Event ||--o{ EventSession : schedules
    Venue ||--o{ EventSession : hosts
    SeatLayout ||--o{ LayoutSection : contains
    LayoutSection ||--o{ LayoutRow : contains
    LayoutRow ||--o{ Seat : contains
    SeatLayout ||--o{ EventSession : configures
    EventSession ||--o{ SessionSeat : inventories
    Seat ||--o{ SessionSeat : reused_across_sessions
    SeatHold ||--|{ SeatHoldItem : contains
    SessionSeat ||--o{ SeatHoldItem : history
    SeatHold ||--o| Booking : converts
    Booking ||--|{ BookingItem : contains
    SessionSeat ||--o{ BookingItem : history
    BookingItem ||--o| Ticket : issues
    Ticket ||--o| CheckIn : preregisters
    EventSession ||--o{ TicketType : categorizes
    TicketType ||--o{ SessionSeat : prices
    User ||--o{ ExternalIdentity : authenticates
    Booking ||--o{ Payment : attempts
    Payment ||--o{ Refund : refunds
    User ||--o{ AuthSession : opens
    AuthSession ||--o{ RefreshToken : rotates
    User ||--o{ UserRole : assigned
    Role ||--o{ UserRole : grants
    Role ||--o{ RolePermission : includes
    Permission ||--o{ RolePermission : maps
```

Quan hệ Ticket ownership đi qua BookingItem → Booking → Customer (không lặp customer_id trên Ticket). EventSession và Seat là N:M qua SessionSeat. User–Role và Role–Permission là N:M. Một BookingItem có 0 hoặc 1 Ticket; sau xác nhận phải có đúng 1.

## Chuẩn hóa và chỉ mục

Mô hình hướng 3NF: venue/layout/section/row tách riêng, permission/role tách riêng. Ngoại lệ có chủ đích: giá và nhãn ghế snapshot trên item để lịch sử không đổi; booking total để đối soát (luôn kiểm tra tổng); SessionSeat lưu trạng thái phân bổ và expiry để khóa/scan nhanh; Refund lặp provider từ Payment để tạo unique theo namespace nhà cung cấp. Mọi dữ liệu lặp được ghi cùng transaction và kiểm tra khớp nguồn, không coi là nguồn độc lập.

Chỉ mục ghép đặt cột lọc bằng trước rồi khoảng thời gian/ID khi phù hợp. Không thêm index mọi cột: mỗi index làm ghi/khóa tốn hơn. Đo EXPLAIN với event nhiều suất/ghế và phân bố trạng thái thực. Dùng truy vấn phân trang tránh N+1; SQL thống kê không khóa bảng tồn kho lâu.

QR là opaque token ngẫu nhiên; hash để lookup, ciphertext mã hóa bằng key riêng để chủ vé xem lại QR. Tách key khỏi DB, không log ciphertext/token và phải có phương án xoay key. Phương án token ký không cần ciphertext được xem trong ADR-007, chưa dùng đồng thời hai thiết kế.

ADR-021 thêm EMAIL Customer và phone_login_aliases trỏ EMAIL identity, không proof PHONE. otp_challenges thêm EMAIL/login_phone/delivery_ready. Xem SQL, ERD identity, Docs 20 và migration 002.


ADR-024: migration [006](../database/migrations/006-consolidate-ticket-attendees.sql) gộp attendee vào booking_items, bỏ bảng 1:1 và cột events.age_tag; nhãn API vẫn giữ. Xem [rà soát](30-schema-consolidation.md).

ADR-027 / migration 007: payments thêm checkout_url (nullable), received_minor (BIGINT nonnegative mặc định 0, số tiền thực nhận độc lập expected amount_minor) và last_polled_at (nullable); index phục hồi polling. Reuse payments/payment_webhooks/outbox/tickets/check_ins, không thêm bảng. Chi tiết và kiểm chứng local/fresh/upgrade ở [32](32-payos-booking-ticket-flow.md).

## Bổ sung trường ADR-029 / migration008–009

Không thêm bảng, quan hệ cũ giữ nguyên. Vai trò đăng ký không thay user_roles; giá nháp không thay inventory sau duyệt.

```mermaid
erDiagram
    User {
        varchar registration_role
        timestamptz onboarding_completed_at
        varchar_array favorite_categories
        varchar preferred_city
        varchar gender
        date date_of_birth
    }
    Organization {
        varchar contact_domain
        bigint applicant_identity_id
        varchar applicant_identity_provider
    }
    OrganizationMembership {
        bigint member_identity_id
        varchar member_identity_provider
        varchar status
    }
    EventSession {
        jsonb pricing_config
    }
    User ||--o{ OrganizationMembership : member
    Organization ||--o{ OrganizationMembership : owns
    Organization ||--o{ Event : owns
    Event ||--o{ EventSession : schedules
    EventSession ||--o{ SessionSeat : materializes_after_approval
```

ADR-030: onboarding_questionnaires(id,questions JSONB,status,created_by,created_at) lưu phiên bản form dùng chung; Users thêm onboarding_questionnaire_id FK nullable và onboarding_answers JSONB object. User N:1 Questionnaire; không bảng answers1:1 hoặc duplicate category/city/follow. Fresh47 bảng; DB local46 chưa apply010.

```mermaid
erDiagram
    User {
        bigint onboarding_questionnaire_id FK
        jsonb onboarding_answers
    }
    OnboardingQuestionnaire {
        bigint id PK
        jsonb questions
        varchar status
        bigint created_by FK
        timestamptz created_at
    }
    OnboardingQuestionnaire o|--o{ User : answered_version
    User o|--o{ OnboardingQuestionnaire : authored
```

## Hoàn tiền/feedback — ADR-032/012

Refunds dùng lại, thêm version/decision/evidence/recording fields. Một bảng feedback chung ORGANIZATION/SYSTEM, CHECK target/status/stars/reply/history, FK event/org, unique author/event, index theo author/org/admin. History là dữ liệu phiên bản trên cùng entity, không đưa vào DTO/audit text. SupportReports giữ scope event/booking và chỉ report đang được giao mới cho Admin can thiệp refund. Schema/local46 bảng; ERD phần bổ sung và API [37](37-refunds-reviews-app-feedback.md).

## Organizer operations — ADR-034/013

Đã áp dụng DB local, vẫn46 bảng. Dùng event_change_requests CONTENT snapshot với event_version/version/decision_reason và pending unique; events có cancelled_by/cancelled_at/cancellation_reason; notifications có event_version/type EVENT_CANCELLED/EVENT_UPDATED và dedupe người/event/version. Refund COMPENSATION dùng lại cho hủy toàn bộ đơn, không thêm ledger/table dư/thiếu. FK/ERD bổ sung hiện hành tại [38](38-organizer-sales-operations.md); schema.sql và migration013 khớp metadata fresh/upgrade. Demo003 là dữ liệu fixture có12 session_seats, không role/session/payment mới.


## Organization blocks — ADR-035 / 2026-10-14

Migration014 thêm organization_blocks(user_id,organization_id,created_at), PK composite/FK Users/Organizations/index reverse. Vòng đời ẩn cá nhân độc lập follow/mute, không1:1/copy profile/credential/đơn/vé. Fresh47 bảng sau014. Gỡ event dùng ARCHIVED và audit/report đã có, không thêm bảng compensation. ERD hiện hành tại Docs40.

## Search projection — ADR-036 / migration015

Không thêm bảng/cột hoặc quan hệ ERD mới: dùng OutboxMessages type SEARCH_EVENT_SYNC aggregate EVENT/payload rỗng; functions/triggers event/session/org/venue/category và enqueue backfill cùng PG transaction. Local/fresh vẫn47 bảng. ES document public theo session là projection dựng lại được, không bản sao auth/booking/payment/attendee. [Docs41](41-home-event-search.md).

## Outdoor inventory — ADR-037/migration016

Vẫn47 bảng: events/seat_layouts thêm ticketing_mode; layout_sections thêm capacity/geometry_json; session_seats XOR seat_id indoor hoặc section_id/inventory_number outdoor, FK section/layout và unique ordinal + trigger giới hạn capacity. Không physical seats/rows giả và không kho/counter thứ hai. ERD bổ sung/hợp đồng/khóa/backup tại [Docs42](42-outdoor-zone-ticketing.md).
