# 04. Xác thực và phân quyền

Liên quan: FR-001–FR-005, NFR-004/NFR-010, ADR-003, [ma trận quyền](03-user-roles-permissions.md).

## Chiến lược đề xuất

JWT access token ngắn hạn dùng cho `Authorization: Bearer`; refresh token là chuỗi ngẫu nhiên opaque có entropy cao, không cần là JWT. Access token chỉ ở bộ nhớ frontend; refresh token ở cookie `HttpOnly; Secure; SameSite=Lax`, host-only, path `/api/v1/auth`. Ưu tiên web/API cùng origin qua reverse proxy. Không lưu token trong localStorage/sessionStorage hoặc URL.

Đề xuất access TTL 10 phút, refresh có hạn tuyệt đối 7 ngày cho từng thiết bị; rotation không kéo dài hạn tuyệt đối. `DECISION REQUIRED (Q-006)`: TTL, số thiết bị và cách xác minh email. Backend lưu hash refresh token, family/session ID, token cha, thời hạn, thời điểm dùng/thu hồi; giữ bản ghi token đã dùng đến hết thời gian điều tra cấu hình.

JWT chứa `sub`, `sid`, `jti`, `iat`, `exp`, `iss`, `aud`, `authVersion`; không chứa PII/bí mật. Allowlist thuật toán và key ID; kiểm tra signature, issuer, audience và expiry. Mỗi request riêng tư đối chiếu user status/authVersion và phiên `sid` trong DB để logout/khóa có hiệu lực tức thời. Đây là đánh đổi truy vấn DB để có revocation rõ ràng; JWT không biến hệ thống thành hoàn toàn stateless.

Refresh token rotation giúp hạn chế tái sử dụng; phát hiện token cũ dùng lại thì thu hồi cả family. Cơ chế này tham khảo [RFC 9700, mục 4.14](https://www.rfc-editor.org/rfc/rfc9700.html#section-4.14); hệ thống không vì thế được coi là triển khai đầy đủ OAuth.

## Luồng xác thực

### Đăng ký, email và kích hoạt

1. Validate email/mật khẩu; chuẩn hóa email theo Q-006, không tự xử lý dấu chấm/alias của nhà cung cấp.
2. Hash mật khẩu bằng Argon2id; transaction tạo User và role Customer, user PENDING_VERIFICATION nếu áp dụng xác minh.
3. Tạo VerificationToken dùng một lần, chỉ lưu hash. Gửi link qua adapter email ngoài transaction; môi trường dev dùng hộp thư thử có kiểm soát.
4. Khi nhận token: khóa bản ghi, kiểm tra loại, hạn và chưa dùng; đánh dấu used và email verified; chuyển ACTIVE nếu không bị khóa bởi quản trị.
5. Token sai/hết hạn: lỗi chung và cho gửi lại có cooldown. Email trùng: phản hồi không tiết lộ tài khoản; log chỉ thông tin đã giảm nhận dạng.

`DECISION REQUIRED (Q-006)`: xác minh email có bắt buộc trước mua vé, TTL đề xuất 24 giờ, nhà cung cấp gửi thư. Không đánh dấu verified giả trên production.

### Đăng nhập và bảo vệ thất bại

1. Rate limit theo IP và định danh đã hash; validate input; so sánh hash mật khẩu với thời gian xử lý hạn chế khác biệt, dùng dummy hash khi user không tồn tại.
2. Sai email/mật khẩu hoặc không được đăng nhập: thông báo chung. Theo dõi lỗi; trì hoãn tăng dần có trần, không khóa vĩnh viễn chỉ vì kẻ khác thử sai.
3. Kiểm tra user status; tạo AuthSession và refresh token trong transaction; commit rồi set cookie và trả access token.
4. Không trả hash mật khẩu; ghi login success/failure đã lọc. Nếu vượt số thiết bị theo Q-006, áp dụng chính sách được duyệt, không âm thầm xóa phiên.

### Refresh và nhiều tab

1. Client gửi cookie, CSRF token và Origin hợp lệ đến `/auth/refresh`; không dùng access token hết hạn để quyết định quyền refresh.
2. BEGIN; khóa session rồi refresh token theo hash; kiểm tra user, session, thời hạn và revoked/used.
3. Nếu token đã dùng: thu hồi family/session, COMMIT thay đổi thu hồi rồi trả 401; không rollback việc thu hồi khi tạo lỗi HTTP.
4. Nếu hợp lệ: đánh dấu token cũ used, tạo token mới cùng family và hạn tuyệt đối; COMMIT; set cookie mới, trả access token.
5. Frontend phối hợp refresh một lần giữa các tab, không tự retry vô hạn. Hai refresh dùng cùng token có thể gây thu hồi family; với thiết kế nghiêm ngặt này, mất response sau rotation yêu cầu đăng nhập lại. Nới khoảng dung sai cần ADR về rủi ro replay.

### Logout và quản lý phiên

- Logout: thu hồi session/family tương ứng, xóa cookie cùng thuộc tính; lặp lại vẫn 204. Access token cũ bị chặn nhờ kiểm tra session trên request tiếp theo.
- Logout-all: cập nhật `auth_version` và thu hồi mọi session trong transaction; client xóa access token/cookie.
- Đổi mật khẩu: yêu cầu mật khẩu hiện tại, hash mật khẩu mới; cập nhật và thu hồi tất cả phiên; người dùng đăng nhập lại.
- Khóa user: cùng cơ chế thu hồi và authVersion; mở khóa không khôi phục token cũ.

### Quên/đặt lại mật khẩu

Forgot-password luôn trả 202 chung. Tạo reset token ngẫu nhiên, hash trong DB, TTL đề xuất 15 phút (Q-006), giới hạn gửi và không log link. Reset: validate mật khẩu mới; BEGIN, khóa user và token theo thứ tự thống nhất của module auth; kiểm tra hạn/chưa dùng, cập nhật password hash, đánh dấu token used, thu hồi các reset token khác và session; COMMIT. Token dùng lại bị từ chối; reset không tự đăng nhập, không tự bỏ trạng thái BLOCKED hoặc xác minh email.

## Phân quyền theo tầng

| Tầng | Trách nhiệm |
| --- | --- |
| Route | Khai báo middleware và permission yêu cầu của endpoint |
| Middleware | Xác thực JWT/session; chặn thiếu permission tổng quát; validate schema, CSRF khi cần |
| Controller | Nhận actor đã xác thực; chuyển DTO; không quyết định ownership |
| Service | Kiểm tra permission theo ngữ cảnh, ownership, trạng thái tài khoản/tài nguyên; kiểm tra lại điều kiện thay đổi dưới khóa |
| Repository | Nhận actor scope/điều kiện do service xác định, query có tham số; không tự quyết định cho phép theo role |

Không chỉ dựa vào quyền nhúng JWT vì quyền có thể thay đổi. Dữ liệu role/permission lấy từ DB ở MVP. Job và callback cũng đi qua service với danh tính và phạm vi được xác minh, không bỏ qua bất biến bằng đường gọi nội bộ.
