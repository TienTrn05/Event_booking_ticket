-- Chỉ từ điển vai trò/quyền; không tạo user, không cấp role hoặc map role_permissions.
-- Q-005 còn mở. Chạy lại an toàn nhưng không tự ghi đè mô tả đã chỉnh.
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO roles (code, name) VALUES
('CUSTOMER','Khách mua vé'), ('ORGANIZER','Nhà tổ chức'), ('ADMIN','Quản trị viên')
ON DUPLICATE KEY UPDATE code = roles.code;

INSERT INTO permissions (code, description) VALUES
('event.read_public','Xem sự kiện công khai'),
('profile.update_self','Cập nhật hồ sơ của mình'),
('seat.hold','Giữ ghế cho mình'),
('booking.create','Tạo đơn của mình'),
('booking.read_self','Xem đơn của mình'),
('ticket.read_self','Xem vé của mình'),
('refund.request_self','Yêu cầu hoàn tiền theo chính sách'),
('event.create','Tạo sự kiện'),
('event.update_own','Sửa sự kiện sở hữu'),
('event.publish_own','Publish sự kiện sở hữu'),
('event.cancel_own','Hủy sự kiện sở hữu theo chính sách'),
('venue.manage_own','Quản lý địa điểm thuộc quyền'),
('sales.read_own','Xem doanh số sở hữu'),
('ticket.checkin_own','Check-in vé của sự kiện sở hữu'),
('organizer.approve','Duyệt nhà tổ chức'),
('user.block','Khóa và mở khóa tài khoản'),
('role.assign','Cấp hoặc thu hồi vai trò'),
('user.manage','Quản lý danh sách người dùng'),
('category.manage','Quản lý danh mục'),
('event.block_any','Chặn sự kiện với lý do'),
('refund.approve','Duyệt, từ chối, thử lại khoản hoàn'),
('booking.read_support','Xem đơn trong phạm vi hỗ trợ có audit'),
('audit.read','Đọc lịch sử audit'),
('statistics.read_system','Xem thống kê toàn hệ thống')
ON DUPLICATE KEY UPDATE code = permissions.code;
COMMIT;
