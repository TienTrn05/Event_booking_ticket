-- Theo ma trận docs/03; chỉ từ điển và ánh xạ role, KHÔNG tạo user/cấp UserRole.
-- Permission không thay kiểm tra membership/company session hoặc report tại service.
-- Admin event.cancel_own/refund.approve chỉ trong report liên quan OPEN/IN_REVIEW.
-- Nạp lại không ghi đè mô tả hay xóa cấu hình đã có; thay policy cần migration riêng.
USE event_ticketing;
SET NAMES utf8mb4;
START TRANSACTION;
INSERT INTO roles (code,name) VALUES
('CUSTOMER','Khách mua vé'),('ORGANIZER','Đại diện tổ chức'),('ADMIN','Quản trị viên')
ON DUPLICATE KEY UPDATE code=roles.code;
INSERT INTO permissions (code,description) VALUES
('audit.read','audit.read — phạm vi theo docs/03'),
('booking.create','booking.create — phạm vi theo docs/03'),
('booking.read_self','booking.read_self — phạm vi theo docs/03'),
('booking.read_support','booking.read_support — phạm vi theo docs/03'),
('event.block_any','event.block_any — phạm vi theo docs/03'),
('event.cancel_own','event.cancel_own — phạm vi theo docs/03'),
('event.create','event.create — phạm vi theo docs/03'),
('event.read_public','event.read_public — phạm vi theo docs/03'),
('event.review','event.review — phạm vi theo docs/03'),
('event.submit_own','event.submit_own — phạm vi theo docs/03'),
('event.update_own','event.update_own — phạm vi theo docs/03'),
('layout.manage_own','layout.manage_own — phạm vi theo docs/03'),
('organization.apply','organization.apply — phạm vi theo docs/03'),
('organizer.approve','organizer.approve — phạm vi theo docs/03'),
('profile.update_self','profile.update_self — phạm vi theo docs/03'),
('refund.approve','refund.approve — phạm vi theo docs/03'),
('refund.request_self','refund.request_self — phạm vi theo docs/03'),
('report.create','report.create — phạm vi theo docs/03'),
('report.handle','report.handle — phạm vi theo docs/03'),
('role.assign','role.assign — phạm vi theo docs/03'),
('sales.read_own','sales.read_own — phạm vi theo docs/03'),
('seat.hold','seat.hold — phạm vi theo docs/03'),
('statistics.read_system','statistics.read_system — phạm vi theo docs/03'),
('ticket.checkin_own','ticket.checkin_own — phạm vi theo docs/03'),
('ticket.checkin_self','ticket.checkin_self — phạm vi theo docs/03'),
('ticket.read_self','ticket.read_self — phạm vi theo docs/03'),
('ticket_type.manage_own','ticket_type.manage_own — phạm vi theo docs/03'),
('user.block','user.block — phạm vi theo docs/03'),
('venue.read_catalog','venue.read_catalog — phạm vi theo docs/03')
ON DUPLICATE KEY UPDATE code=permissions.code;
INSERT INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='CUSTOMER' AND p.code IN ('event.read_public','profile.update_self','venue.read_catalog','seat.hold','booking.create','booking.read_self','ticket.read_self','ticket.checkin_self','refund.request_self','report.create','organization.apply')
ON DUPLICATE KEY UPDATE role_id=role_permissions.role_id;
INSERT INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='ORGANIZER' AND p.code IN ('event.read_public','profile.update_self','venue.read_catalog','event.create','event.update_own','event.submit_own','event.cancel_own','layout.manage_own','ticket_type.manage_own','sales.read_own','ticket.checkin_own','refund.approve','report.create','report.handle')
ON DUPLICATE KEY UPDATE role_id=role_permissions.role_id;
INSERT INTO role_permissions (role_id,permission_id)
SELECT r.id,p.id FROM roles r CROSS JOIN permissions p
WHERE r.code='ADMIN' AND p.code IN ('event.read_public','profile.update_self','venue.read_catalog','organizer.approve','role.assign','event.review','event.cancel_own','refund.approve','booking.read_support','user.block','event.block_any','report.handle','audit.read','statistics.read_system')
ON DUPLICATE KEY UPDATE role_id=role_permissions.role_id;
COMMIT;
