# 35. Admin quản lý câu hỏi onboarding

Chủ dự án chốt 2026-10-12: giữ role/displayName/gender/dateOfBirth luôn bắt buộc. Admin quản lý các câu bổ sung, không thay cơ chế cấp quyền qua câu trả lời tự do. ADR-030/Q-028 bổ sung ADR-029.

## Giao diện

Admin mở `/admin/onboarding` trong cùng FE. Có thể thêm/bỏ câu hỏi, sửa nhãn, đổi thứ tự và đánh dấu bắt buộc. Bốn trường lõi hiển thị là quy tắc cố định, không có nút xóa hoặc tùy chọn tắt bắt buộc.

Các nguồn có sẵn: danh mục yêu thích, thành phố và Organizer được duyệt để theo dõi. Câu tự thêm hỗ trợ văn bản ngắn, chọn một hoặc chọn nhiều; lựa chọn nhập theo mỗi dòng `mã | nhãn`. Tối đa 20 câu bổ sung, 20 lựa chọn/câu; nhãn tối đa160 ký tự, text answer tối đa500 ký tự. Bộ câu hỏi có thể rỗng: đăng ký vẫn nhập bốn trường lõi.

Nút Xuất bản lưu phiên bản mới. Admin sửa trong form local trước khi lưu; phiên bản đã xuất bản giữ nguyên nội dung. Nếu Admin khác đã lưu trước, trả conflict và cần tải bản hiện hành. Body cấu hình giới hạn256 KB, các endpoint khác giữ giới hạn hiện có.

Form đăng ký lấy câu hỏi/thứ tự/required từ BE, đánh dấu `*`, chỉ có nút bỏ qua khi tất cả câu bổ sung đều tùy chọn. BE kiểm tra lại, không tin validation FE. Form cũ khi Admin vừa thay cấu hình trả409 trước khi ghi hồ sơ/cấp role; FE tải lại câu hỏi, giữ nội dung bốn trường lõi đang nhập.

## API và quyền

| API | Điều kiện |
| --- | --- |
| GET `/admin/onboarding/questions` | `onboarding.manage`, chỉ ánh xạ ADMIN |
| PUT `/admin/onboarding/questions` | Quyền trên, Origin đúng, Idempotency-Key, questionnaireId hiện tại và questions[] |
| GET `/users/me/onboarding/options` | Phiên hợp lệ, trả questionnaire `{id,questions}` cùng danh mục/city/Organizer |
| PUT `/users/me/onboarding` | Bốn trường lõi, questionnaireId, answers{} và fields sở thích hiện có |
| GET `/users/me/onboarding` | Chỉ hồ sơ/câu trả lời của actor và bộ câu hỏi lúc hoàn tất |
| PUT `/users/me/onboarding/answers` | Actor đã hoàn tất, thay custom answers theo bộ câu hỏi đã trả lời |

Keys của ba câu có sẵn là favoriteCategories/preferredCity/followedOrganizers; các field này tiếp tục lưu tại Users/organization_follows. Câu mới có key `custom_*`, answers chỉ chấp nhận key nằm trong bộ câu hỏi, đúng kiểu và lựa chọn. Không cho dùng key role/displayName/gender/dateOfBirth hoặc gán ADMIN, permission, owner/status qua custom answers.

Chỉ phiên bản mặc định đầu tiên còn tương thích client cũ không gửi questionnaireId; sau lần Admin thay cấu hình, phiên bản bắt buộc. Retry cùng key/body vẫn trả kết quả cũ sau khi Admin thay bộ câu hỏi. Chỉ quyền backend quyết định quản lý cấu hình; việc có route FE không cấp quyền. Chưa cấp tài khoản Admin thật; kiểm thử bằng fixture trên DB tạm.

## Phiên bản và tài khoản đã đăng ký

Cập nhật áp dụng cho lượt đăng ký chưa hoàn tất. Người đã hoàn tất không bị buộc trả lời lại hoặc cấp lại vai trò. Họ vẫn xem/sửa custom answers theo nhãn/kiểu/bộ câu hỏi đã trả lời; khi Admin bỏ câu hỏi, không xóa các câu trả lời lịch sử đó.

Required của category/city/follow được kiểm tra tại lúc đăng ký; chức năng sửa sở thích sau đăng ký vẫn độc lập. Custom answer bắt buộc được kiểm tra khi sửa theo phiên bản gắn với tài khoản. Câu mới chưa dùng cho gợi ý hoặc cấp quyền: RULES_V1 vẫn chỉ dùng category/city/follow/time/popularity.

## Dữ liệu và migration

Đã kiểm tra DB local read-only: 46 bảng, chưa có bảng form/questionnaire/config tương đương. Thêm onboarding_questionnaires vì bộ câu hỏi có vòng đời xuất bản/archived và dùng chung cho nhiều tài khoản, độc lập vòng đời User/event review. Câu trả lời riêng dùng Users.onboarding_answers JSONB và FK onboarding_questionnaire_id; không tạo bảng answers1:1, không sao chép category/city/follow vào JSON.

Migration010 sau008/009: seed bộ ba câu optional tương thích ban đầu, một phiên bản ACTIVE bằng unique index, archive phiên bản trước trong transaction khi publish; audit metadata và idempotency, không log câu trả lời. Cập nhật theo yêu cầu chủ dự án2026-10-12: đã backup và áp dụng008–011 DB local. DDL fresh/local45 bảng sau gộp hai extension catalog (ADR-031). Chưa cấp Admin thật. Backup trước khi chạy; rollback ứng dụng nên giữ bảng/version/answers, không xóa lịch sử.

Kiểm chứng và giới hạn thực tế ghi tại [26](26-auth-progress.md). Không đổi JWT/refresh/provider/linking, payOS, attendee/CCCD hoặc kiến trúc monolith.

Lưu cấu hình không thay đổi trả phiên bản hiện tại, không làm form đang nhập bị stale hoặc tạo version thừa.
