# 15. Quy tắc phát triển và Git

## Git

Repository local dùng `main`. Công việc mới dùng nhánh ngắn `feature/<noi-dung>`, `fix/<noi-dung>`, `docs/<noi-dung>`, `refactor/<noi-dung>`, `chore/<noi-dung>`. Không cần `develop` cho dự án cá nhân ở giai đoạn đầu; chỉ thêm khi có chu kỳ phát hành song song thực tế (ADR-009).

Conventional Commits: `type(scope): mô tả ngắn`. Type gồm `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `build`, `ci`, `perf`; breaking change dùng `!` và mô tả migration trong body. Ví dụ:

```text
docs(spec): bổ sung quy tắc giữ ghế và thanh toán
feat(bookings): tạo đơn từ lượt giữ ghế còn hạn
fix(payments): xử lý callback thành công gửi lặp
test(bookings): kiểm tra hai khách cùng chọn một ghế
```

Commit nhỏ, tập trung một mục đích; đọc diff trước commit. Không commit node_modules/build/log/secret/dữ liệu thật; commit lockfile khi đã chọn package manager. `.gitignore` không bảo vệ secret đã được track; nếu lộ phải thu hồi và xử lý lịch sử theo phạm vi được duyệt.

Trước merge khi có code: mô tả hành vi, FR/BR/UC liên quan, migration và validation; CI tương ứng phải pass. Không force-push `main`, không reset/clean ghi đè công việc người khác. Remote, nền tảng hosting và bảo vệ nhánh cần Q-017; khởi tạo Git local không đồng nghĩa đã đẩy lên GitHub.

## Code và ranh giới tầng

- TypeScript `strict`; ưu tiên `unknown` ở biên và narrowing; không tắt lỗi bằng `any`, `@ts-ignore` thiếu lý do.
- async/await nhất quán; mọi Promise có owner xử lý lỗi; không fire-and-forget công việc ảnh hưởng tiền/vé.
- Controller không có nghiệp vụ; service quản lý policy và transaction; repository nhận connection, không commit ngầm.
- Dependency injection vừa đủ qua constructor/factory; tránh framework/abstraction lớn khi chưa cần.
- Không dùng floating point cho tiền hoặc ép BIGINT ID vào Number; tiền/ID API là chuỗi, validate range.
- Không dùng giờ client hoặc timezone hệ điều hành để quyết định expiry. Giờ DB và timezone session theo BR-028.
- State transition có danh sách cho phép; không chấp nhận PATCH status tự do từ client.
- Query luôn có tham số; sort/column allowlist; pagination có trần; tránh N+1 và SELECT * trả ra ngoài.
- Error tập trung với code ổn định, DTO response không lộ schema/bí mật. Không throw string, không nuốt lỗi rồi trả success.
- Transaction ngắn, có rollback/finally release connection; repository bên trong dùng cùng transaction context.
- External side effect dùng adapter/outbox; timeout phải phân biệt chưa rõ kết quả với thất bại cuối cùng.
- Không dùng frontend/router guard làm phân quyền duy nhất. Mọi mutation kiểm tra actor và ownership server-side.
- Không tùy tiện xóa cứng event/session/seat hoặc transaction; thiết kế migration và retention trước.
- Comment giải thích lý do/bất biến khó thấy; tên biến/hàm tiếng Anh nhất quán, tài liệu nghiệp vụ tiếng Việt.

## Quy trình thay đổi đặc tả

1. Xác định FR/BR/UC bị ảnh hưởng và đọc Q liên quan.
2. Nếu Q chưa chốt và thay đổi phụ thuộc, lấy quyết định trước; ghi đáp án, người quyết định và ngày ở [18](18-open-questions.md).
3. Nếu đổi kiến trúc, cập nhật/tạo ADR với context, decision, reason, alternative, trade-off; ADR cũ đánh dấu superseded và dẫn ADR mới, không xóa lịch sử.
4. Sửa đồng bộ API/schema/state machine/test case; không tái sử dụng mã đã có cho ý nghĩa khác.
5. Triển khai và kiểm thử rủi ro thật; docs-only chỉ kiểm tra nội dung/liên kết/diff, không tạo test ứng dụng giả.

## Definition of Done

Trước khi kết thúc, dừng process tạm của công việc và dọn file phát sinh chỉ để kiểm tra: datadir/log MySQL tạm, screenshot kiểm tra, cấu hình browser tạm, dependency tạm có thể cài lại. Xác minh nguồn gốc và đường dẫn trước khi xóa; giữ mã test, báo cáo cần bàn giao và sơ đồ/SQL/tài liệu đầu ra. Không coi Git sạch hoặc file đã được ignore là đã dọn ổ đĩa. Kiểm tra lại sau cleanup; nếu chưa dọn được phải báo rõ.

Người dùng ưu tiên chỉ nhận phản hồi cuối cùng ngắn gọn sau khi hoàn tất, ngoại trừ yêu cầu bắt buộc từ hướng dẫn cấp cao hơn hoặc thông tin cần thiết để tiếp tục.

Hành vi đúng tiêu chí FR/UC, bất biến BR giữ, quyền được kiểm thử, migration/API/docs khớp, kiểm tra liên quan pass, không lộ secret và không có `DECISION REQUIRED` bị âm thầm hardcode. Báo rõ việc đã làm, validation thực chạy và phần chưa triển khai. [PROJECT_RULES](../PROJECT_RULES.md) là bản rút gọn cho mọi người/AI sửa dự án.
