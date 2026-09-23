# 18. Quyết định nghiệp vụ và phần còn mở

**Cập nhật 2026-09-13:** tăng sức chứa chỉ là ví dụ của Vé bán lại, không phải định nghĩa duy nhất. Chủ dự án bổ sung Organizer hủy sự kiện, feedback có sao về hệ thống/sự kiện và thuật toán điểm uy tín tổ chức hỗ trợ Admin duyệt. Nội dung thống nhất ở [23, phần 9](23-organization-review-seatmap.md); công thức, trọng số và chính sách xử lý cụ thể là đề xuất chờ chốt, chưa được triển khai.

Chủ quyết định: chủ dự án. Ngày ghi nhận: **2026-09-12**. Nguồn: chấp thuận khuyến nghị trước đó, điều chỉnh Organizer/Admin/venue và ba câu trả lời tiếp theo về Google/OTP, check-in và thời hạn duyệt. Điều chỉnh trực tiếp có ưu tiên cao hơn đề xuất cũ. Chi tiết ở [23](23-organization-review-seatmap.md).

RESOLVED là đã chốt phần nêu trong hàng; PARTIALLY RESOLVED là còn chi tiết chưa có giá trị cụ thể. Không hỏi lại phần đã duyệt hoặc coi giá trị chưa từng đề xuất là đã được cung cấp.

| ID | Trạng thái | Quyết định đã ghi nhận | Phần còn mở / giới hạn |
| ----- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
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
| Q-012 | PARTIALLY RESOLVED | Hai frontend deployable: Public Web dùng chung cho Customer/Organizer và Admin Web riêng; cả hai qua một API + worker và MySQL. Ưu tiên HTTPS cùng origin qua reverse proxy từng portal; RPO 24h/RTO 4h demo; mock staging allowlist + ownership/provider check; production cấm mock | Đích hosting/domain/ngân sách và tài khoản allowlist thực chưa cung cấp                                                                                                                                          |
| Q-013 | PARTIALLY RESOLVED | Dữ liệu giả ban đầu; idempotency key 24 giờ; recovery cùng cửa sổ, dọn khi kết thúc/logout, không lưu credential | Retention PII/audit/inbox/backup trước dữ liệu thật; mã check-in cũng không log |
| Q-014 | PARTIALLY RESOLVED | Tiếng Việt, prefix SQL, chưa upload; editor React/SVG 2D và seat picker là MVP do yêu cầu trực tiếp | Quy tắc dấu/hoa thường, accessibility và hình học catalog cần xác định khi triển khai |
| Q-015 | RESOLVED | Hoãn AI | Không chặn MVP |
| Q-016 | PARTIALLY RESOLVED | Bộ công cụ nhỏ, MySQL transaction/lock tường minh, pin khi code | Node 24/npm workspaces/mysql2/Zod/Vitest và lint/format đã chọn tại ADR-015; migration runner và hạ tầng còn mở |
| Q-017 | PARTIALLY RESOLVED | Remote private ban đầu rồi chủ động công khai | Chưa có đích/tài khoản/license; không tự tạo/push |
| Q-018 | RESOLVED | Mốc nghiệm thu, không tự đặt deadline khi chưa có nguồn lực | Cung cấp giờ/tuần khi cần lập lịch |
| Q-019 | PARTIALLY RESOLVED | Vé bán lại có nhiều nguyên nhân; tăng sức chứa chỉ là ví dụ; Organizer có chức năng hủy sự kiện | Ma trận lý do/duyệt lại, hạn xử lý, hiệu lực hủy và phương án tiền cho người mua theo 23 phần 9 |
| Q-020 | PARTIALLY RESOLVED | Người dùng feedback có sao về hệ thống và sự kiện/cách bán vé | Thang sao, điều kiện gửi/sửa, xác thực, công khai, kiểm duyệt và khiếu nại; không trừ uy tín tổ chức vì feedback lỗi hệ thống |
| Q-021 | PARTIALLY RESOLVED | Thuật toán điểm uy tín tổ chức tăng/giảm, Admin xem để hỗ trợ quyết định | Hệ số/nguồn/điểm thưởng-phạt, ngưỡng, cửa sổ thời gian, công khai và quyền điều chỉnh; công thức tại 23 là đề xuất |

## Các đề xuất cũ đã được thay thế

### Bổ sung merchandise và nhận diện hiển thị

- **Q-022 — PARTIALLY RESOLVED:** sự kiện được bán merchandise do Organization sở hữu sự kiện quản lý. Đã chốt thanh toán trên web và giao đến địa chỉ người nhận; Organizer chọn mua độc lập hoặc yêu cầu vé. Còn mở phí/phạm vi/đơn vị giao hàng, kiểm tra vé chi tiết, giữ kho, checkout chung/tách, đổi trả/hoàn khi hủy và duyệt hàng hóa/ảnh. Xem [23, phần 10](23-organization-review-seatmap.md).
- **Q-023 — RESOLVED:** công ty vẫn là Organizer; tag khách thấy có thể là tên nghệ sĩ/chương trình như PMC trong sự kiện Fanmeeting PMC. Không thay đổi ownership, uy tín, danh mục hoặc email công ty; không tự suy ra nghệ sĩ đã được xác minh.

### Bổ sung về UI/catalog ngày 2026-09-13

Chủ dự án yêu cầu điều hướng gồm **Nhạc sống, Thể thao, Sân khấu & Nghệ thuật, Hội thảo & Workshop, Tham quan & Trải nghiệm, Khác, Vé bán lại, Blog**. Sáu mục đầu là danh mục sự kiện; Vé bán lại và Blog là khu chức năng riêng. Brief và bảng kiểm ở [25 — Thiết kế UI](25-ui-design-brief.md).

- Đã chốt sự hiện diện của tám mục trong thiết kế, không giới hạn sản phẩm ở ca nhạc.
- Vé bán lại có nhiều nguyên nhân của Organizer; tăng sức chứa là ví dụ, không tự suy ra chuyển nhượng giữa khách. Ma trận xử lý/duyệt lại từng nguyên nhân cần chốt theo phần 9 tài liệu 23.
- Blog có phạm vi thiết kế trang danh sách/chi tiết; quyền biên tập, CMS và cách xuất bản chưa chốt.
- Không gian dạng khối/sức chứa do Organizer đề xuất đã được yêu cầu, ghế không bắt buộc. Mô hình inventory theo ghế và FR-027 cần cập nhật trước triển khai; danh mục không quyết định hình thức vé.

### Những thay đổi đã ghi nhận trước bổ sung catalog

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
