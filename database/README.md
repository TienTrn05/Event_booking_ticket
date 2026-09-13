# Thiết kế SQL MySQL

Schema hiện hành có **38 bảng**, đồng bộ Organization, Google/OTP, venue/layout, duyệt sự kiện và check-in tách admission theo [23](../docs/23-organization-review-seatmap.md). DDL dành cho **database rỗng để review**, chưa phải migration nâng cấp DB cũ hoặc database production đã triển khai. Không có backend/frontend trong phạm vi này.

## Các file

| File | Mục đích |
| --- | --- |
| [schema.sql](schema.sql) | PK/FK/UQ/CHECK, index và generated guard |
| [001-reference-data.sql](seeds/001-reference-data.sql) | 3 role, 29 permission và ánh xạ; không tạo user/cấp UserRole |
| [002-demo-venues.sql](seeds/002-demo-venues.sql) | Catalog giả tùy chọn cho demo editor, có bounds/capacity |
| [01-session-inventory.sql](queries/01-session-inventory.sql) | Ghế theo layout, loại vé, giá và khả dụng |
| [02-organizer-sales.sql](queries/02-organizer-sales.sql) | Sales theo tổ chức/đại diện, tách refund trước aggregate |
| [03-integrity-audit.sql](queries/03-integrity-audit.sql) | Kiểm tra liên bảng chỉ đọc, không tự sửa lịch sử |
| [04-review-work-queue.sql](queries/04-review-work-queue.sql) | Hồ sơ chờ duyệt/hết hạn và phiếu lý do DRAFT |

Chi tiết [20 — SQL vật lý](../docs/20-physical-sql-design.md), [21 — Transaction](../docs/21-sql-transactions.md), [bộ sơ đồ](../docs/diagrams/index.html).

## Nạp bằng MySQL client hoặc Workbench

Cú pháp yêu cầu MySQL 8.0.16+ có CHECK được thực thi. Đã kiểm tra trên 8.0.46; chưa xác nhận MariaDB hoặc môi trường production 8.4. Kết nối database thử **rỗng do bạn tự tạo/chọn**, UTF-8 và UTC:

```sql
SOURCE database/schema.sql;
SOURCE database/seeds/001-reference-data.sql;
-- Tùy chọn, chỉ dữ liệu giả:
SOURCE database/seeds/002-demo-venues.sql;
SHOW TABLES;
```

SOURCE là lệnh MySQL client. Workbench: chọn schema thử rỗng làm default, chạy schema rồi seed. Không có USE cố định, DROP/TRUNCATE hoặc tắt FK checks; không dùng --force để bỏ qua lỗi. Nếu DDL lỗi giữa chừng, kiểm tra lỗi và dùng database thử rỗng khác. MySQL DDL có implicit commit; không thể rollback toàn file bằng transaction bọc ngoài. Khi triển khai cần migration versioned, runner/checksum và kế hoạch dữ liệu cũ riêng.

## Kiểm chứng ngày 2026-09-13

**67 kiểm tra đạt trên MySQL 8.0.46**, InnoDB trong datadir riêng, chỉ dữ liệu tổng hợp:

- Nạp đủ 38 bảng vào database rỗng; seed chạy hai lần, 29 quyền, không cấp UserRole, không FK cascade xóa lịch sử.
- Identity/company/user/session scope, OTP attempts/purpose, nhiều thiết bị và refresh parent cùng phiên.
- Organization, layout/row/seat/session/type scope, capacity/dimensions, allocation, booking/hold owner, attendee, tiền, UQ payment/ticket.
- Review pending/version guard, hạn 15 ngày, reject approve đúng điểm expiry, publish theo bản được duyệt; phiếu lý do, notification dedupe, report đúng event và rollback review/phiếu.
- Hai connection cạnh tranh cùng ghế, consume OTP và admission: mỗi ca chỉ một thao tác thắng.
- Bốn query chạy được; inventory trả ghế/type, sales đúng receipt và loại actor ngoài scope; audit sạch với fixture hợp lệ và phát hiện ghế vượt canvas.

Đây không phải kiểm thử ứng dụng, Google/SMS/email thật, validator hình học, tính tháng lịch ở backend hoặc bộ T-032–T-041 đầy đủ. Quyền Admin theo report, layout frozen bất biến, quota và đồng bộ notification/outbox vẫn cần service/transaction theo 20/21. Dữ liệu dùng VND trong fixture chỉ để kiểm tra định dạng/tính tổng, không chốt currency kinh doanh.

Công cụ/script kiểm thử, dependencies, datadir/log và process tạm được dọn sau kiểm tra theo PROJECT_RULES; không kèm runner phụ trợ trong repo. Sản phẩm giữ lại là SQL, tài liệu và Mermaid/SVG/gallery.
