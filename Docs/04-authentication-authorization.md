# 04. Xác thực và phân quyền

Nguồn hiện hành: Q-006 đã xác nhận Google + OTP SĐT, Organizer dùng email công ty; ADR-003 phần phiên tiếp tục áp dụng, ADR-013 thay phần đăng nhập mật khẩu. Không triển khai OAuth/SSO khác ngoài nhu cầu này.

## Đăng nhập và tạo tài khoản

Customer chọn Google hoặc nhận OTP điện thoại. Lần xác thực thành công đầu tiên tạo User và role Customer nguyên tử; lần sau mở phiên cho User tương ứng. Không có trường role/owner do client quyết định. Người mua phải có phiên hợp lệ trước hold/checkout.

Google: backend xác minh ID token bằng thư viện provider, kiểm tra signature/iss/aud/exp, nonce/CSRF theo luồng GIS đã chọn; dùng Google sub làm định danh ổn định, không dùng email để tự gộp tài khoản. Không nhận userId/email do frontend khai làm bằng chứng. Google token chỉ dùng trao đổi lúc login, không thay JWT của ứng dụng. Workspace cần kiểm tra hd khi dựa vào hosted domain; email_verified không đủ chứng minh quyền mailbox bên thứ ba. [Hướng dẫn chính thức Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

OTP điện thoại: chuẩn hóa E.164, request challenge và kiểm tra mã dùng một lần. Thiết kế kỹ thuật khởi điểm: 6 chữ số ngẫu nhiên mật mã, TTL 5 phút, tối đa 5 lần thử/challenge, resend ít nhất 60 giây, rate limit theo IP/đích/purpose và giới hạn gửi tổng. Giá trị cấu hình phải benchmark nhưng không được vô hạn. Lưu keyed hash/HMAC với secret ngoài DB (OTP entropy thấp), challengeId/purpose/target/user binding, expiry, attempts và consumed_at; không lưu/log mã rõ. Gửi SMS ngoài transaction bằng adapter. Mã cũ vô hiệu khi cấp challenge thay thế; giới hạn thử không reset vô hạn bằng resend.

Verify khóa challenge, đọc giờ DB, kiểm tra purpose/đích/hạn/số lần/used, tăng attempts thất bại và COMMIT trước trả lỗi; thành công consume và tạo session trong transaction. Hai request cùng mã chỉ một lần consume. Challenge sai/hết hạn/đã dùng trả lỗi chung; request OTP trả 202 chung không lộ tài khoản. Không cho frontend mô phỏng OTP thật ở staging/production.

## Email công ty của Organizer

Người đại diện nhập email thuộc domain công ty, xác minh mailbox rồi nộp hồ sơ Organization. Hỗ trợ Google Workspace nếu domain được chứng minh bằng token hợp lệ; với mail công ty không dùng Google Workspace, dùng email OTP cùng cơ chế challenge để không bắt mọi công ty mua Workspace. Đây là lựa chọn kỹ thuật cho yêu cầu mail công ty, không thêm login mật khẩu.

Email OTP và SMS OTP có purpose/channel riêng, không dùng chéo. Organizer chỉ được quản lý khi phiên có bằng chứng email công ty đúng membership đã duyệt; Google Gmail hoặc phone login có thể dùng Customer nhưng không tự đáp ứng điều kiện phiên tổ chức. Role và Organization approval luôn do Admin, không suy ra chỉ từ domain. Email domain chuẩn hóa/so khớp chính xác; không tự xử lý dấu chấm/alias nhà cung cấp.

MVP không tự merge Google/phone/company identities khi email/display name giống nhau. Muốn gắn phương thức mới phải đang đăng nhập, xác thực lại phương thức hiện có và chứng minh phương thức mới; nếu đã thuộc User khác trả conflict, không chuyển booking/role. Identity linking có transaction/UQ, không tạo User mới rồi tự chuyển dữ liệu. Email công ty thay đổi cần xác minh và duyệt lại trước quyền tổ chức, không sửa qua profile thông thường.

## Phiên ứng dụng và nhiều thiết bị

Access JWT TTL 10 phút trong memory; refresh opaque cookie HttpOnly/Secure/SameSite=Lax, host-only, path /api/v1/auth. Mỗi thiết bị có AuthSession/family độc lập và refresh hạn tuyệt đối 7 ngày, rotation không kéo dài. Không lưu token ở localStorage/sessionStorage/URL. Số thiết bị đồng thời cụ thể chưa giới hạn bằng một con số chưa được duyệt; có rate limit tạo phiên và danh sách thu hồi.

JWT chứa sub/sid/jti/iat/exp/iss/aud/authVersion; allowlist thuật toán/key. Mỗi request riêng tư đọc user.status, authVersion, session và quyền DB. AuthSession lưu phương thức và thời điểm xác thực/company identity để service kiểm tra quyền tổ chức; không tin auth context do client gửi.

Refresh: cookie + Origin/CSRF → BEGIN → khóa session/token, kiểm tra user/session/hạn → token cũ used và token mới cùng family → COMMIT. Reuse token cũ thu hồi family rồi COMMIT trước trả 401. Frontend serialize refresh giữa tab, không retry vô hạn; mất response sau rotation có thể cần login lại. Thu hồi một family không khóa thiết bị khác.

Logout thu hồi session hiện tại/xóa cookie, lặp 204; logout-all tăng authVersion và thu hồi mọi session. User bị block qua report bị thu hồi phiên; mở khóa không hồi sinh token cũ. Google/OTP provider unavailable không bỏ qua xác thực; trả lỗi tạm thời.

## Khôi phục truy cập

Không có mật khẩu nội bộ nên bỏ register/login/reset/change-password bằng mật khẩu khỏi MVP. Người dùng đăng nhập lại qua Google hoặc OTP đã liên kết. Mất cả phương thức đăng nhập không được khôi phục chỉ bằng tên/mã vé; quy trình hỗ trợ phải xác minh danh tính trước thay identity, chưa tự cung cấp một đường bypass.

Admin bootstrap bằng liên kết identity đã xác minh qua thao tác vận hành được kiểm soát, không cho đăng ký công khai chọn Admin. Xác thực lại trước cấp role/can thiệp hỗ trợ nhạy cảm; chính sách MFA riêng khi vận hành thật còn Q-006. Không coi SMS OTP mặc nhiên là đa yếu tố.

## Phân quyền theo tầng và log

Route khai báo permission; middleware xác thực/validate; controller chuyển DTO/actor; service kiểm tra Organization/membership/ownership/report và revalidate dưới khóa; repository chỉ query theo scope. Google, OTP và công ty đều đi qua cùng cơ chế quyền/session.

Không log ID token, OTP, secret HMAC, refresh hoặc Cookie/Authorization. Chuẩn hóa lỗi, giới hạn thử và xử lý reauthentication theo [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). Nhà cung cấp SMS/email thật và cấu hình Google client phải có trước demo live; kiểm thử dùng adapter/sink kiểm soát.
