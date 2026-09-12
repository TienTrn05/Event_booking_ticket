# 03. Vai trò và phân quyền

## Tác nhân

| Vai trò | Mục đích, hành động chính | Giới hạn |
| --- | --- | --- |
| Guest | Khám phá sự kiện, xem suất và tình trạng ghế; đăng ký/đăng nhập | Không giữ ghế, mua vé, đọc dữ liệu cá nhân |
| Customer | Quản lý hồ sơ, giữ ghế, mua/xem vé, yêu cầu hoàn tiền | Chỉ tài nguyên của mình; refund còn phụ thuộc chính sách |
| Organizer | Tạo nội dung, cấu hình suất/giá, xem doanh số và check-in sự kiện mình | Không chỉnh sự kiện khác, tự cấp quyền hoặc tự xác nhận thanh toán |
| Admin | Duyệt Organizer, khóa tài khoản/sự kiện, duyệt refund, xem audit/thống kê | Không được bỏ qua bất biến tồn kho hoặc đọc bí mật; quyền nhạy cảm phải cấp rõ |
| System | Hết hạn hold, tiếp nhận kết quả payment, phát vé, chạy job | Danh tính dịch vụ có phạm vi; không có tài khoản đăng nhập “System” cho người dùng |

Đề xuất một người có nhiều role qua `UserRole`; role Organizer/Admin không tự bao gồm Customer. Muốn mua vé phải có Customer riêng. `DECISION REQUIRED (Q-005)`: quy trình duyệt và khả năng kiêm nhiệm này cần xác nhận. Không cho đăng ký công khai chọn role đặc quyền.

## Ma trận quyền đề xuất

Ký hiệu: Có = trong phạm vi ghi ở hàng; Chủ = chỉ sở hữu; Chính sách = còn điều kiện nghiệp vụ; Không = từ chối. Tất cả hành động đăng nhập còn cần tài khoản hoạt động.

| Permission / tính năng | Guest | Customer | Organizer | Admin |
| --- | --- | --- | --- | --- |
| `event.read_public` | Có | Có | Có | Có |
| `profile.update_self` | Không | Chủ | Chủ | Chủ |
| `seat.hold`, `booking.create` | Không | Chủ | Không | Không |
| `booking.read_self`, `ticket.read_self` | Không | Chủ | Không | Không |
| `refund.request_self` | Không | Chính sách | Không | Không |
| `event.create` | Không | Không | Có | Không |
| `event.update_own`, `event.publish_own` | Không | Không | Chủ | Không |
| `event.cancel_own` | Không | Không | Chính sách | Không |
| `venue.manage_own` | Không | Không | Chủ | Không |
| `sales.read_own`, `ticket.checkin_own` | Không | Không | Chủ | Không |
| `organizer.approve`, `user.block`, `role.assign` | Không | Không | Không | Có |
| `user.manage`, `category.manage` | Không | Không | Không | Có |
| `event.block_any` | Không | Không | Không | Có |
| `refund.approve`, `booking.read_support` | Không | Không | Không | Chính sách |
| `audit.read`, `statistics.read_system` | Không | Không | Không | Có |

Lý do: phân tách mua vé, vận hành sự kiện và quản trị giúp giảm quyền thừa. Admin kiểm duyệt bằng hành động riêng có lý do, không giả làm Organizer để sửa nội dung. `booking.read_support` chỉ dùng cho hồ sơ hỗ trợ/hoàn tiền, che dữ liệu không cần thiết và ghi audit; Q-005 quyết định người được cấp thực tế. Venue sở hữu riêng là phương án Q-009.

## Mô hình kiểm tra

RBAC nhóm quyền theo vai trò, dễ quản lý nhưng không chứng minh quyền trên một tài nguyên. Permission cho phép mô tả thao tác cụ thể; ownership ràng buộc `booking.customer_id` hoặc `event.organizer_id`. Kết hợp cả ba; không hardcode “Admin luôn đúng”.

- Khách đọc đơn người khác: query theo ID và customer hiện tại; trả 404 để không tiết lộ đơn.
- Organizer sửa event người khác: 404; không dựa vào `organizerId` do client gửi.
- Organizer xem doanh thu: chỉ aggregate các event thuộc mình, không cho truyền tùy ý chủ sở hữu.
- Khách refund: sở hữu đơn chưa đủ; service kiểm tra trạng thái vé, thời hạn, tiền đã hoàn và Q-004.
- Admin block event: kiểm tra `event.block_any`, yêu cầu lý do, chặn bán trong transaction và audit; vé đã bán được xử lý bằng quy trình riêng theo Q-010.
- Admin override: chỉ qua permission và endpoint được đặc tả; tuyệt đối không override chống bán trùng hoặc phát vé khi chưa có tiền.

Phân công tầng nằm ở [04](04-authentication-authorization.md) và [10](10-backend-architecture.md). Kiểm chứng bằng FR-005, FR-015, FR-021, NFR-004, UC-012/UC-013.
