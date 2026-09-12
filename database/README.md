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
| [validate_mysql.py](tests/validate_mysql.py) | Tạo MySQL tạm và chạy kiểm tra DDL/ràng buộc/khóa |
| [validation-result.json](tests/validation-result.json) | Kết quả thực chạy và giới hạn kiểm chứng |

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

## Chạy kiểm tra độc lập trên máy có MySQL Server binary

PowerShell, từ root repo:

```powershell
python -m pip install --target .local/python -r database/tests/requirements.txt
python database/tests/validate_mysql.py --mysqld 'C:\Program Files\MySQL\MySQL Server 8.0\bin\mysqld.exe'
```

Runner khởi tạo datadir mới dưới `.local/`, cổng loopback tạm, mật khẩu ngẫu nhiên riêng; không kết nối dịch vụ MySQL đang có, không đọc credential người dùng. Process không mở cửa sổ, được shutdown khi kết thúc cả thành công/thất bại. Runner giữ datadir để điều tra trong lúc kiểm thử; người thực hiện phải dọn datadir/log và dependency cài tạm sau khi kiểm tra xong, trước khi báo hoàn tất, theo PROJECT_RULES. File init có secret được xóa sau startup. Giữ validation-result.json làm báo cáo bàn giao. Không chạy test trên dữ liệu thật.

Kết quả không chứng minh API, phân quyền, provider hay policy đã được triển khai. Race test chỉ chứng minh giao thức khóa cơ bản trên hai connection, chưa thay bộ concurrency/E2E đầy đủ ở [13](../docs/13-testing-strategy.md).

## Chính sách còn mở

TTL/quota không được seed hay hardcode trong schema. Currency không có default; service phải truyền currency đã duyệt. Các cấu trúc một suất/booking, ownership venue, full refund và check-in một lần là **phương án thiết kế** theo Q-004/Q-007/Q-008/Q-009; việc cung cấp DDL không có nghĩa đã duyệt các chính sách đó. Seed không cấp quyền khi Q-005 còn mở.
