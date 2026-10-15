# events

Đã có age-restriction cho event DRAFT/version/company scope và age-eligibility theo ngày suất tại timezone venue; catalog trả minimumAge/ageTag. Hàm tuổi riêng dùng DOB mỗi người, không lưu age. Các API tạo/sửa nháp/submit/review/publish đã triển khai ở management; sửa nội dung đã công bố và Organizer hủy ở operations. Xóa nháp rỗng/phiếu draft/preview và Admin gỡ theo report xem Docs/40. Xem [Docs/29](../../../../Docs/29-profile-follow-age-attendees.md).

Controller chỉ HTTP; service kiểm tra quyền/scope, policy và transaction; repository dùng SQL có tham số với cùng connection được truyền vào. Xem Docs/10 và Docs/23 tại gốc repo. Không tạo API giả trả thành công khi nghiệp vụ chưa tồn tại.

API GET lịch sử/snapshot hồ sơ duyệt cho Organizer và Admin, CONTENT comparison đã bổ sung theo quyền hiện có; SQL trong repository, service kiểm tra scope, list/count cùng statement, no-store. Hợp đồng ở Docs/38, không migration mới.
