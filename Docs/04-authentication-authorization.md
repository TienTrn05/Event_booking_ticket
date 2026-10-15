# 04. Xác thực và phân quyền

> Quyết định hiện hành 2026-10-11: ADR-028 dùng một FE với ba khu vực; ADR-029 cho chọn Customer hoặc Organizer khi onboarding bằng Google/email cá nhân. Không còn yêu cầu domain/phiên công ty để vận hành Organizer. Vai trò, tên, giới tính và ngày sinh bắt buộc; sở thích/thành phố/theo dõi có thể bỏ qua. Organizer không tự nhận Customer; tạo nháp ngay, Admin vẫn duyệt tổ chức và sự kiện trước mở bán. Các đoạn mô tả cơ chế cũ dưới đây được thay thế trong phạm vi này. Xem [33](33-registration-onboarding.md) và [34](34-organizer-event-api.md).

Nguồn hiện hành: Q-006 cập nhật 2026-10-09 xác nhận Google OAuth + OTP email Customer, Organizer dùng email công ty; ADR-003 phần phiên tiếp tục áp dụng, ADR-013 thay phần đăng nhập mật khẩu. Không triển khai OAuth/SSO khác ngoài nhu cầu này.

## Đăng nhập và tạo tài khoản

Customer chọn Google hoặc nhập email/SĐT và nhận OTP qua email SMTP Gmail. SĐT chỉ là alias chưa xác minh, không phải identity PHONE có proof SMS. Lần xác thực thành công đầu tiên tạo User và role Customer nguyên tử; lần sau mở phiên cho User tương ứng. Không có trường role/owner do client quyết định. Người mua phải có phiên hợp lệ trước hold/checkout.

Google (quyết định chủ dự án 2026-10-03): dùng Authorization Code + PKCE. Backend tạo state, nonce và code verifier, chuyển trình duyệt đến Google, nhận callback và đổi code trên backend. Backend xác minh ID token bằng thư viện provider, kiểm tra signature/iss/aud/exp/nonce; dùng Google sub làm định danh ổn định, không dùng email để tự gộp tài khoản. Không nhận userId/email do frontend khai làm bằng chứng. Google token chỉ dùng trao đổi lúc login, không thay JWT của ứng dụng. Workspace cần kiểm tra hd khi dựa vào hosted domain; email_verified không đủ chứng minh quyền mailbox bên thứ ba. [Google OAuth web server](https://developers.google.com/identity/protocols/oauth2/web-server), [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect).

OTP email Customer: email trim/lowercase, không gộp dấu chấm/alias Gmail. SĐT Việt Nam 10 số đổi sang +84; số quốc tế dùng E.164. Đăng ký email và SĐT tùy chọn; nhập SĐT chỉ tra email đã đăng ký. Request challenge và kiểm tra mã dùng một lần. Thiết kế kỹ thuật khởi điểm: 6 chữ số ngẫu nhiên mật mã, TTL 5 phút, tối đa 5 lần thử/challenge, resend ít nhất 60 giây, rate limit theo IP/đích/purpose và giới hạn gửi tổng. Giá trị cấu hình phải benchmark nhưng không được vô hạn. Lưu keyed hash/HMAC với secret ngoài DB (OTP entropy thấp), challengeId/purpose/target/user binding, expiry, attempts và consumed_at; không lưu/log mã rõ. Gửi email ngoài transaction bằng adapter; challenge chỉ verify sau SMTP thành công, gửi thất bại thu hồi challenge. Không trả/log mã rõ. Mã cũ vô hiệu khi cấp challenge thay thế; giới hạn thử không reset vô hạn bằng resend.

Verify khóa challenge, đọc giờ DB, kiểm tra purpose/đích/hạn/số lần/used, tăng attempts thất bại và COMMIT trước trả lỗi; thành công consume và tạo session trong transaction. Hai request cùng mã chỉ một lần consume. Challenge sai/hết hạn/đã dùng trả lỗi chung; request OTP trả 202 chung không lộ tài khoản. Không cho frontend mô phỏng OTP thật ở staging/production.

## Email công ty của Organizer

Người đại diện nhập email thuộc domain công ty, xác minh mailbox rồi nộp hồ sơ Organization. Hỗ trợ Google Workspace nếu domain được chứng minh bằng token hợp lệ; với mail công ty không dùng Google Workspace, dùng email OTP cùng cơ chế challenge để không bắt mọi công ty mua Workspace. Đây là lựa chọn kỹ thuật cho yêu cầu mail công ty, không thêm login mật khẩu.

EMAIL Customer và COMPANY_EMAIL có purpose/channel riêng, không dùng chéo; SMS Customer đã được thay thế theo ADR-021. Organizer chỉ được quản lý khi phiên có bằng chứng email công ty đúng membership đã duyệt; Google Gmail hoặc EMAIL Customer có thể dùng Customer nhưng không tự đáp ứng điều kiện phiên tổ chức. Role và Organization approval luôn do Admin, không suy ra chỉ từ domain. Email domain chuẩn hóa/so khớp chính xác; không tự xử lý dấu chấm/alias nhà cung cấp.

MVP không tự merge Google/EMAIL/company identities khi email/display name giống nhau. Muốn gắn phương thức mới phải đang đăng nhập, xác thực lại phương thức hiện có và chứng minh phương thức mới; nếu đã thuộc User khác trả conflict, không chuyển booking/role. Identity linking có transaction/UQ, không tạo User mới rồi tự chuyển dữ liệu. Email công ty thay đổi cần xác minh và duyệt lại trước quyền tổ chức, không sửa qua profile thông thường.

## Phiên ứng dụng và nhiều thiết bị

Access JWT TTL 10 phút trong memory; refresh opaque cookie HttpOnly/Secure/SameSite=Lax, host-only, path /api/v1/auth. Mỗi thiết bị có AuthSession/family độc lập và refresh hạn tuyệt đối 7 ngày, rotation không kéo dài. Không lưu token ở localStorage/sessionStorage/URL. Số thiết bị đồng thời cụ thể chưa giới hạn bằng một con số chưa được duyệt; có rate limit tạo phiên và danh sách thu hồi.

JWT chứa sub/sid/jti/iat/exp/iss/aud/authVersion; allowlist thuật toán/key. Mỗi request riêng tư đọc user.status, authVersion, session và quyền DB. AuthSession lưu phương thức và thời điểm xác thực/company identity để service kiểm tra quyền tổ chức; không tin auth context do client gửi.

Refresh: cookie + Origin/CSRF → BEGIN → khóa session/token, kiểm tra user/session/hạn → token cũ used và token mới cùng family → COMMIT. Reuse token cũ thu hồi family rồi COMMIT trước trả 401. Frontend serialize refresh giữa tab, không retry vô hạn; mất response sau rotation có thể cần login lại. Thu hồi một family không khóa thiết bị khác.

Logout thu hồi session hiện tại/xóa cookie, lặp 204; logout-all tăng authVersion và thu hồi mọi session. User bị block qua report bị thu hồi phiên; mở khóa không hồi sinh token cũ. Google/OTP provider unavailable không bỏ qua xác thực; trả lỗi tạm thời.

## Khôi phục truy cập

Không có mật khẩu nội bộ nên bỏ register/login/reset/change-password bằng mật khẩu khỏi MVP. Người dùng đăng nhập lại qua Google hoặc email OTP đã liên kết. Mất cả phương thức đăng nhập không được khôi phục chỉ bằng tên/mã vé; quy trình hỗ trợ phải xác minh danh tính trước thay identity, chưa tự cung cấp một đường bypass.

Admin bootstrap bằng liên kết identity đã xác minh qua thao tác vận hành được kiểm soát, không cho đăng ký công khai chọn Admin. Xác thực lại trước cấp role/can thiệp hỗ trợ nhạy cảm; chính sách MFA riêng khi vận hành thật còn Q-006. Không coi SMS OTP mặc nhiên là đa yếu tố.

## Phân quyền theo tầng và log

Route khai báo permission; middleware xác thực/validate; controller chuyển DTO/actor; service kiểm tra Organization/membership/ownership/report và revalidate dưới khóa; repository chỉ query theo scope. Google, OTP và công ty đều đi qua cùng cơ chế quyền/session.

Không log ID token, OTP, secret HMAC, refresh hoặc Cookie/Authorization. Chuẩn hóa lỗi, giới hạn thử và xử lý reauthentication theo [OWASP Authentication](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html). Cấu hình SMTP Gmail Customer và Google client phải có trước demo live; provider email công ty/Organizer vẫn là đợt sau; kiểm thử dùng adapter/sink kiểm soát.

## Auth Customer và liên kết — ADR-021

EMAIL Customer dùng email làm subject; Google vẫn dùng sub. Alias SĐT trỏ EMAIL, không chứng minh quyền sở hữu số điện thoại và không dùng để khôi phục/cấp quyền. Email đã thuộc Google: verify OTP trả LINK_REQUIRED thay vì tạo User thứ hai; login Google, mở Tài khoản, xác minh OTP cùng email để bật EMAIL/SĐT. Chiều ngược lại: login EMAIL, mở Tài khoản, liên kết Google cùng email_verified. Phiên linking phải mới trong 5 phút từ authenticated_at (refresh không làm mới), kiểm tra lại User/session dưới khóa; state Google link ký gắn User/session. Identity thuộc User khác trả conflict, không chuyển booking/role. Hai tài khoản riêng đã tồn tại không tự merge.

OTP 6 số, TTL 5 phút, HMAC gắn challenge ID, browser binding cookie độc lập CSRF. Tối đa 5 lần sai tổng/email trong 5 phút, resend không reset attempts; resend cách 60 giây, 5 request/email/giờ, 100 request tổng/giờ trong DB và 10/IP/15 phút. Challenge mới thu hồi mã cũ; quota/attempts/consume được commit. Request trả 202 chung, không trả email tra từ SĐT; SĐT chưa có alias không tạo proof. Alias unique chỉ thêm khi tạo User mới hoặc linking, không chuyển alias thuộc identity khác.

SMTP Gmail TLS 465/App Password, timeout hữu hạn; logger/debug tắt, không lộ lỗi SMTP thô. EMAIL Customer không là COMPANY_EMAIL và không cấp Organizer. Lifetime JWT/refresh giữ nguyên. Gửi Gmail thật/Google live cần kiểm tra riêng sau cấu hình; xem [27](27-email-otp-setup.md).

ADR-030 / chủ dự án chốt2026-10-12: Admin có onboarding.manage để cấu hình câu hỏi bổ sung (thêm/bỏ/required/nhãn/thứ tự). Bốn trường role/displayName/gender/DOB luôn bắt buộc. Bộ câu hỏi có phiên bản; giữ câu trả lời cũ, không cấp quyền từ custom answers. Xem Docs/35.


## Quản lý phiên đã triển khai 2026-10-14

GET /auth/sessions phân trang phiên còn hoạt động của chính User; DELETE /auth/sessions/{sessionId} thu hồi đúng phiên sở hữu; POST /auth/logout-all body {} tăng authVersion và thu hồi mọi phiên. Mutation giữ Bearer/Origin/double-submit CSRF và xóa refresh cookie khi phiên hiện tại bị thu hồi. Revalidate dưới khóa User→Session, cùng thứ tự với refresh/logout; không đổi lifetime/rotation/provider/linking. Không token/hash/family/email/identity subject trong DTO. Docs40 thay đoạn cũ nói logout-all/devices chưa triển khai.
