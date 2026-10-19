# Organizer sales

API đọc đơn/chi tiết/vé/thống kê theo Organization, event/session/status và thời điểm tạo booking [from,to). SalesService phụ thuộc OrganizerSalesReader; SalesRepository chỉ SQL. Kiểm tra sales.read_own, onboarding, identity và membership ACTIVE thuộc Organization APPROVED. Không trả QR/CCCD/phone/DOB/checkout URL hoặc quyền toàn hệ thống cho Admin mặc định.

Tiền trả chuỗi đơn vị nhỏ nhất, nhóm theo currency. grossTicketSalesMinor đếm một lần mỗi booking CONFIRMED/REFUNDED; receivedMinor tổng khoản thực nhận từ mọi attempt, refundedMinor chỉ refund SUCCESS; netReceivedMinor = receivedMinor - refundedMinor. REQUESTED/PROCESSING/FAILED refund riêng, không cộng vào số đã hoàn. reconciliationReceivedMinor nằm trong receivedMinor; không cộng lần nữa. GET reconciliation chỉ đọc dấu vết nội bộ theo yêu cầu ban đầu; không có endpoint xử lý tiền thiếu/dư hoặc chuyển tiền theo ADR-033.

Kiểm thử PostgreSQL tạm đã xác minh nhiều item/attempt không nhân doanh thu, lọc và scope/PII. Workflow sửa/hủy publication và demo local đã triển khai với migration013; xem [Docs38](../../../../Docs/38-organizer-sales-operations.md). FE dashboard mới chưa nối; chưa chuyển/hoàn tiền thật.
