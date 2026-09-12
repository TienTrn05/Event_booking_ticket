# 01. Tổng quan dự án

## Bài toán và giá trị

**Event Ticketing Platform** giúp khách tìm sự kiện, chọn suất diễn và ghế, đặt vé, thanh toán và xuất trình vé. Nhà tổ chức quản lý lịch diễn, giá và doanh số; quản trị viên xử lý quyền truy cập và nội dung vi phạm.

Vấn đề cốt lõi là cùng một ghế có thể được nhiều người chọn đồng thời; trạng thái giữ ghế, thanh toán và vé có thể lệch nhau do timeout hoặc thông báo lặp. Hệ thống phải bảo vệ tồn kho và lưu vết để đối soát được.

Đây là dự án cá nhân nhằm chứng minh thiết kế API, authentication/authorization, mô hình quan hệ, transaction, kiểm soát đồng thời, bảo mật, kiểm thử và vận hành. “Hướng production” là mục tiêu kỹ thuật, không phải tuyên bố đã sẵn sàng kinh doanh thực tế.

## Phạm vi

| Nhóm | Nội dung |
| --- | --- |
| Nền tảng đã xác định | React + TypeScript + Vite; Express + TypeScript trên Node.js; MySQL; JWT; REST; Modular Monolith |
| MVP kỹ thuật | Tài khoản, phiên đăng nhập, quyền/ownership; sự kiện, địa điểm, suất diễn, ghế đánh số; giữ ghế; booking; thanh toán mock; QR và check-in online; audit và kiểm thử đồng thời |
| Nghiệp vụ đề xuất, cần chốt | Mỗi booking thuộc một suất; giữ ghế có thời hạn; Organizer được duyệt; chỉ hoàn toàn bộ; một người sở hữu toàn bộ vé trong đơn. Xem Q-001 đến Q-010 |
| Mở rộng | Cổng thanh toán thật, email giao dịch, websocket, object storage, Redis khi có số liệu, vé tự do, hoàn một phần, nhân viên check-in, AI có kiểm chứng |
| Ngoài phạm vi hiện tại | Bán lại/chuyển nhượng vé, dynamic pricing, marketplace thanh toán cho Organizer, thuế/hóa đơn pháp lý, multi-region, microservices, Kafka, Kubernetes |

Nhóm người dùng: Guest, Customer, Organizer, Admin; System là tác nhân tự động, không phải tài khoản có thể đăng nhập.

## Thuật ngữ

| Thuật ngữ | Ý nghĩa |
| --- | --- |
| Event | Nội dung sự kiện, thuộc một Organizer |
| EventSession | Một lần tổ chức cụ thể, có địa điểm và thời gian |
| Seat | Ghế vật lý trong địa điểm |
| SessionSeat | Bản ghi ghế của một suất, giữ giá và trạng thái tồn kho |
| SeatHold | Quyền giữ tạm một nhóm ghế cho một khách, có hạn dùng |
| Booking | Đơn mua, lưu giá và danh sách ghế tại thời điểm checkout |
| Payment | Một lần thử thanh toán; một đơn có thể có nhiều lần thử |
| Refund | Một yêu cầu hoàn tiền độc lập, có trạng thái riêng |
| Ticket | Quyền vào cửa, phát sau thanh toán hợp lệ |
| Idempotency | Gửi lại cùng thao tác không tạo thêm hiệu ứng nghiệp vụ |

## Cách đọc trạng thái quyết định

“Đã xác định” bắt nguồn trực tiếp từ yêu cầu. “Đề xuất kỹ thuật” là lựa chọn thiết kế được giải thích bằng ADR. `DECISION REQUIRED (Q-xxx)` chỉ ra nghiệp vụ hoặc thông số chưa được xác nhận. Các phần phụ thuộc mô tả thiết kế dự kiến để review, không tự coi là đã duyệt.

FR/BR/UC là bộ đặc tả dự kiến; quy tắc có liên kết Q chỉ có thể dùng làm tiêu chí triển khai sau khi Q được chốt. Mâu thuẫn phải được sửa trong cùng thay đổi; [18](18-open-questions.md) là nơi quản lý quyết định mở.
