# PostgreSQL database

Schema hiện hành có **45 bảng**: 38 bảng lõi, 6 bảng catalog và 1 bảng alias SĐT ADR-021. Backend đọc trực tiếp PostgreSQL qua `pg`; ID `BIGINT` và tiền minor unit vẫn được trả về API dưới dạng chuỗi để không mất độ chính xác trong JavaScript.

## Các file

| File | Mục đích |
| --- | --- |
| [schema.sql](schema.sql) | Tạo mới toàn bộ 45 bảng theo ADR-021, PK/FK/UQ/CHECK và index và trigger `updated_at` |
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
. .\tooling\use-node.ps1
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
