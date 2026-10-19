# Published event operations

EventOperationsService quản lý yêu cầu CONTENT/Admin review và hủy trước mọi suất chưa USED. Repository giữ SQL/snapshot/audit/outbox; EventCancellationBookings và EventCancellationRefunds là ports, adapter nằm trong module sở hữu booking/refund. Không ghi trực tiếp tồn kho/tiền từ event service, không gọi mạng trong transaction.

Cancel commit Event CANCELLED để dừng sales/admission ngay. Worker bookings hiện có xử lý một hold/đơn mỗi transaction theo quota/event/seat/payment/refund/ticket locks; cursor/notification cùng commit, lỗi retry15 giây. Ghế SOLD không bán lại; refund do hủy toàn bộ đơn ghi kết quả thủ công bằng chứng từ. Không thêm broker/instance hoặc hạ tầng phân tán.

Hợp đồng, demo, DDL và kiểm chứng tại [Docs38](../../../../../Docs/38-organizer-sales-operations.md).
