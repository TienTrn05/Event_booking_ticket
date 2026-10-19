# events

Đã có age-restriction cho event DRAFT/version/organization scope và age-eligibility theo ngày suất tại timezone venue; catalog trả minimumAge/ageTag. Hàm tuổi riêng dùng DOB mỗi người, không lưu age. Các API tạo/sửa nháp/submit/review/publish đã triển khai ở management; sửa nội dung đã công bố và Organizer hủy ở operations. Xóa nháp rỗng/phiếu draft/preview và Admin gỡ theo report xem Docs/40. Xem [Docs/29](../../../../Docs/29-profile-follow-age-attendees.md).

`management/` giữ layout indoor/outdoor, cấu hình suất/giá/cửa sổ bán-check-in-vào cửa, submit/snapshot/history/approve/reject/withdraw/expiry và phiếu lý do. Không tách thư mục README rỗng cho layouts/sessions/event-reviews. Layout đóng băng khi submit; server kiểm tra geometry/bounds/capacity và ownership. [Outdoor và giới hạn](../../../../Docs/42-outdoor-zone-ticketing.md).

Controller chỉ HTTP; service kiểm tra quyền/scope, policy và transaction; repository dùng SQL có tham số với cùng connection được truyền vào. Xem Docs/10 và Docs/23 tại gốc repo. Không tạo API giả trả thành công khi nghiệp vụ chưa tồn tại.

API GET lịch sử/snapshot hồ sơ duyệt cho Organizer và Admin, CONTENT comparison đã bổ sung theo quyền hiện có; SQL trong repository, service kiểm tra scope, list/count cùng statement, no-store. Hợp đồng ở Docs/38, không migration mới.

sales-changes/ giữ NEW_SALE_WAVE/CAPACITY có Admin/version; ngoại lệ append-only sau public, không sửa inventory/giá/hold/vé cũ. Shared layout tính tồn kho riêng từng suất. [Docs44](../../../../Docs/44-backend-v1-extensions.md).
