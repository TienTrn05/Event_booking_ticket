# tickets

Thông tin attendee nằm trực tiếp trên booking_items, dùng lại attendee_name_snapshot theo ADR-024; không có bảng ticket_attendees riêng. Staff đối chiếu giấy tờ thật đúng Organization/membership/permission/time window. CCCD AES-GCM/HMAC bằng ATTENDEE_PII_KEY riêng, che số và purge sau suất +30 ngày. PayOS đã xác nhận tiền mới phát vé; mã QR riêng AES-GCM bằng TICKET_ENCRYPTION_KEY. Online/counter check-in giữ VALID; admission đối chiếu giấy tờ thật và đánh dấu USED một lần. Xem [Docs/29](../../../../Docs/29-profile-follow-age-attendees.md) và [Docs/32](../../../../Docs/32-payos-booking-ticket-flow.md).

Controller chỉ HTTP; service kiểm tra quyền/scope, policy và transaction; repository dùng SQL có tham số với cùng connection được truyền vào. Xem Docs/10 và Docs/23 tại gốc repo. Không tạo API giả trả thành công khi nghiệp vụ chưa tồn tại.
