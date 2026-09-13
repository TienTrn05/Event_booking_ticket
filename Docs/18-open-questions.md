# 18. Quyết định nghiệp vụ và phần còn mở

Chủ quyết định: chủ dự án. Ngày ghi nhận: **2026-09-12**. Nguồn: chấp thuận khuyến nghị trước đó, điều chỉnh Organizer/Admin/venue và ba câu trả lời tiếp theo về Google/OTP, check-in và thời hạn duyệt. Điều chỉnh trực tiếp có ưu tiên cao hơn đề xuất cũ. Chi tiết ở [23](23-organization-review-seatmap.md).

RESOLVED là đã chốt phần nêu trong hàng; PARTIALLY RESOLVED là còn chi tiết chưa có giá trị cụ thể. Không hỏi lại phần đã duyệt hoặc coi giá trị chưa từng đề xuất là đã được cung cấp.

| ID | Trạng thái | Quyết định đã ghi nhận | Phần còn mở / giới hạn |
| --- | --- | --- | --- |
| Q-001 | RESOLVED | Hold 5 phút, checkout không gia hạn; giờ DB dưới khóa phân xử, bằng deadline là hết hạn; tiền muộn đối soát | Không grace period |
| Q-002 | RESOLVED | 6 ghế/booking; một phân bổ chưa kết thúc/user/session; không gia hạn | Quota gồm ACTIVE hold và CONVERTED có booking AWAITING_PAYMENT còn hạn, khóa trước Event để không né quota bằng checkout |
| Q-003 | PARTIALLY RESOLVED | Một currency, snapshot giá lúc hold; MVP vé trả tiền, không phí/discount/miễn phí | Chưa chọn currency cụ thể; giá/loại vé do Organizer cấu hình |
| Q-004 | PARTIALLY RESOLVED | Giữ full refund mock, vé chưa USED, không resale; Organizer duyệt bình thường, Admin theo report | Deadline refund và tự động compensation còn mở; self check-in chưa là USED nên không tự làm mất quyền refund |
| Q-005 | RESOLVED | Organizer là tổ chức, email công ty đã xác minh, Admin duyệt role; quyền quản lý thường xuyên thuộc Organizer; Admin duyệt role/event và can thiệp theo report | Bootstrap Admin ngoài đăng ký công khai; membership ràng buộc tổ chức, không dùng chung mật khẩu |
| Q-006 | PARTIALLY RESOLVED | Customer dùng Google hoặc OTP SĐT; Organizer phải dùng mail công ty; đa thiết bị; access 10 phút, refresh 7 ngày tuyệt đối/thiết bị | Thiết kế email OTP cho công ty không dùng Google Workspace ở 04; nhà cung cấp SMS/email và giới hạn thiết bị cụ thể chọn trước vận hành; không còn login/reset mật khẩu nội bộ |
| Q-007 | RESOLVED | Một session/booking, đăng nhập trước mua; người mua sở hữu đơn/vé, tên người tham dự riêng mỗi vé; không guest checkout/chuyển nhượng | Không yêu cầu tài khoản cho từng người đi cùng |
| Q-008 | PARTIALLY RESOLVED | Mã do hệ thống cấp; self check-in từ 1 ngày trước sự kiện hoặc tại quầy; dùng tên và mã vé | Online diễn giải thành 24 giờ trước starts_at đến starts_at. Giờ mở/đóng quầy và cửa vào cần cấu hình cụ thể; tách xác nhận check-in khỏi USED tại cửa. Không thu số thẻ ngân hàng/giấy tờ |
| Q-009 | PARTIALLY RESOLVED | Venue từ danh mục có sẵn, có capacity/bounds; Organizer chọn và vẽ layout/sân khấu/ghế bằng editor kéo thả | Ai bảo trì catalog thật và nguồn giới hạn venue; demo dùng dữ liệu giả rõ ràng, không bịa số đo địa điểm thật |
| Q-010 | PARTIALLY RESOLVED | Gửi ít nhất 1 tháng trước ngày diễn ra; mỗi hồ sơ có 15 ngày duyệt; Admin approve mới đăng; hết hạn thông báo hủy hồ sơ và Admin bắt buộc soạn phiếu lý do qua form | Phần duyệt/thời hạn đã chốt; trùng lịch venue và bán sau giờ bắt đầu còn mở. Quy ước tháng lịch ở 23; hồ sơ hết hạn không được approve muộn, không đồng nghĩa hủy event đã bán. Report cần cho can thiệp quản lý |
| Q-011 | RESOLVED | Benchmark 100 khách/1.000 ghế, p95 đọc <500 ms, hold <1 s, 5xx <1%; availability demo 99,5% | Là target, chưa đo đạt; phải ghi cấu hình máy |
| Q-012 | PARTIALLY RESOLVED | Một API + worker, MySQL, HTTPS cùng origin; RPO 24h/RTO 4h demo; mock staging allowlist + ownership/provider check; production cấm mock | Đích hosting/domain/ngân sách và tài khoản allowlist thực chưa cung cấp |
| Q-013 | PARTIALLY RESOLVED | Dữ liệu giả ban đầu; idempotency key 24 giờ; recovery cùng cửa sổ, dọn khi kết thúc/logout, không lưu credential | Retention PII/audit/inbox/backup trước dữ liệu thật; mã check-in cũng không log |
| Q-014 | PARTIALLY RESOLVED | Tiếng Việt, prefix SQL, chưa upload; editor React/SVG 2D và seat picker là MVP do yêu cầu trực tiếp | Quy tắc dấu/hoa thường, accessibility và hình học catalog cần xác định khi triển khai |
| Q-015 | RESOLVED | Hoãn AI | Không chặn MVP |
| Q-016 | PARTIALLY RESOLVED | Bộ công cụ nhỏ, MySQL transaction/lock tường minh, pin khi code | Node 24/npm workspaces/mysql2/Zod/Vitest và lint/format đã chọn tại ADR-015; migration runner và hạ tầng còn mở |
| Q-017 | PARTIALLY RESOLVED | Remote private ban đầu rồi chủ động công khai | Chưa có đích/tài khoản/license; không tự tạo/push |
| Q-018 | RESOLVED | Mốc nghiệm thu, không tự đặt deadline khi chưa có nguồn lực | Cung cấp giờ/tuần khi cần lập lịch |

## Các đề xuất cũ đã được thay thế

- Venue riêng Organizer → venue catalog dùng chung, layout riêng tổ chức/event.
- Organizer tự publish → gửi hồ sơ, Admin duyệt bản có version.
- Admin duyệt mọi refund → Organizer xử lý thường xuyên, Admin theo report.
- Email/mật khẩu nội bộ → Google, OTP điện thoại và xác thực mail công ty; refresh/session vẫn giữ.
- Check-in luôn làm USED → tự xác nhận online hoặc tại quầy chỉ tạo CheckIn; quét vào cửa mới USED.
- Một tháng cho Admin xử lý → gửi trước ít nhất một tháng, hồ sơ có hạn duyệt 15 ngày.

## Đồng bộ và phần thực thi

[23](23-organization-review-seatmap.md) là mô tả chi tiết, [03](03-user-roles-permissions.md)/[04](04-authentication-authorization.md)/[07](07-business-rules.md)/[08](08-database-design.md)/[09](09-api-design.md)/[22](22-frontend-architecture.md) là hợp đồng hiện hành. ADR-013 ghi thay đổi nguồn yêu cầu.

SQL/ERD đã đồng bộ theo ADR-014 và kiểm tra DB tạm; chưa phải migration production. Phạm vi và bất biến service tại [20](20-physical-sql-design.md), kiểm thử cần bổ sung ở [13](13-testing-strategy.md). Chấp thuận nghiệp vụ không có nghĩa đã deploy, gửi OTP/email thật hoặc cấp tài khoản ngoài hệ thống.

Khi chốt phần còn mở, giữ Q ID, ghi người/ngày/đáp án và cập nhật tài liệu phụ thuộc; không xin duyệt lại các phần RESOLVED.
