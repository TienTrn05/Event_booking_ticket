# events

Đã có age-restriction cho event DRAFT/version/company scope và age-eligibility theo ngày suất tại timezone venue; catalog trả minimumAge/ageTag. Hàm tuổi riêng dùng DOB mỗi người, không lưu age. Những endpoint tạo/sửa nội dung/submit/review/publish đầy đủ vẫn chưa triển khai. Xem [Docs/29](../../../../Docs/29-profile-follow-age-attendees.md).

Controller chỉ HTTP; service kiểm tra quyền/scope, policy và transaction; repository dùng SQL có tham số với cùng connection được truyền vào. Xem Docs/10 và Docs/23 tại gốc repo. Không tạo API giả trả thành công khi nghiệp vụ chưa tồn tại.
