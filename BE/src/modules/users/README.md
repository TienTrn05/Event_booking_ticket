# users

Đã có `GET /api/v1/users/me` và `PATCH /api/v1/users/me`. GET trả `{id,displayName,avatarUrl,gender,dateOfBirth}` của User đăng nhập; no-store, không lộ identity/credential/quyền. DOB/gender riêng tư, nullable, không lưu age cố định.

PATCH cần Bearer JWT, Origin Public Web và permission DB `profile.update_self`. Nhận ít nhất một trong displayName (trim 1–120), gender (MALE/FEMALE/OTHER/UNDISCLOSED/null), dateOfBirth (ngày thật không tương lai/null); giữ Unicode, không nhận trường ngoài schema. Avatar qua R2, email/SĐT/identity qua auth/linking riêng. [ADR-023 và kiểm chứng](../../../../Docs/29-profile-follow-age-attendees.md).

http/ chứa routes lắp middleware và controller chuyển HTTP/actor; schemas/ giữ input, services/ kiểm tra User/session/authVersion/permission dưới khóa và cập nhật/audit cùng transaction; repositories/ giữ SQL có tham số/cùng connection; openapi/ giữ contract. Cùng tên trả hồ sơ hiện tại, không audit trùng. Không thay JWT, refresh, cookie, CSRF hoặc provider.

26 kiểm tra HTTP/PostgreSQL riêng đã qua: scope/DTO/no-store, input/mass assignment, permission/session/authVersion bị thu hồi và rollback audit. DB/script thử đã dọn; FE sửa tên chưa nối. Xem [API](../../../../Docs/09-api-design.md), [tiến độ](../../../../Docs/26-auth-progress.md).
