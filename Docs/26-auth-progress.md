# 26. Tiến độ triển khai auth

Tài liệu này ghi trạng thái thực tế để tiếp tục công việc mà không làm lặp. Cập nhật sau mỗi bước auth có ý nghĩa; không ghi secret hoặc dữ liệu đăng nhập thật.

## Nguồn cần đọc trước khi làm tiếp

- Quy tắc: [`PROJECT_RULES.md`](../PROJECT_RULES.md), [`AGENTS.md`](../AGENTS.md), [15](15-development-rules.md).
- Hợp đồng auth và quyền: [03](03-user-roles-permissions.md), [04](04-authentication-authorization.md), [09](09-api-design.md), [12](12-security.md), [18](18-open-questions.md).
- Mã hiện có: `BE/src/modules/auth/README.md`, `BE/src/modules/users/README.md`, `BE/src/modules/index.ts`, `BE/src/config/env.schema.ts`, `Fe/src/features/auth/components/AuthDialog.tsx`.

## Trạng thái hiện tại — 2026-10-10

- Email OTP đã có template HTML thương hiệu Eventix theo yêu cầu trình bày của chủ dự án, kèm bản văn bản thuần; khung email, ô mã nổi bật, hướng dẫn và thời hạn 5 phút. Không đổi provider hoặc chính sách auth. Xem bước kiểm tra template ở cuối log.
- Google OAuth + email/SĐT qua email OTP đã có code/UI và cấu hình SMTP thật. Gmail SMTP verify thành công; đúng một email OTP thử được gửi tới SMTP_USER theo yêu cầu chủ dự án. Không log mã, cookie, token hoặc credential; chưa có xác nhận inbox từ chủ dự án.
- Đã review, backup và áp dụng migration 002 lên DB local của ứng dụng; alias SĐT và cột OTP mới tồn tại. Backup custom dump được kiểm tra pg_restore --list và giữ trong backups/ (Git ignore) để khôi phục; không phải dữ liệu kiểm thử.
- 20 test backend qua trên PostgreSQL database riêng (sau chạy đã drop). Browser Edge headless qua: đăng ký/OTP, login SĐT giữ một User, reload khôi phục phiên, Google callback/linking cùng User với provider mock, account metadata, desktop/mobile, logout cookie/cả hai tab, timer refresh 9 phút và không lưu credential trong localStorage/sessionStorage. Browser test dùng một email thật ở lần đầu; các lượt lặp lại gửi mock, không gửi thêm thư.
- GET auth/methods chỉ đọc phương thức của chính User; UI tự điền email, hiển thị đã liên kết, không cấp quyền từ metadata. JWT refresh trước expiry khi Web Locks có sẵn; OTP verify/logout serialize cùng refresh, epoch bỏ response cũ và BroadcastChannel chỉ phát logout không credential. Mobile hiển thị Tài khoản/Đăng xuất đúng trạng thái. Lifetime/cookie/CSRF/provider/liên kết không đổi.
- Google authorization URL thật mở trang Sign in - Google Accounts, không thấy redirect_uri_mismatch hoặc Access blocked. Chưa đăng nhập tài khoản Google thật/E2E provider live; callback/linking được xác minh bằng mock trong browser và integration tests.
- Runtime hiện hành theo thay đổi của chủ dự án: nvm chung D:/NVM/installs, không khôi phục runtime .local riêng. BE/FE npm run check cuối đều qua (BE 6 HTTP/unit qua, 14 integration bỏ qua khi không bật AUTH_TEST_DB; lần DB riêng đầy đủ 20/20 qua). Công cụ browser/temp scripts/manifest/node_modules/screenshot đã dọn; browser/server test đóng, DB test đã drop. Giữ backup DB để khôi phục.

## Trạng thái mới — 2026-10-09

- Google OAuth/JWT giữ nguyên; đã có request/verify email OTP, SMTP Gmail TLS/App Password, linking Google ↔ EMAIL cùng User và alias SĐT chưa xác minh. EMAIL không cấp company session/Organizer. Nút tên tài khoản mở linking; UI OTP có resend/đổi thông tin, đã bỏ thông báo triển khai dưới Google.
- Chủ dự án đã chọn chính sách liên kết tường minh và SMTP Gmail, ghi Q-006/ADR-021; rule, Docs, OpenAPI, schema, migration 002 và ERD được đồng bộ. Không tự merge email hoặc chuyển identity/alias khác User.
- 17 test gồm PostgreSQL 18 tạm đã qua (OTP đúng/sai/hết hạn/replay/binding/quota, linking hai chiều/phiên cũ/identity và phone conflict/rollback); Google/SMTP trong test được mock. Schema mới 45 bảng chạy được; migration từ schema HEAD 44 bảng lên 45 giữ nguyên User/Google identity thử nghiệm.
- Nodemailer và types đã cài/pin; npm lock được kiểm tra. Mạng sandbox từng chặn cài và review quyền hết thời gian; sau yêu cầu setup runtime mới, cài dependency thành công. Không còn chờ cài thư viện SMTP.
- Chủ dự án gỡ Node installer để chuyển nvm; .nvmrc và helper BE/FE ưu tiên nvm-windows, chọn runtime vào PATH của phiên, không đổi symlink toàn máy hoặc tải portable mới. Chủ dự án cung cấp executable trong LOCALAPPDATA/Author Software/nvm: nvm-windows 2.0.1. Helper hỗ trợ config get root --json của 2.x và nvm root của 1.x, tự tìm executable mới. D:/NVM không cho ghi runtime; chuyển root nvm sang .local/nvm/installs của repository và cài Node 24.21.0 qua nvm thành công. Cả BE/FE chọn đúng Node 24.21.0/npm 11.19.0 từ nvm, không còn dùng fallback trong lần kiểm tra mới.
- BE npm run check cuối bằng runtime nvm qua với 4 HTTP/unit test, 13 integration test bỏ qua đúng khi AUTH_TEST_DB không bật; test fixtures không đọc .env thật. FE npm run check toàn bộ bằng helper và runtime nvm mới đã qua. HTTP khởi động tạm: BE readiness 200, FE 200, Vite proxy auth/config 200; googleEnabled=true, emailOtpEnabled=false (SMTP chưa cấu hình ở máy người dùng).
- Chưa áp dụng migration lên DB người dùng, chưa gửi Gmail thật hoặc xác nhận Google live/linking E2E; cần chủ dự án điền SMTP/App Password riêng và review/backup migration. Không đọc/in giá trị bí mật. PostgreSQL tạm và build FE tạm đã dọn; server BE/FE dùng cho smoke check đã dừng, thư mục log/PID kiểm thử đã dọn; giữ dữ liệu/runtime có sẵn.

## Trạng thái đã xác nhận — 2026-10-03

| Hạng mục | Trạng thái |
| --- | --- |
| Backend auth routes/service/repository | Đã có Google start/callback, CSRF, refresh, logout, me, config; service/repository tách riêng |
| Frontend auth | Dialog gọi Google qua API khi BE đã cấu hình; khôi phục phiên bằng refresh có Web Locks để tránh race giữa tab, JWT chỉ giữ trong memory; nút OTP vẫn vô hiệu hóa. Trình duyệt thiếu Web Locks chỉ refresh sau callback, không tự khôi phục trên reload |
| Cấu trúc DB | Đã có `users`, `external_identities`, `otp_challenges`, `auth_sessions`, `refresh_tokens`, role và permission trong `database/schema.sql` |
| Cấu hình | Parser đã nhận Google client/redirect/origin và JWT; chưa có Google OAuth client thật trong repo, chưa có SMS/email provider |
| Hợp đồng hiện tại | Google Authorization Code + PKCE; access JWT 10 phút, refresh opaque cookie hạn tuyệt đối 7 ngày mỗi thiết bị, rotation và thu hồi khi reuse; OTP là đợt sau |
| Kiểm thử auth thực tế | Hai test HTTP và hai test PostgreSQL 18 tạm cho tạo Customer/refresh reuse đã qua; Google provider trong test được mock, chưa chạy callback với OAuth client thật hoặc E2E trình duyệt |

## Quyết định đã được chủ dự án xác nhận — 2026-10-03

1. Dùng Google Authorization Code + PKCE, backend đổi code và kiểm tra Google ID token, thay luồng GIS credential trong hợp đồng cũ.
2. Đợt đầu làm Google + JWT; OTP điện thoại/email công ty triển khai sau. Nhà cung cấp SMS/email thật vẫn là Q-006 còn mở.

Không đổi các câu trả lời đã chốt ở Q-006. Khi có quyết định mới, ghi người/ngày/đáp án tại [18](18-open-questions.md), cập nhật [04](04-authentication-authorization.md), [09](09-api-design.md) và thiết kế liên quan trước khi phụ thuộc vào quyết định đó.

## Nhật ký công việc

### 2026-10-09 — Yêu cầu thống nhất Google OAuth và email OTP

- Chủ dự án chọn hai phương thức Customer: Google OAuth; hoặc nhập SĐT/email và xác minh bằng OTP gửi email, thay yêu cầu SMS OTP trước đây. SĐT trong phương thức mới là alias tìm tài khoản, không có bằng chứng sở hữu SĐT từ OTP email.
- Rà soát code/SQL: Google hiện dùng `(provider, subject)` làm identity, email không có ràng buộc duy nhất xuyên provider. Provider/channel hiện chỉ hỗ trợ GOOGLE/PHONE/COMPANY_EMAIL; cần model riêng cho email Customer và alias SĐT, không dùng COMPANY_EMAIL để ngầm cấp phiên công ty.
- Chủ dự án hỏi trường hợp email đã đăng nhập Google. Đã đề xuất dùng chung User qua liên kết tường minh: xác thực phương thức hiện có và OTP email trước khi bật phương thức mới; không tạo User thứ hai hoặc tự gộp theo email. Đang chờ chọn chính sách liên kết và kênh gửi email (SMTP Gmail, SMTP dịch vụ sẵn có hoặc thử nghiệm local).
- Chưa đổi hợp đồng auth, provider, schema hoặc code phụ thuộc khi chính sách liên kết/kênh gửi chưa chốt. Docs/rules/SQL/API/UI sẽ đồng bộ sau quyết định theo Docs 15; không ghi OTP hay credential vào tài liệu.

### 2026-10-09 — Rà soát Google và sửa giao diện nhập SĐT

- Kiểm tra HTTP trên BE đang chạy: `/auth/config` báo Google đã bật, `/health/ready` trả 200; `/auth/csrf` và `/auth/google/start` với Origin `http://127.0.0.1:5173` trả 200, URL Google có PKCE S256 và callback qua FE. Origin `http://localhost:5173` bị từ chối 403 đúng cấu hình. Ảnh chủ dự án gửi sau đó xác nhận Google trả `400 redirect_uri_mismatch`; đã hướng dẫn đăng ký chính xác callback trong đúng OAuth web client. Chưa xác nhận đăng nhập Google thật thành công.
- Theo yêu cầu chủ dự án, sửa ô SĐT: bỏ outline focus riêng của input ghi đè bởi style chung, giữ focus trên khung ngoài; input có `min-width: 0` và flex để không tràn. Bỏ khối thông báo trạng thái triển khai bên dưới Google; chỉ hiện thông báo lỗi khi có lỗi với `role="alert"`.
- Kiểm tra FE: ESLint, TypeScript, Prettier toàn FE và Vite build qua. Build kiểm thử nằm trong thư mục riêng và đã dọn; không khởi chạy server mới. Chưa kiểm tra trực quan trong trình duyệt.
- Yêu cầu mới mở đợt đăng nhập/đăng ký SĐT. Q-006 chưa chốt SMS provider; đã hỏi chủ dự án chọn dịch vụ SMS thật hay OTP thử nghiệm chỉ local. Chưa triển khai endpoint OTP hoặc bật nút gửi mã khi chưa có quyết định này; chưa thay cơ chế session/token/linking.

| Ngày | Đã làm | Kiểm tra / kết quả | Tiếp theo |
| --- | --- | --- | --- |
| 2026-10-03 | Đọc quy tắc dự án, Docs auth/security/API/Q-006 và khảo sát mã BE/FE; tạo `AGENTS.md` cùng log này để lưu cách làm và trạng thái. Chủ dự án chọn Google Authorization Code + PKCE, Google + JWT trước. | Xác nhận chưa có endpoint auth, dialog FE còn disabled; chưa sửa code auth. | Đồng bộ tài liệu và triển khai luồng Google + JWT; OTP để đợt sau. |
| 2026-10-03 | Đồng bộ Q-006/Docs 04/09/ADR-020; thêm Google PKCE, xác minh Google ID token, Customer tự tạo, JWT, refresh rotation/reuse, CSRF/Origin, audit login, logout, me; nối FE với Web Locks; tách repository theo `PROJECT_RULES.md`. | BE/FE `npm run check` qua; hai HTTP test và hai test PostgreSQL 18 thật cho tạo Customer/refresh reuse đều qua. Google provider được mock, live chưa kiểm chứng vì cấu hình OAuth client chưa được điền. PostgreSQL tạm đã dừng và xóa. | Chủ dự án đã có OAuth web client và sẽ tự điền ID/secret vào `BE/.env`; sau đó cần thử trình duyệt. OTP, linking, logout-all và quyền Organizer/Admin ở đợt sau. |
| 2026-10-03 | Kiểm tra sau khi chủ dự án điền Google OAuth vào `BE/.env`, không đọc hoặc ghi lại giá trị bí mật. | `/auth/config` báo Google đã bật; `/auth/csrf` và `/auth/google/start` trả 200, URL Google có PKCE S256/state/nonce. `npm run db:check` thất bại; PostgreSQL trả mã `28P01` (sai mật khẩu DB), nên callback chưa thể tạo User/Session thật. | Chủ dự án tự sửa `DB_PASSWORD` trong `BE/.env`; kiểm tra lại `npm run db:check`, sau đó chạy FE/BE và thử đăng nhập Google trên trình duyệt. |
| 2026-10-04 | Kiểm tra ảnh FE lỗi tải catalog, xác nhận Vite proxy và BE đang chạy; sửa thông báo MySQL thành PostgreSQL và áp dụng theme cho màn hình lỗi/loading để nút Thử lại hiện đúng. | `/health/live` 200, `/health/ready` 503, `/catalog/home` qua Vite 500. `db:check` vẫn thất bại và kết nối `pg` trả `28P01`; biến DB không bị process env ghi đè. FE lint/typecheck/build và format file đã sửa qua. Chưa thể thử Google callback thật. Lệnh dọn `Fe/dist` sau build bị automatic review từ chối nên artifact vẫn còn. | Sửa mật khẩu/role PostgreSQL tương ứng với `DB_USER` trong `BE/.env`, chạy lại `db:check`; khi kết nối được mới thử login Google và kiểm tra role Customer/seed. |
| 2026-10-04 | Chủ dự án chạy lại `db:check` vẫn thấy thông báo chung; cập nhật script kiểm tra để trả lý do an toàn theo SQLSTATE mà không in credential. | Chạy lại xác nhận `28P01`: PostgreSQL reachable nhưng từ chối DB_USER/DB_PASSWORD. BE typecheck và Prettier check file sửa qua. Chưa có thay đổi DB/schema; chưa thể thử Google callback thật. | Chủ dự án đối chiếu host/port/user/password của kết nối DBeaver với `BE/.env`, tự cập nhật mật khẩu; chạy lại `npm.cmd run db:check`. |

## 2026-10-10 — Hoàn thiện sau khi chủ dự án điền khóa

- Xác nhận cấu hình SMTP/OTP/Google đầy đủ mà không in credential; Gmail SMTP verify thành công, bước verify chưa gửi thư.
- Database local thiếu migration 002. Đã review migration, tạo và kiểm tra backup custom dump trong backups/ (Git ignore), rồi áp dụng nguyên tử; alias_table và otp_columns đều có. Backup giữ phục vụ khôi phục, không phải tài nguyên kiểm thử cần xóa.
- Thêm GET auth/methods chỉ cho chính User, metadata phương thức cho Account; sửa lỗi Google/cancel với allowlist mã lỗi, refresh JWT trong memory trước hết hạn, epoch chống hồi phiên sau logout và sync logout giữa tab không chứa credential. Không đổi auth provider/lifetime/cookie/CSRF/linking policy.
- Chủ dự án cho phép gửi OTP thử tới Gmail SMTP_USER; đã gửi đúng một lần và kiểm thử UI trên DB riêng qua. Google provider callback dùng mock; không ghi nhận inbox/Google live khi chưa có bằng chứng.

## 2026-10-10 — Template email OTP

- Theo ảnh tham khảo GitLab của chủ dự án, thêm `otp-email.template.ts` và nối vào SMTP sender: khung trắng, thương hiệu/màu xanh Eventix, ô mã lớn, hướng dẫn nhập mã, thời hạn 5 phút và nhắc không chia sẻ mã. Bảng/CSS inline, không dùng ảnh/font bên ngoài; escape mã trong HTML và giữ bản text cho email client. Khối Copy code trong ảnh thuộc giao diện Gmail, không thêm nút JavaScript vào email.
- BE `npm run check` qua: secret guard, ESLint, TypeScript, 6 HTTP/unit test, build và Prettier; 14 test tích hợp bỏ qua khi không bật DB kiểm thử. Render bằng mã mẫu và kiểm tra HTML escaping qua; Nodemailer stream transport xác nhận MIME gồm HTML/text, không gửi thư qua mạng.
- Edge headless không tạo được ảnh xem trước trong môi trường hiện tại; chưa xác minh cách render template mới trong Gmail thật. Không gửi thêm OTP/email thử. Không thay đổi schema, provider, lifetime, linking, cookie hoặc CSRF.
- Đã đóng process preview thuộc profile tạm và dọn file/profile kiểm thử; xác nhận thư mục preview không còn. Kiểm tra diff không có lỗi whitespace; giữ nguyên các thay đổi sẵn có của repository.
