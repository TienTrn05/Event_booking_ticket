# notifications

Đã có follow/list/mute/unfollow cho Customer, inbox của User/read/unreadCount với phân trang và scope. Deferred DB hook ghi outbox khi event PUBLISHED + publication; worker thuần DB fan-out 500 mỗi transaction, cursor/dedupe/SKIP LOCKED. Không email/push hoặc cấp quyền Organizer qua follow.

Chạy `npm run worker:notifications` trong BE để dispatch và purge CCCD quá hạn; API riêng không chạy worker. Xem [Docs/29](../../../../Docs/29-profile-follow-age-attendees.md) và Swagger. Luồng event review/publish đầy đủ vẫn chưa có API, hook xử lý trạng thái DB hợp lệ khi được ghi.

Controller chỉ HTTP; service kiểm tra quyền/scope, policy và transaction; repository dùng SQL có tham số với cùng connection được truyền vào. Xem Docs/10 và Docs/23 tại gốc repo. Không tạo API giả trả thành công khi nghiệp vụ chưa tồn tại.
