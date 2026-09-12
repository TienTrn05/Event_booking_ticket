# 03. Vai trò và phân quyền

Nguồn: quyết định chủ dự án 2026-09-12, Q-005/Q-010 và [23](23-organization-review-seatmap.md). Organizer là Organization; User đăng nhập đại diện qua membership được Admin duyệt.

## Tác nhân

| Vai trò | Trách nhiệm | Giới hạn |
| --- | --- | --- |
| Guest | Xem event/session/ghế công khai, đăng nhập Google hoặc OTP | Không hold/mua/check-in tài nguyên riêng |
| Customer | Giữ ghế, booking, khai tên người tham dự, xem vé, self check-in, refund/report | Chỉ đơn/vé/report của mình |
| Organizer | Quản lý event/session/layout/loại vé/giá, quầy check-in, vào cửa, sales và refund thuộc tổ chức | Không tự cấp role, tự publish, sửa giới hạn venue chung hoặc tự xác nhận tiền |
| Admin | Duyệt tổ chức/role và sự kiện; lập phiếu lý do; xử lý report cần hỗ trợ | Không vận hành thay Organizer; can thiệp quản lý cần report đúng scope, lý do và audit |
| System | Expiry, processor, job/outbox, thông báo hết hạn hồ sơ | Không phải tài khoản đăng nhập hoặc cách bypass bất biến |

UserRole có nhiều role tường minh; Organizer/Admin muốn mua cần Customer. Organizer cần OrganizationMembership ACTIVE và Organization APPROVED. Phiên dùng cho quản lý phải được xác thực bằng email công ty đã duyệt theo 04; login điện thoại đơn thuần không tự trở thành phiên tổ chức. Không chia sẻ một tài khoản/mật khẩu công ty cho nhiều người.

## Ma trận quyền

Các permission mới là hợp đồng logic; seed/DDL baseline phải cập nhật trước implementation.

| Permission / hành động | Customer | Organizer | Admin |
| --- | --- | --- | --- |
| event.read_public | Có | Có | Có |
| profile.update_self | Chính mình | Chính mình | Chính mình |
| seat.hold, booking.create, booking.read_self, ticket.read_self | Chính mình | Cần Customer riêng | Cần Customer riêng |
| ticket.checkin_self | Vé thuộc booking của mình, tên/mã khớp, đúng cửa sổ | Cần Customer riêng | Cần Customer riêng |
| refund.request_self, report.create | Tài nguyên của mình | Report thuộc tổ chức; refund mua cần Customer | Không tự tạo report giả để mở rộng quyền |
| organization.apply | Gửi hồ sơ đại diện | Không tự duyệt | Không tự sửa hồ sơ của người xin |
| organizer.approve, role.assign | Không | Không | Cấp role qua hồ sơ có audit |
| event.create, event.update_own, event.submit_own | Không | Organization mình, đúng status/version | Không sửa vận hành |
| event.review | Không | Không | Danh sách/bản gửi/approve/reject/phiếu lý do |
| event.cancel_own | Không | Organization mình theo policy | Report cần can thiệp |
| venue.read_catalog | Xem phần công khai cần thiết | Chọn venue | Xem phục vụ duyệt |
| layout.manage_own, ticket_type.manage_own | Không | Organization mình, đúng version/status | Không sửa vận hành |
| sales.read_own, ticket.checkin_own | Không | Sales, quầy và vào cửa event của tổ chức | Không vận hành thường xuyên |
| refund.approve | Không | Event thuộc tổ chức | Report đúng phạm vi cần hỗ trợ |
| booking.read_support, user.block, event.block_any | Không | Không | Report OPEN/IN_REVIEW liên quan, lý do/audit |
| report.handle | Không | Phần tổ chức được phép xử lý | Tiếp nhận và giải quyết report |
| audit.read, statistics.read_system | Không | Không | Scope review/report và thống kê tổng hợp, không bí mật |

Venue/category demo do seed có kiểm soát cung cấp; quyền maintenance catalog thật theo Q-009, không tự gán thành quyền sửa event của Admin.

## Kiểm tra theo tầng

Route → middleware JWT/session/user/permission → controller DTO/actor → service membership, Organization.status, ownership, report khi cần và trạng thái dưới khóa → repository query theo scope. Không tin organizationId/reportId client gửi.

Event.organization_id là chủ nghiệp vụ; created_by/reviewed_by là User để audit. Khách xem đơn theo booking.customer_id. Admin được đọc bản gửi duyệt của tổ chức khác nhưng không được PATCH nội dung. Report phải liên quan đúng event/booking/user, chưa đóng, actor có quyền xử lý; không tái sử dụng report đã đóng cho thao tác mới. Cấp/thu hồi role có hiệu lực qua DB trên request tiếp theo.

Ngoài scope trả 404; thiếu permission chung trả 403. Admin không bypass BR-001/BR-004. Self check-in không tự cấp vé hoặc đánh dấu USED; vào cửa vẫn kiểm tra online một lần. Guard frontend chỉ là UX.
