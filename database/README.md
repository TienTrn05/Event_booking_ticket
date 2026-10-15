# PostgreSQL database

Schema hiện hành có **46 bảng**: 38 bảng lõi, 6 bảng catalog, alias SĐT ADR-021, organization_follows ADR-023. Backend đọc trực tiếp PostgreSQL qua `pg`; ID `BIGINT` và tiền minor unit vẫn được trả về API dưới dạng chuỗi để không mất độ chính xác trong JavaScript.

Ảnh upload mới lưu ở Cloudflare R2; DB chỉ lưu URL theo ADR-022. Database cũ cần [migration 003](migrations/003-r2-images.sql) sau backup/review; database mới dùng schema.sql đã có hai cột nullable. Chi tiết và kết quả local ở [Docs/28](../Docs/28-r2-image-upload.md).

## Các file

Migration [004](migrations/004-profile-follow-notifications.sql) thêm hồ sơ/follow và mở rộng notification, [005](migrations/005-event-age-ticket-attendees.sql) thêm tuổi event và attendee/CCCD riêng mỗi vé. Đã backup/review/migrate local; DB mới dùng schema.sql, không chạy lại các migration đã có. [Docs/29](../Docs/29-profile-follow-age-attendees.md) có ERD mới, key/retention và cách chạy worker. Không thu giấy tờ thật để thử.

| File | Mục đích |
| --- | --- |
| [schema.sql](schema.sql) | Tạo mới toàn bộ 46 bảng theo ADR-023, PK/FK/UQ/CHECK/index và trigger |
| [001-reference-data.sql](seeds/001-reference-data.sql) | Nạp 3 role, 29 permission và ánh xạ quyền |
| [002-public-catalog.sql](seeds/002-public-catalog.sql) | Nạp dữ liệu demo liên kết đầy đủ cho Public Web, gồm cả venue |
| [001-public-catalog.sql](migrations/001-public-catalog.sql) | Nâng schema PostgreSQL 38 bảng lõi theo ADR-014 lên 44 bảng |
| [queries](queries) | Query vận hành và audit, dùng tham số có tên của DBeaver |

## Tạo database bằng DBeaver

Yêu cầu PostgreSQL **16 trở lên**. Các script đã được chạy kiểm tra trên PostgreSQL **18**.

1. Tạo một PostgreSQL connection trong DBeaver.
2. Mở connection, nhấp phải **Databases → Create New Database**.
3. Đặt tên `event_ticketing`, encoding `UTF8`. Ở local có thể dùng cùng user cho DDL và Backend; khi triển khai thực tế dùng tài khoản DDL riêng.
4. Nhấp phải database vừa tạo → **SQL Editor → Open SQL Script**.
5. Mở và chạy từng file theo đúng thứ tự bên dưới bằng **Execute SQL Script** (`Alt+X`).

Database mới, rỗng:

```text
database/schema.sql
database/seeds/001-reference-data.sql
database/seeds/002-public-catalog.sql  (tùy chọn, chỉ để demo)
```

Database PostgreSQL cũ đã có **đúng schema 38 bảng lõi ADR-014**:

```text
database/migrations/001-public-catalog.sql
database/seeds/001-reference-data.sql  (nếu chưa nạp quyền)
database/seeds/002-public-catalog.sql  (tùy chọn, chỉ để demo)
```

Không chạy migration sau `schema.sql`, vì sáu bảng catalog đã có sẵn. Không chạy `schema.sql` trên database đã có dữ liệu. Nếu schema cũ không khớp ADR-014, cần lập migration riêng sau khi đối chiếu và sao lưu; số lượng 38 bảng một mình không đủ để xác nhận tương thích. Seed `002` dùng ID từ `900000`, chỉ dành cho database local/demo và có thể chạy lại; không nạp vào staging/production hay database có dữ liệu thật. Seed chứa lịch sự kiện cố định năm 2026, nên cần cập nhật lịch demo khi dùng về sau.

Mỗi script tự đặt UTF-8 và timezone UTC, không chứa `CREATE DATABASE` hoặc lệnh đổi sang database khác. Vì vậy database đang được chọn trong thanh công cụ SQL Editor của DBeaver chính là nơi nhận dữ liệu.

## Chạy bằng psql

Từ thư mục gốc dự án:

```powershell
psql -U postgres -d event_ticketing -v ON_ERROR_STOP=1 -f database/schema.sql
psql -U postgres -d event_ticketing -v ON_ERROR_STOP=1 -f database/seeds/001-reference-data.sql
psql -U postgres -d event_ticketing -v ON_ERROR_STOP=1 -f database/seeds/002-public-catalog.sql
```

Sau đó cấu hình `BE/.env` với `DB_PORT=5432`, chạy kiểm tra chỉ đọc từ thư mục `BE/`:

```powershell
. .\scripts\use-node.ps1
npm run db:check
```

## Tham số query trong DBeaver

Các file trong `queries/` dùng cú pháp `:session_id`, `:organization_id`... Khi chạy, DBeaver mở hộp thoại **Bind parameter(s)** để nhập giá trị. Bật **Enable SQL parameters** trong SQL Editor nếu hộp thoại không hiện.

Với database ADR-014 cũ, thay lệnh `schema.sql` bằng `migrations/001-public-catalog.sql`. Bỏ lệnh seed demo nếu chỉ cần schema và quyền. Sau khi chạy, trong DBeaver hoặc psql có thể kiểm tra:

```sql
SELECT COUNT(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
-- Schema mới ADR-021: 45; database cũ trước migration 002: 44
```

## Kiểm chứng

- `schema.sql` tạo đủ 44 bảng trên một PostgreSQL 18 tạm, độc lập với database người dùng.
- Migration catalog chạy thành công trên schema lõi tối thiểu và tạo đủ 6 bảng mới.
- Hai seed chính chạy thành công hai lần liên tiếp; với database rỗng ban đầu, kết quả vẫn là 13 event, 13 publication, 10 merchandise và 3 bài viết.
- Ngày 2026-10-03, đã chạy lại schema và hai seed trên PostgreSQL 18 tạm; lần nạp catalog thứ hai không tạo hàng trùng, audit không trả vi phạm.
- Bốn query mẫu chạy thành công trên dữ liệu demo.
- Backend kết nối bằng `pg`, kiểm tra schema và thực thi toàn bộ repository catalog thành công.

Chi tiết thiết kế: [08 — Database design](../Docs/08-database-design.md), [20 — Physical SQL](../Docs/20-physical-sql-design.md), [21 — Transaction](../Docs/21-sql-transactions.md).

## Nâng auth email OTP

DB đang có 44 bảng: backup/review rồi chạy migrations/002-email-otp.sql trong DBeaver trên đúng DB. DB mới dùng schema.sql có 45 bảng; không chạy migration 002 lần nữa. Migration giữ Google users/identities/sessions. Chưa tự áp dụng lên DB người dùng. Sau khi có dữ liệu EMAIL, rollback bằng tắt SMTP/khôi phục app release và giữ dữ liệu, không drop identity/bảng. Xem Docs/27.


ADR-024: migration [006](migrations/006-consolidate-ticket-attendees.sql) gộp attendee vào booking_items, bỏ bảng 1:1 và cột events.age_tag; nhãn API vẫn giữ. Xem [rà soát](../Docs/30-schema-consolidation.md).

Migration [007](migrations/007-payos-payment.sql) thêm ba cột vào payments, không thêm bảng. DB local đã backup/review và áp dụng; schema vẫn 46 bảng. Schema fresh và upgrade đã kiểm chứng khớp; xem [Docs/32](../Docs/32-payos-booking-ticket-flow.md). Không chạy lại 007 khi schema đã có cột.

## Onboarding và cấu hình event — migration 008/009

DB đã có 007: backup trước, chạy [008](migrations/008-registration-onboarding.sql), rồi [009](migrations/009-session-pricing-config.sql) trên đúng DB. Không chạy lại khi đã có cột. DB rỗng dùng schema.sql + seed, không chạy các migration bổ sung. Schema giữ 46 bảng; migration giữ user/identity/role/lịch sử và metadata tổ chức. [Chi tiết](../Docs/33-registration-onboarding.md), [review/inventory](../Docs/34-organizer-event-api.md).

Sau008/009, backup/review rồi chạy [010](migrations/010-admin-onboarding-questions.sql) để Admin cấu hình câu hỏi và FE render động. Fresh schema đã gồm010; không chạy lại migration. Hiện local/fresh45 bảng sau áp dụng008–011 theo yêu cầu chủ dự án (ADR-031). Xem [Docs35](../Docs/35-admin-onboarding-questions.md).

## Gộp metadata catalog — migration011 / ADR-031

Đã áp dụng008/009/010/011 trên DB local theo yêu cầu chủ dự án, sau backup đã kiểm tra. DB local và fresh đều45 bảng. Không chạy lại các migration này trên DB đã nâng cấp; DB rỗng chỉ dùng schema.sql và seed hiện hành.

[011](migrations/011-merge-catalog-metadata.sql) copy toàn bộ profile/publication/public IDs/ảnh/timestamp vào organizations/events, kiểm tra bằng EXCEPT rồi DROP hai bảng extension, không CASCADE. Giữ ảnh nháp khác ảnh công bố; thay deferred outbox trigger, không phát lại thông báo cũ. Giữ identity/role assignment/đơn/tiền/vé. Backup trước008–011 nằm ở backups/before-008-011-1791740552152.dump (ngoài Git); khôi phục cùng release app cũ trên DB riêng nếu cần. Không chạy schema.sql lên DB đang có dữ liệu.

Fresh + upgrade có seed và PG/Edge25 ca đã qua. Fixture catalog-before-011.sql chỉ dùng kiểm thử upgrade, không dùng để seed DB hiện hành. Xem [Docs36](../Docs/36-schema-audit.md).

## Hoàn tiền/feedback — migration012

Đã backup trước012 và áp dụng DB local; hiện46 bảng, không chạy lại012. DB rỗng dùng schema.sql + seed. [012](migrations/012-refunds-feedback.sql) dùng refunds/reports có sẵn, thêm evidence/version và một feedback chung hai target. Không bịa chứng từ cho SUCCESS refund cũ thiếu bằng chứng; kiểm tra dữ liệu lịch sử trước nâng DB khác. Backup local backups/before-012-1791805498317.dump được xác minh pg_restore --list. Khôi phục bằng backup trên DB riêng và release trước012 khi cần; không xóa giao dịch mới để rollback. [37](../Docs/37-refunds-reviews-app-feedback.md).

## Organizer operations và demo bán vé — migration013

Đã áp dụng [013](migrations/013-organizer-operations.sql) DB local sau backup backups/before-013-1791811206992.dump (250227 bytes, pg_restore --list qua); vẫn46 bảng. Không chạy lại013. DB rỗng dùng schema.sql, DB khác backup/review rồi nâng sau012. Thêm cột vào event_change_requests/events/notifications, không bảng mới hoặc role grant.

[003-local-ticket-sales.sql](seeds/003-local-ticket-sales.sql) đã nạp local: event970001/public ID local-ticket-sales-demo, session970003,12 ghế2.000 VND/minimumAge18. Chỉ dùng local với seed002, hồ sơ APPROVED là fixture, không tài khoản Admin vận hành/phiên đăng nhập/payment mới. Chạy lặp giữ lịch/trạng thái ghế/tiền. Khôi phục bằng backup trên DB riêng và release trước013 khi cần, không xóa giao dịch mới. [API/Swagger và kiểm chứng](../Docs/38-organizer-sales-operations.md).


## Customer ẩn Organizer — migration014 / ADR-035

DB local đã áp dụng014 sau backup `backups/before-014-1791972755106.dump` (254724 bytes, pg_restore --list qua),47 bảng; fingerprint dữ liệu auth/role/đơn/vé/tiền/audit/follow giữ nguyên. **Không chạy014 lại trên DB local.** DB khác đã có013: backup/review rồi chạy migrations/014-organizer-blocks.sql một lần. DB rỗng dùng schema.sql có014,47 bảng; không chạy lại migration. Quan hệ nhiều–nhiều không đổi credential/role/đơn/vé/tiền/follow. Admin gỡ dùng ARCHIVED, không bảng compensation. Rollback app giữ preference/lịch sử, không drop dữ liệu hoặc ghi đè DB đang phục vụ. Chi tiết kiểm chứng/giới hạn runtime tại Docs26/40.

## Search sự kiện — migration015 / ADR-036

DB local đã apply015 sau backup backups/before-015-1791977547583.dump (257083 bytes, pg_restore --list qua),47 bảng; fingerprint toàn bộ bảng ngoài outbox giữ nguyên. **Không chạy015 lại trên DB local.** DB khác có014: backup/review rồi chạy015 một lần. DB rỗng dùng schema.sql có015, không chạy migration nữa. Chỉ functions/triggers/outbox jobs, không dữ liệu auth/role/đơn/vé/tiền hoặc bảng mới. Sau migration chạy BE npm run search:reindex với một tiến trình đồng bộ để tạo/backfill ES đã được duyệt. [Vận hành/khôi phục](../Docs/41-home-event-search.md).

## Outdoor — migration016

DB có015: backup/review rồi chạy016 một lần; DB rỗng dùng schema.sql đã gồm016. Dùng lại47 bảng, thêm mode/khu và inventory unit theo section/ordinal, không physical seats giả. Backfill mode giữ timestamps/historical rows, không tự cấu hình sức chứa cho catalog demo cũ. Sau khi016 đã áp dụng không chạy lại. [Schema/ERD/rollback và trạng thái thực tế](../Docs/42-outdoor-zone-ticketing.md).

Kiểm chứng cuối2026-10-14: BE97 unit/HTTP/config/architecture + lint/typecheck/build/format/secret guard qua; PG/ES59 passed/2 browser skipped. DB local đã apply016 sau backup backups/before-016-1791983829678.dump263060 bytes (pg_restore --list qua), vẫn47 bảng; fingerprint mọi giá trị lịch sử và timestamps giữ nguyên khi loại đúng các cột mới. Không chạy016 lại. Smoke health/ready200, search200/Elasticsearch, Admin health401 khi chưa login, Swagger4 outdoor paths. Fixture PG/index/API key đã dọn, BE/tmp rỗng; không provider/tiền thật hoặc FE mới.
