# 01. Tổng quan dự án

## Bài toán và giá trị

**Event Ticketing Platform** giúp khách tìm sự kiện, chọn suất diễn và ghế, đặt vé, thanh toán và xuất trình vé. Nhà tổ chức quản lý lịch diễn, giá và doanh số; quản trị viên xử lý quyền truy cập và nội dung vi phạm.

Vấn đề cốt lõi là cùng một ghế có thể được nhiều người chọn đồng thời; trạng thái giữ ghế, thanh toán và vé có thể lệch nhau do timeout hoặc thông báo lặp. Hệ thống phải bảo vệ tồn kho và lưu vết để đối soát được.

Đây là dự án cá nhân nhằm chứng minh thiết kế API, authentication/authorization, mô hình quan hệ, transaction, kiểm soát đồng thời, bảo mật, kiểm thử và vận hành. “Hướng production” là mục tiêu kỹ thuật, không phải tuyên bố đã sẵn sàng kinh doanh thực tế.

## Phạm vi

| Nhóm | Nội dung |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nền tảng đã xác định | React + TypeScript + Vite; Express + TypeScript trên Node.js; MySQL; JWT; REST; Modular Monolith |
| MVP kỹ thuật | Tài khoản, phiên đăng nhập, quyền/ownership; sự kiện, địa điểm, suất diễn, ghế đánh số; giữ ghế; booking; thanh toán mock; QR và check-in online; audit và kiểm thử đồng thời |
| Nghiệp vụ đã chốt | Organizer là tổ chức dùng mail công ty, Admin duyệt role/event; đăng nhập Google/OTP trước mua, đa thiết bị; một session/booking, hold 5 phút, tối đa 6 ghế; tên/mã từng vé; self check-in từ 24h trước diễn hoặc tại quầy; venue catalog và editor layout. Xem [23](23-organization-review-seatmap.md) |
| Mở rộng | Cổng thanh toán thật, email giao dịch, websocket, object storage, Redis khi có số liệu, vé tự do, hoàn một phần, nhân viên check-in, AI có kiểm chứng |
| Ngoài phạm vi hiện tại | Bán lại/chuyển nhượng vé, dynamic pricing, marketplace thanh toán cho Organizer, thuế/hóa đơn pháp lý, multi-region, microservices, Kafka, Kubernetes |

Nhóm người dùng: Guest, Customer, Organizer, Admin; System là tác nhân tự động, không phải tài khoản có thể đăng nhập.

## Ranh giới ứng dụng theo vai trò

Guest, Customer và Organizer dùng chung Public Web. Organizer đăng nhập cùng nền tảng và được mở thêm workspace quản lý sự kiện khi backend xác nhận Organization/membership/phiên công ty; đây không phải website hoặc backend riêng. Admin dùng một Admin Web được build và triển khai trên frontend server/origin riêng. Public Web và Admin Web đều gọi cùng một backend `BE/` và cùng nguồn dữ liệu; không có API/DB Admin song song. Chi tiết và hệ quả CORS/session/deploy nằm ở [22](22-frontend-architecture.md), [14](14-environment-deployment.md) và ADR-016.

## Thuật ngữ

| Thuật ngữ | Ý nghĩa |
| ------------ | ------------------------------------------------------------------------------- |
| Event | Nội dung sự kiện, thuộc một Organizer |
| EventSession | Một lần tổ chức cụ thể, có địa điểm và thời gian |
| Seat | Vị trí ghế trong một layout của event tại venue, có ID/nhãn/hình học ổn định |
| Organization | Tổ chức sở hữu event; User đại diện qua membership được Admin duyệt |
| SeatLayout | Bản thiết kế sân khấu/khu/hàng/ghế trong giới hạn venue |
| TicketType | Loại vé có code trong session, khác mã riêng của từng Ticket |
| CheckIn | Xác nhận trước sự kiện online hoặc tại quầy, không phải trạng thái USED vào cửa |
| SessionSeat | Bản ghi ghế của một suất, giữ giá và trạng thái tồn kho |
| SeatHold | Quyền giữ tạm một nhóm ghế cho một khách, có hạn dùng |
| Booking | Đơn mua, lưu giá và danh sách ghế tại thời điểm checkout |
| Payment | Một lần thử thanh toán; một đơn có thể có nhiều lần thử |
| Refund | Một yêu cầu hoàn tiền độc lập, có trạng thái riêng |
| Ticket | Quyền vào cửa có mã riêng và tên attendee, phát sau thanh toán hợp lệ |
| Idempotency | Gửi lại cùng thao tác không tạo thêm hiệu ứng nghiệp vụ |

## Cách đọc trạng thái quyết định

“Đã xác định” bắt nguồn trực tiếp từ yêu cầu. “Đề xuất kỹ thuật” là lựa chọn thiết kế được giải thích bằng ADR. `DECISION REQUIRED (Q-xxx)` chỉ ra nghiệp vụ hoặc thông số chưa được xác nhận. Các phần phụ thuộc mô tả thiết kế dự kiến để review, không tự coi là đã duyệt.

FR/BR/UC là hợp đồng hiện hành; trạng thái từng Q ở [18](18-open-questions.md) phân biệt đã chốt với phần còn mở. SQL/ERD đã đồng bộ model tổ chức/layout theo ADR-014, xem [20](20-physical-sql-design.md). Mâu thuẫn phải được sửa trong cùng thay đổi; [18](18-open-questions.md) là nơi quản lý quyết định mở.
