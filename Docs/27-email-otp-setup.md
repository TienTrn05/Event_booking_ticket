# 27. Cấu hình SMTP Gmail và test auth Customer

Quyết định chủ dự án 2026-10-09, ADR-021: Google OAuth hoặc nhập email/SĐT và xác minh bằng email OTP. SĐT là tên đăng nhập chưa được xác minh bằng SMS. Hai phương thức chỉ dùng chung User sau liên kết tường minh.

## Chuẩn bị database

DB đang có 44 bảng: sao lưu và review `database/migrations/002-email-otp.sql`, chạy bằng DBeaver trên đúng database. DB mới: chạy `database/schema.sql`, seed role và catalog nếu cần; không chạy migration 002 sau schema mới. Không chạy schema.sql trên DB đã có dữ liệu. Migration chưa tự áp dụng lên DB của bạn.

## Cấu hình Gmail ở backend

1. Dùng tài khoản Gmail gửi thư riêng, bật 2-Step Verification, tạo App Password cho ứng dụng. Một số loại tài khoản/chính sách Google không cho tạo App Password. [Hướng dẫn Google](https://support.google.com/accounts/answer/185833).
2. Trong `BE/.env`, thêm `SMTP_USER` là email gửi thư, `SMTP_PASSWORD` là App Password (không phải mật khẩu Gmail). Bỏ khoảng trắng phân nhóm trong App Password; không gửi khóa qua chat/Git/FE.
3. Giữ `OTP_HMAC_KEY` riêng 64 ký tự hex do setup:env tạo, khác JWT secret. Nếu file .env cũ thiếu khóa, sinh 32 byte ngẫu nhiên ở máy bạn và tự điền; không dùng khóa minh họa.
4. Giữ `PUBLIC_APP_URL=http://127.0.0.1:5173/`, JWT_ACCESS_SECRET/JWT_ISSUER/JWT_AUDIENCE. Google config giữ Client ID/secret và callback chính xác `http://127.0.0.1:5173/api/v1/auth/google/callback`.
5. Cài dependency trong BE/ bằng npm ci, khởi động lại BE và FE. Adapter dùng smtp.gmail.com:465/TLS, xác minh chứng chỉ mặc định; không bật logger/debug SMTP. [Nodemailer Gmail](https://nodemailer.com/usage/using-gmail/).

`GET /api/v1/auth/config` trả emailOtpEnabled=true khi đủ cấu hình, không bảo đảm Gmail đã gửi thành công. SMTP login/recipient quota cần kiểm tra thật; Gmail không phải dịch vụ SMS và không có OTP Google cấp sẵn. Ngoài local dùng HTTPS.

## Test trình duyệt

- Đăng ký: email mới, SĐT tùy chọn → gửi mã → lấy 6 số trong inbox/thư rác → xác minh. Navbar hiện tên; reload giữ phiên trên trình duyệt có Web Locks.
- Đăng xuất → đăng nhập bằng email; đăng xuất → đăng nhập bằng SĐT đã đăng ký. Cả hai nhận mã qua cùng email và vào cùng User.
- Email đã dùng Google: email OTP chưa liên kết trả yêu cầu liên kết, không tạo tài khoản mới. Login Google → bấm tên trên navbar → nhập cùng email + SĐT tùy chọn → OTP → liên kết; sau đó Google/email/SĐT dùng chung User.
- Email OTP trước: login email → bấm tên trên navbar → Liên kết Google → chọn đúng email; sau đó Google vào cùng User. Login mới trong 5 phút; nếu quá hạn, đăng xuất/login lại.
- Mã sai/hết hạn/đã dùng bị từ chối, gửi lại sau 60 giây và mã cũ không dùng được. Không gửi code/token/cookie/App Password trong báo lỗi; chỉ gửi HTTP status/error.code.

## Test tự động

Trong BE/: npm test và npm run check. Test tích hợp chạy với AUTH_TEST_DB=1 và DB_* trỏ PostgreSQL test riêng đã nạp schema/role; không dùng database thật. SMTP/Google được mock để không gửi thư ngoài; tests không chứng minh Gmail live hoạt động. Trong Fe/: npm run check.

## Giới hạn

Không có SMS proof hoặc quyền Organizer từ EMAIL. Không tự gộp hai User đã tồn tại riêng; không chuyển alias/identity thuộc User khác. Email công ty, logout-all và danh sách phiên vẫn chưa triển khai. SMTP Gmail có hạn mức; deployment/live auth cần cấu hình và test thực tế riêng.

Nodemailer và kiểu TypeScript đã cài, pin trong package/lock và kiểm tra bằng npm. Không kết nối SMTP lúc khởi động; chỉ gửi khi có yêu cầu OTP. Cần SMTP_USER/SMTP_PASSWORD và migration trước khi gửi thật.

## Máy local đã kiểm tra — 2026-10-10

Migration 002 đã áp dụng sau backup, SMTP Gmail xác thực và chấp nhận gửi một OTP thử theo yêu cầu chủ dự án. Kiểm thử UI desktop/mobile và 20 test PostgreSQL riêng đã qua; code/mocks không thay xác nhận Google callback với tài khoản thật. Google authorization URL mở trang Sign in và không thấy redirect_uri_mismatch. Runtime nvm chung D:/NVM/installs; khởi động lại BE/FE sau thay đổi cấu hình/source.
