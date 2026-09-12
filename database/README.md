# Thiết kế SQL MySQL

Đây là bản DDL có thể nạp vào **database rỗng để review và kiểm thử**, chưa phải migration đã duyệt cho production. Schema hiện có **27 bảng**. Không tạo backend/frontend trong phạm vi này.

## Các file

| File | Mục đích |
| --- | --- |
| [schema.sql](schema.sql) | Bảng, PK/FK/UQ/CHECK, chỉ mục, generated guard |
| [001-reference-data.sql](seeds/001-reference-data.sql) | Từ điển 3 role và 24 permission; không tạo user/cấp quyền |
| [01-session-inventory.sql](queries/01-session-inventory.sql) | Đọc sơ đồ ghế, giá, tình trạng khả dụng |
| [02-organizer-sales.sql](queries/02-organizer-sales.sql) | Doanh số trong phạm vi Organizer, tách hoàn tiền |
| [03-integrity-audit.sql](queries/03-integrity-audit.sql) | Phát hiện bất biến liên bảng bị vi phạm, chỉ đọc |

Giải thích mô hình: [20 — Thiết kế SQL vật lý](../docs/20-physical-sql-design.md). Giao thức transaction: [21 — SQL và transaction](../docs/21-sql-transactions.md). [Mở bộ sơ đồ](../docs/diagrams/index.html).

## Nạp bằng MySQL client hoặc Workbench

Yêu cầu cú pháp: MySQL 8.0.16 trở lên với CHECK được thực thi; nhánh đích đề xuất 8.4, chưa chốt phiên bản production Q-016. Không kết luận tương thích MariaDB từ kết quả MySQL.

Trong MySQL client, kết nối database thử rỗng do bạn tự tạo/chọn; đặt charset UTF-8 và timezone UTC, rồi SOURCE theo thứ tự:

```sql
SOURCE database/schema.sql;
SOURCE database/seeds/001-reference-data.sql;
SHOW TABLES;
```

`SOURCE` là lệnh client, không phải SQL gửi qua API. Với Workbench: chọn schema thử rỗng làm default, mở và chạy `schema.sql`, sau đó seed. File không có `USE` cố định, không DROP/TRUNCATE, không tắt foreign key checks. Không dùng `--force` để bỏ qua lỗi. Nếu DDL lỗi giữa chừng, không chạy lại mù quáng trong schema đã tạo một phần; xem lỗi và dùng schema thử rỗng khác.

DDL MySQL có implicit commit; transaction bọc ngoài không đảm bảo rollback toàn file. Khi bước vào triển khai, chuyển thiết kế đã duyệt thành migration versioned với checksum và migration runner đã chọn; chưa tạo down migration xóa dữ liệu.

## Kiểm chứng đã thực hiện

Schema đã qua 26 kiểm tra trên MySQL 8.0.46 trong database tạm, gồm ràng buộc, truy vấn mẫu và tranh chấp ghế giữa hai connection. Công cụ/script và báo cáo máy sinh dùng trong lần kiểm tra đó đã được dọn theo yêu cầu; repo không kèm runner để chạy lại tự động.

Kết quả này không chứng minh API, phân quyền, provider hay policy đã được triển khai, chưa thay bộ concurrency/E2E dự kiến ở [13](../docs/13-testing-strategy.md).

## Chính sách còn mở

TTL/quota không được seed hay hardcode trong schema. Currency không có default; service phải truyền currency đã duyệt. Các cấu trúc một suất/booking, ownership venue, full refund và check-in một lần là **phương án thiết kế** theo Q-004/Q-007/Q-008/Q-009; việc cung cấp DDL không có nghĩa đã duyệt các chính sách đó. Seed không cấp quyền khi Q-005 còn mở.
