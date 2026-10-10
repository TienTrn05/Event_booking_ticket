# Google auth

Đợt đầu đã triển khai Google Authorization Code + PKCE, access JWT 10 phút, refresh opaque cookie hạn tuyệt đối 7 ngày/thiết bị và thu hồi phiên khi refresh token cũ bị dùng lại. `auth.service.ts` xác minh ID token Google và thao tác PostgreSQL; `auth.routes.ts` xử lý HTTP, cookie, Origin/CSRF. Endpoint: `/auth/config`, `/auth/csrf`, `/auth/google/start`, `/auth/google/callback`, `/auth/refresh`, `/auth/logout`, `/auth/me` dưới `/api/v1`.

Để bật ở local, thêm vào `BE/.env` (giữ bí mật client secret ở backend):

```dotenv
PUBLIC_APP_URL=http://127.0.0.1:5173/
GOOGLE_REDIRECT_URI=http://127.0.0.1:5173/api/v1/auth/google/callback
GOOGLE_CLIENT_ID=<Google OAuth web client ID>
# Điền Google OAuth web client secret chỉ trong BE/.env
# GOOGLE_CLIENT_SECRET=
```

Đăng ký chính xác redirect URI trên trong Google Cloud OAuth client loại Web application. `JWT_ACCESS_SECRET` do `npm run setup:env` tạo; không dùng `GENERATE_ME`. FE chạy ở 5173 và proxy `/api` tới BE 3000. Không cấu hình đủ bốn giá trị thì ứng dụng vẫn chạy catalog nhưng Google auth không bật; cấu hình dở dang làm startup thất bại. Ngoài local phải dùng HTTPS cùng origin của Public Web, cookie Secure và cấu hình redirect thực tế.

FE bắt đầu POST với CSRF, chuyển đến Google, callback đặt refresh cookie rồi redirect về FE. FE POST refresh để lấy access JWT vào memory; không đặt JWT vào URL, localStorage hay sessionStorage. Email OTP Customer và liên kết Google/EMAIL có mã nguồn theo ADR-021; email công ty, logout-all, danh sách thiết bị và quyền Organizer/Admin chưa triển khai. Google login chỉ cấp Customer; email Google hoặc `hd` không tự cấp quyền công ty.

Chạy `npm test` và `npm run check` trong `BE/`; test PostgreSQL cho refresh/reuse chạy khi đặt `AUTH_TEST_DB=1` cùng biến `DB_*` trỏ đến database kiểm thử riêng đã nạp schema. Test Google live cần OAuth client và trình duyệt thật; chưa được chạy tự động.

## ADR-021

Customer có otp/request và otp/verify qua SMTP Gmail. EMAIL khác COMPANY_EMAIL; SĐT chỉ là alias chưa xác minh. SMTP_USER/SMTP_PASSWORD App Password, OTP_HMAC_KEY và session config nằm trong BE/.env. Google/email bật độc lập; linking hai chiều cùng email cần login mới 5 phút, không auto merge. DB cũ cần migration 002 trước khi gửi OTP. Xem [cấu hình/test](../../../../Docs/27-email-otp-setup.md).

Email OTP gửi cả HTML và văn bản thuần qua `otp-email.template.ts`: khung thương hiệu Eventix, mã nổi bật và thời hạn 5 phút. Template dùng bảng và CSS inline, không tải ảnh/font bên ngoài; mã được escape khi đưa vào HTML. Không thay đổi nội dung xác thực hoặc thời hạn OTP.
