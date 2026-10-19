# bookings

Đã có API đọc session/inventory, waiting-room, tạo/đọc/nhả hold, tạo/đọc/danh sách/hủy booking và expiry worker. Hold/booking có idempotency, ownership, transaction PostgreSQL và khóa theo Docs/11; Redis admission nằm ngoài transaction. Bộ kiểm tra PostgreSQL riêng trong đợt làm sạch đã xác minh race cùng ghế, replay, ownership, tạo/hủy/hết hạn đơn. PayOS, phát vé/check-in/admission và FE đã nối qua port riêng; booking không gọi SDK hoặc ghi payment. Idempotency nằm tại shared/idempotency. Trạng thái và vận hành ở [Docs/32](../../../../Docs/32-payos-booking-ticket-flow.md).

GET/PUT /bookings/:id/attendees thuộc module tickets: owner scope, đúng một bộ họ tên/DOB/SĐT/CCCD mỗi item, tuổi mỗi người, AWAITING_PAYMENT còn hạn và audit/rollback. Guard DB chặn confirmation thiếu attendee/không đủ tuổi. Xem [Docs/29](../../../../Docs/29-profile-follow-age-attendees.md).

Routes lắp middleware/controller; holds/orders/allocation/inventory/waiting-room có thư mục riêng. SQL ở repository, public/sale policy ở shared/booking.policy.ts; booking.service.ts giữ entry point cho caller. Primitive schema/actor dùng shared của BE, schema hold/order/idempotency thuộc nhóm tương ứng. Xem [cấu trúc code](../../../../Docs/31-backend-code-structure.md).

Controller chỉ HTTP; service kiểm tra quyền/scope, policy và transaction; repository dùng SQL có tham số với cùng connection được truyền vào. Xem Docs/10 và Docs/23 tại gốc repo. Không tạo API giả trả thành công khi nghiệp vụ chưa tồn tại.
