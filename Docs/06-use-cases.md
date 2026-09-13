# 06. Danh mục use case

## Catalog

| ID | Use case | Actor | Yêu cầu |
| --- | --- | --- | --- |
| UC-001 | Đăng ký/xác minh | Guest | FR-001, FR-003 |
| UC-002 | Đăng nhập/refresh/logout | Người dùng | FR-002 |
| UC-003 | Tìm và xem sự kiện | Guest | FR-008, FR-009 |
| UC-004 | Chọn venue, thiết kế layout/session/giá, gửi duyệt | Organizer | FR-006–FR-012 |
| UC-005 | Giữ ghế | Customer | FR-013 |
| UC-006 | Tạo booking | Customer | FR-014 |
| UC-007 | Thanh toán/thử lại | Customer, System | FR-016 |
| UC-008 | Xác nhận đơn/phát vé | System | FR-017 |
| UC-009 | Xem và check-in vé | Customer, Organizer | FR-015, FR-018 |
| UC-010 | Hết hạn/hủy đơn chưa trả | System, Customer | FR-019, FR-023 |
| UC-011 | Yêu cầu và xử lý hoàn tiền | Customer, Organizer, Admin theo report, System | FR-020 |
| UC-012 | Xem doanh số sở hữu | Organizer | FR-021 |
| UC-013 | Quản trị tài khoản/sự kiện | Admin | FR-005, FR-007, FR-022 |
| UC-014 | Khôi phục qua identity/cập nhật hồ sơ | Người dùng | FR-003, FR-004 |
| UC-015 | Gửi thông báo review/phiếu lý do; mở rộng email giao dịch sau MVP | System | FR-024/FR-030 |

## UC-005 — Giữ ghế

- **Actor:** Customer hoạt động và đủ điều kiện mua theo Q-006.
- **Tiền điều kiện:** event đã publish; session đang bán; danh sách ghế thuộc cùng session; hạn mức Q-002 được chốt.
- **Kích hoạt:** khách xác nhận lựa chọn ghế.
- **Luồng chính:** validate ID/key → transaction kiểm tra event/session → khóa ghế theo thứ tự → kiểm tra khả dụng → tạo hold và ghi chủ/expiry → commit → trả hold và giá.
- **Thay thế:** cùng key/cùng request chuẩn hóa (gồm route target và payload theo [09](09-api-design.md)) trả kết quả cũ; hold cũ hết hạn được thu hồi theo giao thức rồi thử lại.
- **Ngoại lệ:** một ghế không còn trống → rollback toàn bộ, 409; deadlock → retry có giới hạn; hết retry → 503, không trả thành công.
- **Hậu điều kiện:** đúng nhóm ghế được giữ đến expiry; không có nhóm giữ một phần. BR-001–BR-003, NFR-001.

## UC-006 — Tạo booking

- **Actor:** chủ hold.
- **Tiền điều kiện:** hold ACTIVE còn hạn, chưa chuyển thành booking; Q-007 chốt một suất/đơn.
- **Kích hoạt:** khách bấm checkout.
- **Luồng chính:** kiểm tra key/ownership → khóa session, hold, ghế → kiểm tra expiry/quyền bán → kiểm tra attendeeName đúng từng ghế, chụp tên/loại vé/giá đã báo ở hold → tạo booking AWAITING_PAYMENT và item → hold CONVERTED → commit.
- **Thay thế:** hold đã chuyển, cùng chủ và toàn bộ payload gồm tên attendee tương đương → trả đơn cũ; client tải lại đơn để biết trạng thái mới.
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

## UC-009 — Check-in và vào cửa

- **Actor:** Customer chủ booking tự online; Organizer đúng Organization tại quầy/cửa.
- **Tiền điều kiện:** Ticket VALID, booking đã xác nhận, event/session cho phép, tên/mã hệ thống khớp.
- **Luồng online:** đăng nhập → chọn vé → từ starts_at-24h đến starts_at → kiểm tra tên/mã/ownership → khóa scope/booking/ticket → insert CheckIn ONLINE unique ticket_id, audit → commit; Ticket vẫn VALID.
- **Luồng quầy:** Organizer kiểm tra scope/window quầy/tên/mã → cùng khóa → insert CheckIn COUNTER nếu chưa có. Đã online trả bản CheckIn hiện có.
- **Luồng vào cửa:** Organizer quét mã/QR → kiểm tra CheckIn, VALID, event/session/window → conditional update USED, admitted_by/at, audit cùng transaction → commit.
- **Ngoại lệ:** sai mã/tên/quyền không consume; ngoài window từ chối; concurrent online/quầy chỉ một CheckIn. Concurrent admission đúng một USED, lượt khác 409.
- **Hậu điều kiện:** xác nhận trước sự kiện không làm vé USED và không tự loại refund. Ticket bị refund/cancel không vào cửa dù CheckIn còn lưu lịch sử.

## UC-011 — Hoàn tiền

- **Actor:** chủ booking yêu cầu, Organizer duyệt; Admin chỉ qua report hỗ trợ; System thực hiện.
- **Tiền điều kiện:** Q-004 đã duyệt; khoản tiền thực nhận còn đủ; đề xuất MVP chỉ hoàn toàn bộ và vé chưa USED.
- **Kích hoạt:** gửi lý do hoàn tiền.
- **Luồng chính:** kiểm tra ownership/policy → tạo REQUESTED → Organizer tải danh sách qua `GET /organizer/refunds` (Admin dùng danh sách hỗ trợ kèm reportId), chọn request và đọc chi tiết → duyệt trong transaction sau kiểm tra lại trạng thái/policy, vô hiệu hóa vé thành CANCELLED → gọi adapter với key ổn định ngoài transaction → kết quả thành công cập nhật Refund SUCCESS, Payment REFUNDED, Booking REFUNDED và vé REFUNDED.
- **Thay thế:** bị từ chối → Refund REJECTED, vé giữ trạng thái trước đó; callback lặp không hoàn thêm tiền.
- **Ngoại lệ:** kết quả chưa rõ giữ PROCESSING để đối soát; FAILED sau duyệt thì vé vẫn CANCELLED, cần retry/giải quyết, không tự cấp lại quyền vào cửa.
- **Hậu điều kiện:** không hoàn vượt số thực nhận; audit đủ người/lý do/khoản tiền; việc mở bán lại ghế theo Q-004, mặc định thiết kế giữ SOLD đến khi chính sách được chốt.

## UC-004/UC-013 — Gửi duyệt, xuất bản và xử lý report

- **Actor:** Organizer submit, Admin review; can thiệp block thuộc report.
- **Tiền điều kiện submit:** Organization APPROVED, actor membership/company session hợp lệ, layout frozen/capacity/giá/window đầy đủ, trước session sớm nhất ít nhất một tháng lịch.
- **Luồng chính:** khóa Event/session/config → tạo EventReview PENDING có version, submittedAt, expiry +15 ngày → Event PENDING_REVIEW. Admin event.review khóa lại Event/Review, kiểm tra version/deadline/config → APPROVED và PUBLISHED + notification/audit/outbox → commit.
- **Từ chối:** Admin dùng form reasonCode/reasonText/guidance → REJECTED + phiếu + notification cùng transaction. Hết hạn: EXPIRED và Event REJECTED, tự thông báo hủy hồ sơ + tạo draft phiếu cần Admin hoàn tất.
- **Đua với deadline:** DB_NOW >= expiresAt dưới khóa không approve; worker và request dùng cùng thứ tự. Phiếu lý do không hồi sinh hồ sơ. Nộp lại tạo review mới, vẫn kiểm tra hạn gửi.
- **Can thiệp:** Admin có report còn mở đúng event mới block và tạo job xử lý tiền/vé; không sửa thay Organizer. Block/cancel ngăn hold/confirm sau commit; giữ lịch sử.
- **Hậu điều kiện:** không event công khai chưa được approve đúng version; thông báo không mất khi worker restart; không tự viết lý do nhân danh Admin.

## UC-016 — Thiết kế sơ đồ trong giới hạn venue

- **Actor:** Organizer của event DRAFT.
- **Luồng:** chọn catalog venue → tải bounds/capacity/version → editor React/SVG tạo sân khấu/vùng cấm/khu/hàng/ghế → server validate geometry/scope/version → lưu nháp → preview → freeze.
- **Ngoại lệ:** vượt capacity/bounds, chồng vùng cấm, trùng nhãn, version cũ hoặc layout khác tổ chức: từ chối; không cập nhật nửa sơ đồ.
- **Hậu điều kiện:** session tham chiếu đúng frozen revision, inventory theo ghế ID ổn định; buyer chỉ chọn, không sửa.
