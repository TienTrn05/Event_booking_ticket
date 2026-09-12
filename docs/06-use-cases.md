# 06. Danh mục use case

## Catalog

| ID | Use case | Actor | Yêu cầu |
| --- | --- | --- | --- |
| UC-001 | Đăng ký/xác minh | Guest | FR-001, FR-003 |
| UC-002 | Đăng nhập/refresh/logout | Người dùng | FR-002 |
| UC-003 | Tìm và xem sự kiện | Guest | FR-008, FR-009 |
| UC-004 | Quản lý venue/session/giá và publish event | Organizer | FR-006–FR-012 |
| UC-005 | Giữ ghế | Customer | FR-013 |
| UC-006 | Tạo booking | Customer | FR-014 |
| UC-007 | Thanh toán/thử lại | Customer, System | FR-016 |
| UC-008 | Xác nhận đơn/phát vé | System | FR-017 |
| UC-009 | Xem và check-in vé | Customer, Organizer | FR-015, FR-018 |
| UC-010 | Hết hạn/hủy đơn chưa trả | System, Customer | FR-019, FR-023 |
| UC-011 | Yêu cầu và xử lý hoàn tiền | Customer, Admin, System | FR-020 |
| UC-012 | Xem doanh số sở hữu | Organizer | FR-021 |
| UC-013 | Quản trị tài khoản/sự kiện | Admin | FR-005, FR-007, FR-022 |
| UC-014 | Khôi phục mật khẩu/cập nhật hồ sơ | Người dùng | FR-003, FR-004 |
| UC-015 | Gửi thông báo | System | FR-024, sau MVP |

## UC-005 — Giữ ghế

- **Actor:** Customer hoạt động và đủ điều kiện mua theo Q-006.
- **Tiền điều kiện:** event đã publish; session đang bán; danh sách ghế thuộc cùng session; hạn mức Q-002 được chốt.
- **Kích hoạt:** khách xác nhận lựa chọn ghế.
- **Luồng chính:** validate ID/key → transaction kiểm tra event/session → khóa ghế theo thứ tự → kiểm tra khả dụng → tạo hold và ghi chủ/expiry → commit → trả hold và giá.
- **Thay thế:** cùng key/cùng payload trả kết quả cũ; hold cũ hết hạn được thu hồi theo giao thức rồi thử lại.
- **Ngoại lệ:** một ghế không còn trống → rollback toàn bộ, 409; deadlock → retry có giới hạn; hết retry → 503, không trả thành công.
- **Hậu điều kiện:** đúng nhóm ghế được giữ đến expiry; không có nhóm giữ một phần. BR-001–BR-003, NFR-001.

## UC-006 — Tạo booking

- **Actor:** chủ hold.
- **Tiền điều kiện:** hold ACTIVE còn hạn, chưa chuyển thành booking; Q-007 chốt một suất/đơn.
- **Kích hoạt:** khách bấm checkout.
- **Luồng chính:** kiểm tra key/ownership → khóa session, hold, ghế → kiểm tra expiry/quyền bán → chụp giá đã báo ở hold → tạo booking AWAITING_PAYMENT và item → hold CONVERTED → commit.
- **Thay thế:** hold đã chuyển, cùng chủ và payload tương đương → trả đơn cũ; client tải lại đơn để biết trạng thái mới.
- **Ngoại lệ:** hold sai chủ → 404; hết hạn → 409 `HOLD_EXPIRED`; giá/dữ liệu không khớp → không thu tiền, yêu cầu xác nhận lại.
- **Hậu điều kiện:** một hold có tối đa một booking; giữ nguyên expiry ban đầu, chưa phát vé. BR-006/BR-007/BR-009.

## UC-007/UC-008 — Thanh toán và phát vé

- **Actor:** Customer khởi tạo, System xác minh kết quả.
- **Tiền điều kiện:** booking AWAITING_PAYMENT còn hạn, không có payment đang chờ khác; adapter được cấu hình.
- **Kích hoạt:** yêu cầu thanh toán hoặc thông báo kết quả từ adapter.
- **Luồng chính:** tạo payment với key và số tiền DB → commit → gọi adapter ngoài transaction → nhận kết quả đã xác minh → transaction khóa và kiểm tra toàn bộ ghế/booking/payment → ghi SUCCESS, SOLD, CONFIRMED, Ticket VALID, audit/outbox → commit.
- **Thay thế:** thất bại chắc chắn khi còn hạn cho attempt mới; callback trùng được ack nhưng không phát vé thêm.
- **Ngoại lệ:** callback sai chữ ký/tổng tiền/currency → từ chối hoặc cách ly, không phát vé; thành công muộn → ghi nhận tiền, mở đối soát/hoàn tiền, không chiếm ghế; DB lỗi → rollback và retry callback/job.
- **Hậu điều kiện:** hoặc đơn/vé/tồn kho nhất quán, hoặc chưa có hiệu ứng và xử lý lại được. BR-004, BR-010–BR-013, NFR-002/NFR-003.

## UC-009 — Check-in

- **Actor:** Organizer của event, hoặc nhân viên được phân quyền sau này (Q-008).
- **Tiền điều kiện:** đăng nhập, vé đúng session, VALID, event/session cho vào cửa, trong cửa sổ check-in.
- **Kích hoạt:** quét QR gửi bằng body qua TLS.
- **Luồng chính:** tra token hash → kiểm tra quyền → khóa theo giao thức → update có điều kiện VALID thành USED, lưu checked_in_by/at và audit → commit.
- **Thay thế:** request lặp cùng idempotency key trả kết quả cũ; lần quét khác của vé USED trả 409.
- **Ngoại lệ:** QR không tồn tại/sai quyền → 404; vé hủy/refund/hết hạn hoặc session bị block → 422, không đánh dấu dùng.
- **Hậu điều kiện:** tối đa một lần sử dụng thành công. BR-014–BR-016.

## UC-011 — Hoàn tiền

- **Actor:** chủ booking yêu cầu, Admin duyệt, System thực hiện.
- **Tiền điều kiện:** Q-004 đã duyệt; khoản tiền thực nhận còn đủ; đề xuất MVP chỉ hoàn toàn bộ và vé chưa USED.
- **Kích hoạt:** gửi lý do hoàn tiền.
- **Luồng chính:** kiểm tra ownership/policy → tạo REQUESTED → Admin duyệt trong transaction, vô hiệu hóa vé thành CANCELLED → gọi adapter với key ổn định ngoài transaction → kết quả thành công cập nhật Refund SUCCESS, Payment REFUNDED, Booking REFUNDED và vé REFUNDED.
- **Thay thế:** bị từ chối → Refund REJECTED, vé giữ trạng thái trước đó; callback lặp không hoàn thêm tiền.
- **Ngoại lệ:** kết quả chưa rõ giữ PROCESSING để đối soát; FAILED sau duyệt thì vé vẫn CANCELLED, cần retry/giải quyết, không tự cấp lại quyền vào cửa.
- **Hậu điều kiện:** không hoàn vượt số thực nhận; audit đủ người/lý do/khoản tiền; việc mở bán lại ghế theo Q-004, mặc định thiết kế giữ SOLD đến khi chính sách được chốt.

## UC-004/UC-013 — Publish và block event

- **Actor:** Organizer sở hữu publish; Admin có permission block.
- **Tiền điều kiện:** quyền hợp lệ; publish cần session/seat/price đủ; block cần lý do.
- **Kích hoạt:** yêu cầu chuyển trạng thái.
- **Luồng chính:** khóa event rồi session liên quan theo thứ tự ID → kiểm tra điều kiện → chuyển trạng thái, audit và tạo tác vụ hậu xử lý → commit.
- **Thay thế:** gọi lại trạng thái đích không tạo thêm công việc trùng.
- **Ngoại lệ:** phiên bản nội dung cũ → 409; còn dữ liệu thiếu → 422; người khác sửa event → 404.
- **Hậu điều kiện:** block/cancel ngăn mọi hold/confirm mới sau commit; vé cũ xử lý theo Q-010, không bị xóa lịch sử.
