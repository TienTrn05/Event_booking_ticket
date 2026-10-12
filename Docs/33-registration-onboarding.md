# 33. Đăng ký cá nhân và gợi ý sự kiện

Quyết định chủ dự án 2026-10-11, Q-027/ADR-029. Một FE theo ADR-028; BE Modular Monolith. Không AI/ML.

## Đăng ký

Google Authorization Code + PKCE hoặc email OTP xác minh danh tính như trước. Email cá nhân dùng được cho Organizer. Không có mật khẩu mới, tự gộp identity theo email hay cơ chế company OTP mới.

Sau lần xác minh đầu, User/phiên được tạo nhưng chưa có vai trò nghiệp vụ. FE hỏi hai bước:

1. Chọn Customer hoặc Organizer, nhập displayName, giới tính và ngày sinh. Có lựa chọn không tiết lộ giới tính; DOB phải là ngày thật, không ở tương lai.
2. Chọn danh mục yêu thích, thành phố và Organizer quan tâm, hoặc bỏ qua để hoàn tất.

API không nhận ADMIN. Customer nhận CUSTOMER; Organizer chỉ nhận ORGANIZER. Organizer có thể bật thêm Customer bằng hành động riêng; không được đổi role qua PATCH profile. Admin hiện chỉ kiểm thử fixture trên DB tạm, chưa cấp tài khoản thật.

User cũ giữ dữ liệu và quyền trong migration, trạng thái onboarding chưa hoàn tất. Khi chọn Organizer, API bỏ Customer mặc định cũ nếu granted_by NULL, giữ vai trò cấp tường minh và mọi lịch sử. Lượt hold/đơn chờ tiền còn hiệu lực ngăn lựa chọn này; không làm mất quyền xử lý giao dịch đang có. Vai trò kiểm tra trong DB ở mỗi request, không tin lựa chọn frontend/JWT role claim.

## API và Swagger

Swagger tại BE `/api/docs/`; Bearer của phiên đã xác minh chỉ dùng trong môi trường cá nhân, không đưa vào log/tài liệu hoặc chia sẻ. Các mutation yêu cầu Origin đúng PUBLIC_APP_URL. API no-store, ownership theo phiên.

| API | Hành vi |
| --- | --- |
| GET `/users/me/onboarding` | Hồ sơ, trạng thái hoàn tất, vai trò và lựa chọn hiện tại |
| GET `/users/me/onboarding/options` | Slug danh mục, tên thành phố, public ID Organizer được duyệt |
| PUT `/users/me/onboarding` | Bốn trường bắt buộc; optional preferences/follows; Idempotency-Key bắt buộc |
| PATCH `/users/me` | Sửa tên/giới tính/DOB; không cho xóa gender/DOB, không nhận role |
| PUT `/users/me/preferences` | Thay toàn bộ category/city; []/null để bỏ lựa chọn |
| PUT/DELETE `/organizers/{publicId}/follow` | Theo dõi/bỏ theo dõi; Customer có thể bật notification, Organizer chỉ sở thích |
| POST `/users/me/roles/customer` | Organizer bật quyền mua vé; body {}, Idempotency-Key |
| GET `/users/me/recommendations?limit=12` | Sự kiện được gợi ý từ DB, giới hạn 1–40 |

Body đăng ký tối thiểu:

```json
{
  "role": "ORGANIZER",
  "displayName": "Nhà tổ chức thử nghiệm",
  "gender": "UNDISCLOSED",
  "dateOfBirth": "1998-05-20"
}
```

Category/city/follow defaults lần lượt []/null/[]. Chọn theo ID trả về từ options. Giới hạn 10 category, 20 Organizer trong đăng ký. Retry mutation cùng key và body; cùng key khác body trả conflict. Hoàn tất một lần, sau đó sửa qua profile/preferences/follow. FE chỉ giữ dữ liệu onboarding trong bộ nhớ; không lưu DOB/role/JWT vào localStorage/sessionStorage.

## Gợi ý RULES_V1

Chỉ ứng viên event PUBLISHED/publication đã đến giờ, tổ chức APPROVED và có suất SCHEDULED tương lai. Chọn tối đa 200 ứng viên sắp diễn ra từ DB, trả tối đa 40. Điểm: Organizer theo dõi +40, category +30, city +20, thời gian sắp diễn ra +0..20 và độ phổ biến +0..10 từ số vé đã phát trong đơn CONFIRMED. Mỗi vị trí thứ tư ưu tiên mức phổ biến để khám phá. Xếp tie theo thời gian/public ID; không lặp event, không hiện suất đã qua.

Chưa có sở thích vẫn có gợi ý theo thời gian/phổ biến. Không trả số vé bán cụ thể, DOB hay CCCD của bất kỳ người dùng nào. FE có mục Dành cho bạn và sửa lựa chọn trong Tài khoản → Sửa hồ sơ, sở thích và vai trò.

Giới hạn hiện tại: không phải công cụ tìm kiếm toàn bộ catalog hoặc mô hình học; 200 ứng viên có thể bỏ qua sự kiện xa hơn. Dashboard Organizer/Admin chưa được dựng trong bước BE này.

## Dữ liệu và migration

Không thêm bảng. Users có registration_role/onboarding_completed_at/favorite_categories/preferred_city; vai trò thực tế vẫn user_roles. Rename company metadata của organizations/memberships thành applicant/member/contact, giữ các FK identity và lịch sử. Thêm membership PENDING để soạn nháp trước approval.

DB cũ cần 008 rồi 009; DB rỗng dùng schema.sql và seed. Không chạy schema.sql trên DB có dữ liệu hoặc chạy lại migration đã áp dụng. Kiểm chứng fresh/upgrade có seed và integration trong `BE/npm run test:commerce`; progress thực tế tại [26](26-auth-progress.md).

ADR-030 / chủ dự án chốt2026-10-12: Admin có onboarding.manage để cấu hình câu hỏi bổ sung (thêm/bỏ/required/nhãn/thứ tự). Bốn trường role/displayName/gender/DOB luôn bắt buộc. Bộ câu hỏi có phiên bản; giữ câu trả lời cũ, không cấp quyền từ custom answers. Xem Docs/35.
