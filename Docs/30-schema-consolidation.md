# Rà soát bảng/cột — 2026-10-11

Cập nhật2026-10-12 / ADR-031: đã gộp organization_profiles vào organizations, event_publications vào events và áp dụng008–011 DB local sau backup. Local/fresh45 bảng, giữ dữ liệu và ảnh công khai. Chi tiết [36](36-schema-audit.md).

Theo yêu cầu chủ dự án, đối chiếu metadata DB local (47 bảng trước sửa), schema.sql, migration, repository query và thiết kế nghiệp vụ. Không coi bảng chưa có endpoint hoặc chưa có dữ liệu là bảng thừa.

## Phần dọn — ADR-024

| Phần cũ | Kết quả |
| --- | --- |
| ticket_attendees gắn 1:1 booking_items | Gộp vào booking_items, bỏ bảng sau chuyển dữ liệu |
| ticket_attendees.full_name và booking_items.attendee_name_snapshot | Dùng một nguồn tên attendee_name_snapshot; migration từ chối khi hai bản khác nhau |
| events.age_tag generated từ minimum_age | Bỏ cột; query trả ageTag như cũ, null hoặc 18+ |
| Timestamp của bảng attendee riêng | Không giữ vòng đời bảng riêng; giữ updated_at trên item, chuyển giá trị cập nhật cũ |

BookingItem thêm attendee_date_of_birth, attendee_phone, nhóm cột CCCD mã hóa/HMAC/last four/key version/retention và identity_verified_at/by. Các cột nullable cho item chưa khai báo; CHECK không cho lưu một bộ thông tin dở dang. Họ tên vẫn bắt buộc theo schema cũ. Giữ guard CONFIRMED/USED, quyền, scope, audit, contract response và retention 30 ngày. Khi xác minh staff khóa item FOR UPDATE vì dữ liệu nay nằm trên item; purge cũng khóa item theo batch.

Migration [006](../database/migrations/006-consolidate-ticket-attendees.sql) áp dụng sau 005, có lock timeout, khóa các bảng liên quan, kiểm tra xung đột, chuyển dữ liệu, thay guard rồi DROP trong một transaction. Không sửa migration đã áp dụng. DB mới dùng schema.sql (46 bảng), không chạy migration riêng. Khôi phục bằng backup trước 006 và source tương ứng; không chạy lại schema.sql trên DB có dữ liệu.

## Các nhóm giữ lại sau đối chiếu

| Nhóm | Lý do giữ |
| --- | --- |
| users, roles, permissions, user_roles, role_permissions | Hồ sơ và quyền tường minh; bảng ánh xạ không trùng thực thể |
| external_identities, phone_login_aliases, otp_challenges, auth_sessions, refresh_tokens | Danh tính, alias, proof một lần, phiên và rotation là các vòng đời riêng |
| organizations, organization_memberships, organization_follows | Tổ chức, quyền đại diện, catalog công khai và quan hệ theo dõi riêng |
| events, event_categories, event_sessions, event_change_requests | Nội dung, phân loại, cấu hình công bố, lịch suất và yêu cầu thay đổi riêng |
| venues, city_profiles, seat_layouts, layout_sections, layout_rows, seats, ticket_types, session_seats | Catalog địa điểm/thành phố, sơ đồ hình học và tồn kho/giá theo suất riêng |
| reservation_quotas, seat_holds, seat_hold_items, bookings, booking_items | Khóa theo quota, giữ tạm và lịch sử đơn; giá/ghế/loại vé snapshot không phải dữ liệu dư |
| payments, payment_webhooks, refunds, idempotency_records | Giao dịch, inbox provider, hoàn tiền và replay khác mục đích |
| tickets, check_ins | Credential/trạng thái vé khác việc check-in online/quầy; admission không phải cùng bước với check-in |
| event_reviews, reason_notices, notifications, support_reports, audit_logs, outbox_messages | Review, phiếu lý do, inbox, report, audit và công việc bền vững không thay thế nhau |
| merchandise_products, blog_articles | Sản phẩm và nội dung catalog riêng; luồng mua merchandise còn chưa triển khai |

Các cột cùng tên không mặc nhiên là dư: DOB hồ sơ khác DOB của ba người tham dự; SĐT attendee khác alias login; tên/giá/ghế snapshot cần giữ lịch sử; events.cover_image_url là ảnh nháp/upload còn events.publication_cover_image_url là dữ liệu công bố/catalog; venue timezone khác timezone chụp cho suất/review. Nhóm ciphertext/MAC/last four phục vụ mã hóa, so khớp và che số, đều được purge theo retention. Không xóa cột riêng chỉ vì chưa có UI.

## Bằng chứng

45 kiểm tra PostgreSQL qua trên hai DB tạm: schema mới 46 bảng; upgrade có dữ liệu giả giữ nguyên ciphertext/MAC/SĐT; xung đột tên rollback; response giữ masking; thiếu dữ liệu/chưa đủ tuổi không confirm; staff proof và purge hoạt động; nhãn tuổi null/18+ giữ nguyên. Các DB tạm được drop trong finally. Kết quả áp dụng local và kiểm tra code được ghi trong [log](26-auth-progress.md).
