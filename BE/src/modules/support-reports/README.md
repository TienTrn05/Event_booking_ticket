# support-reports

Đã có /reports create/list/detail và /admin/reports queue/claim/resolve. Report đúng booking của người gửi hoặc event trong scope; Organizer chỉ event report không chứa booking của khách. ADMIN/permission/report IN_REVIEW được giao đúng tài nguyên mới đọc summary booking hoặc gỡ event. Đóng report thu hồi scope, không QR/CCCD/credential. Resolve dùng service hiện có, tương thích /admin/support-reports trong refunds.

POST /admin/events/:id/unpublish chuyển PUBLISHED→ARCHIVED, ngừng public/bán/check-in/vào cửa; giữ đơn/vé/tiền, không refund/đền bù. Không endpoint Admin khóa/mở khóa User. ADR-035/Docs40.
