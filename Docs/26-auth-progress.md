# 26. Tiến độ triển khai auth

Tài liệu này ghi trạng thái thực tế để tiếp tục công việc mà không làm lặp. Cập nhật sau mỗi bước auth có ý nghĩa; không ghi secret hoặc dữ liệu đăng nhập thật.

## 2026-10-11 — Làm sạch BE và bổ sung validation theo chủ dự án

- Theo yêu cầu trực tiếp tập trung BE trước FE và rà toàn bộ folder: tách routes/controller/schema/service/repository, chia auth thành Google/OTP/session/account, chia booking theo use case và catalog theo tài nguyên; OpenAPI về từng module. Gom actor, ID/ngày/phân trang/contact, response/no-store/Origin, worker lifecycle và cache parser dùng chung. `startup/` thay Bootstrap; giữ các module đặc tả chưa triển khai.
- Chủ dự án phản hồi danh sách file ngang hàng quá dài: gom 91 file vào thư mục con theo chức năng/tầng, cập nhật 303 tham chiếu source/test và tách schema hold/order/idempotency về đúng nhóm. Gốc auth/booking/catalog giữ entry point cần dùng, không thêm wrapper ở đường dẫn cũ; cây folder tại Docs/31.
- Auth chỉ tổ chức lại code; giữ Google Authorization Code + PKCE, EMAIL/linking, JWT 10 phút, refresh 7 ngày tuyệt đối/rotation/reuse, cookie/Origin/CSRF/provider. HTTP mutation có body phải dùng application/json theo contract; trả 415 UNSUPPORTED_MEDIA_TYPE khi sai Content-Type. Không sửa `.env`, FE hoặc DB ứng dụng.
- Siết validation ID BIGINT (không để BigInt lỗi trước Zod), query đơn/allowlist/boolean/page có trần, version INTEGER, object rỗng của waiting-room và cache JSON/schema. Contract cập nhật Docs/09/31 và OpenAPI. Không thêm công nghệ/instance/broker hoặc tự mở lại luồng distributed system.
- 70 test HTTP/schema/architecture/OpenAPI/config/worker đã qua sau khi gom thư mục con với fixture không đọc `.env`/gọi provider. Thêm bộ test validation mới, không khôi phục/ghi đè auth tests/setup-env bị xóa trước đó; Vitest dùng tests/fixtures/environment.ts. BE lint, TypeScript, build, format và secret guard đều qua. Build vào thư mục tạm rồi dọn, giữ dist có sẵn; git diff --check được kiểm tra trước kết thúc.
- 25 kiểm tra PostgreSQL 18 riêng đã qua: tạo phiên/JWT, refresh rotation/reuse và giữ expiry tuyệt đối, tranh chấp một ghế, replay không gọi admission, ownership hold/booking, tạo/đọc/hủy/hết hạn đơn, giải phóng ghế, hồ sơ/follow/catalog. DB/cluster/process/script thử đã dọn. Sandbox Windows không khởi động được PostgreSQL fixture; khởi động/dừng đúng cluster tạm bằng quyền được auto-review chấp thuận. Không dùng DB/credential thật.
- Chưa kiểm thử lại Google/Gmail/R2/Redis live, linking/provider E2E hoặc payment/issuance/admission đầy đủ. Không coi việc làm sạch code là hoàn thành những chức năng chưa có. Chi tiết cấu trúc/tình trạng tại [31](31-backend-code-structure.md).

## 2026-10-11 — Dừng triển khai thêm và bỏ load balancer theo chủ dự án

- Bổ sung quyết định chủ dự án ADR-025/Q-025: giai đoạn phát triển dùng monolith/một API instance; mọi thay đổi hoặc thử nghiệm distributed system phải hỏi trước khi làm. Ghi vào AGENTS.md, PROJECT_RULES.md, README và Docs/10/17/18 để người/agent làm việc sau đọc lại. Bước này chỉ sửa tài liệu, không tiếp tục triển khai booking, chạy hạ tầng hoặc sửa DB/auth.

- Chủ dự án thu nhỏ bài toán từ một triệu xuống khoảng 10.000 người, sau đó yêu cầu ưu tiên phát triển sản phẩm, bỏ load balancer và dừng để bàn phạm vi. Đã gỡ Nginx/config, Dockerfile/.dockerignore API, dịch vụ api1/api2/worker/load-balancer trong Compose, dev:scaled và trusted-proxy config. Khôi phục trust proxy=false; giữ một API qua npm run dev, FE proxy vẫn trỏ 3000 như trước. Compose chỉ giữ Redis local có credential ngoài Git; không thay auth lifetime/cookie/provider hoặc DB schema.
- Phần đã viết trước khi dừng vẫn giữ: API suất/ghế, giữ 1–6 ghế 5 phút, tạo booking không gia hạn, đọc/hủy/release/expiry, idempotency 24 giờ trên bảng hiện có; Redis rate limit/FIFO/phòng chờ, cache snapshot công khai 1 giây và worker expiry. Chưa hoàn thiện tài liệu nghiệp vụ/ADR của đợt booking này; tiếp tục sau khi bàn với chủ dự án. Không ghi hoàn thành FE/checkout/payment/phát vé/admission.
- Trước yêu cầu dừng, 77 kiểm tra trên DB/Redis tạm qua: HTTP/scope/status/idempotency/quota/expiry, 10.000 phần tử queue, giới hạn 100 lượt, Redis outage/recovery và OpenAPI. Benchmark thử Nginx + hai API: đọc 100 request/1.000 ghế p95 294 ms sau cache, cùng ghế 1 thành công/99 conflict p95 493 ms, khác ghế 100 thành công p95 491 ms; đây là lịch sử kiểm thử cấu hình hiện đã gỡ, không phải bằng chứng 10.000 browser đồng thời hoặc benchmark một API. Tất cả DB/container/namespace thử đã dọn trong finally; script/config thử đã xóa.
- Đã gỡ image API build và Nginx phục vụ thử khi không còn container sử dụng. Redis eventix-redis-1 giữ phục vụ ứng dụng, không dừng Docker Desktop/container có sẵn của người dùng. Không áp dụng migration mới vào DB local trong đợt booking này.
- Sau khi gỡ: TypeScript, ESLint, format các file đã sửa, secret guard, Compose config --quiet và git diff --check qua. Không còn deploy/tmp/Dockerfile/.dockerignore hoặc cấu hình Nginx/multi-instance/trusted-proxy trong code. Dừng công việc booking tại đây để bàn tiếp theo yêu cầu, không khởi chạy thêm API/worker.

## 2026-10-11 — Rà soát và gộp dữ liệu attendee (ADR-024)

- Theo yêu cầu chủ dự án, đối chiếu 47 bảng DB local với schema/migration/code/tài liệu; booking_items đã có tên người tham dự. Gộp ticket_attendees vào booking_items, bỏ bản tên thứ hai và events.age_tag; query vẫn trả ageTag. Giữ các bảng có mục đích riêng, không xóa lịch sử giao dịch hoặc thay quyền/phiên. Rà soát theo nhóm và lý do giữ tại [30](30-schema-consolidation.md).
- Migration 006 mới (không sửa 004/005): chặn xung đột tên, chuyển thông tin/CCCD mã hóa trước DROP, thay guard confirmation/USED, CHECK bộ dữ liệu và khóa item khi staff verify/purge. Đồng bộ schema mới 46 bảng, ERD trong Docs/29, repository và ADR. Bổ sung quy tắc đối chiếu thực thể trước thêm bảng/cột.
- 45 kiểm tra PostgreSQL thực qua trên schema mới và upgrade có dữ liệu giả: rollback xung đột, giữ ciphertext/MAC/SĐT, nhãn tuổi, thiếu dữ liệu/tuổi, masking, staff scope/verification và purge. Hai DB tạm đã drop. Lỗi fixture cửa sổ admission ban đầu đã sửa, chạy lại qua; không thay constraint nghiệp vụ.
- Đã backup custom và kiểm tra pg_restore --list, rồi áp dụng 006 vào DB local: trước sửa không có booking_items/ticket_attendees/tickets; sau sửa 46 bảng, bảng/cột dư đã mất, catalog đọc được 13 event. Backup giữ trong backups/before-006-1791657722164.dump (Git ignore) để khôi phục. Không cần chạy lại 006 trên DB local này. FE/checkout/company login/admission đầy đủ vẫn chưa triển khai.
- Kiểm tra cuối: secret guard, ESLint, TypeScript, build noEmit, Prettier các file code/module README đã sửa và git diff --check qua. Script và thư mục kiểm thử đã dọn, hai DB tạm đã drop, không khởi chạy API/worker nền; giữ backup để khôi phục. Không ghi npm check toàn BE đã qua vì bộ test auth bị xóa từ trước.

## 2026-10-11 — Hồ sơ, follow/inbox, tuổi và thông tin mỗi vé

- Chủ dự án chốt ADR-023/Q-024: gender/DOB private, Customer theo dõi Organization và notification trong web; minimumAge theo ngày suất/timezone venue, từng người tham dự; mỗi vé họ tên/DOB/SĐT/CCCD riêng, staff đối chiếu thật, CCCD xóa sau ends_at +30 ngày. Không lấy thông tin tự khai làm proof hoặc cấp role.
- Đã có API profile mở rộng, follow/list/mute/unfollow, inbox/read/unreadCount, cấu hình age DRAFT/version/company scope, age-eligibility, owner booking attendee và staff ticket attendee-verification. Worker DB fan-out 500/dedupe và purge 1000; key AES-GCM/HMAC độc lập trong .env ngoài Git, không đổi JWT/refresh/CSRF/provider/linking.
- 64 kiểm tra HTTP/PostgreSQL trên hai DB riêng qua: fresh schema/upgrade, profile dates, scope/version, follow/preferences/notifications/dedupe/batching, tuổi từng người, ba bộ attendee/rollback, giấy tờ mã hóa/che số, staff/mismatch, guards confirmation/USED và retention. Không dùng giấy tờ thật, không gọi SMTP/Google/R2. DB thử đã drop.
- Đã review/backup và áp dụng 004/005 nguyên tử trên DB local (47 bảng), backup custom được kiểm tra pg_restore --list và giữ để khôi phục. Không có vé VALID/USED cũ cần chuyển đổi. Khóa attendee mới được sinh, không in/commit giá trị. FE và company login/checkout/payment/ticket issuance/admission đầy đủ chưa triển khai; không ghi E2E mua vé đã qua. Contract, cách chạy worker và ERD phần mới tại [29](29-profile-follow-age-attendees.md).
- Kiểm tra cuối BE: ESLint, TypeScript, cấu hình build noEmit, Prettier source/config/module README và secret guard qua; git diff --check qua. Script/helper thử đã dọn, hai DB riêng đã drop, không khởi chạy server/worker nền. Cần khởi động lại BE và chạy worker:notifications ở terminal riêng để dispatch/purge thực tế. Giữ backup local phục vụ khôi phục; không ghi npm check toàn BE qua vì auth tests đã bị xóa từ trước.

## 2026-10-10 — Dùng phiên hiện có cho upload R2

### Backend hồ sơ cá nhân — 2026-10-10

- Chủ dự án yêu cầu ưu tiên BE và cho chọn bước tiếp theo. Đã triển khai GET/PATCH users/me theo hợp đồng đã có: trả id/displayName/avatarUrl, chỉ sửa displayName trim 1–120 ký tự với profile.update_self; Origin + Bearer JWT, recheck User/session/authVersion và quyền DB dưới khóa. Audit cập nhật cùng transaction; không audit trùng khi cùng tên. Avatar tiếp tục qua R2, không nhận URL tùy ý hoặc trường role/email/phone/status/owner.
- 26 kiểm tra HTTP/PostgreSQL riêng qua: scope/DTO/no-store, input/mass assignment, Unicode/trim, User khác không đổi, phiên sai/chéo User, permission/session/authVersion bị thu hồi, audit đúng và rollback khi audit thất bại. Không sửa PostgreSQL local hoặc chạy Google/SMTP/R2 live trong bước này. DB thử và script được dọn.
- Đã cập nhật Swagger/module README/API docs. Không đổi cơ chế auth, lifetime/cookie/CSRF/provider/linking; không sửa FE. UI sửa tên và backend company/Organizer vẫn chưa triển khai ở bước này.
- Kiểm tra cuối BE: ESLint, TypeScript, cấu hình build với noEmit, Prettier source/config/module README và secret guard đều qua; git diff --check qua. Không chạy lại bộ test auth đã bị xóa sẵn trong working tree, không ghi npm check toàn BE đã qua.

- Theo lựa chọn chủ dự án, thêm upload avatar và event/merchandise bằng presigned URL 5 phút, JPEG/PNG/WebP tối đa 5 MB (ADR-022). Export helper xác thực JWT/DB hiện có để media dùng chung, bổ sung authVersion vào actor nội bộ để recheck dưới khóa; không đổi response auth, lifetime, identity linking, cookie hoặc CSRF.
- Avatar chỉ User hiện tại với permission; Organizer kiểm tra permission/company identity/membership/Organization/ownership/DRAFT/version, revalidate trước commit. Không suy ra role từ frontend/email/domain. Schema cũ đã được backup/review/migrate 003 để chỉ lưu URL ảnh.
- 29 kiểm tra HTTP/PostgreSQL/R2 live qua trên DB riêng; chéo User/tổ chức, phiên cần JWT, receipt sai/hết hạn, revoked membership, published event, conditional PUT, lưu URL/audit của avatar/event/product và version conflict đã kiểm tra. DB và object thử được dọn. Company session là fixture; company login/editor UI vẫn chưa có.
- CORS bucket đã được chủ dự án sửa và kiểm tra lại thành công: OPTIONS 204, Edge upload File trực tiếp 200, BE xác minh HEAD/signature ảnh và browser hiển thị ảnh public. Credential object vẫn không có quyền sửa CORS; cấu hình do chủ dự án lưu trên dashboard. Chi tiết ở [28](28-r2-image-upload.md).
- Kiểm tra cuối: BE ESLint, TypeScript, build với noEmit, format source và secret guard qua; FE ESLint, TypeScript, format và Vite build qua. Schema/catalog local đọc được sau migration (13 event, 2 hồ sơ thay đổi). Script/build thử đã dọn; giữ backup DB phục vụ khôi phục. Bộ test auth cũ đã bị xóa trong working tree trước đợt này, không khôi phục hoặc ghi npm check toàn BE đã qua.

### 2026-10-10 — Kiểm tra lại CORS sau xác nhận chủ dự án

- Đã thử preflight thật và Edge headless với profile riêng tại origin ứng dụng. OPTIONS trả 403 Unauthorized, không có Access-Control-Allow-Origin; browser fetch File PUT bị chặn. PUT trực tiếp ngoài browser vẫn 200, nên object credential còn dùng được. Path-style/virtual-host và hai origin local đều chưa có CORS response phù hợp.
- Chưa thay code auth/upload hoặc policy bucket; cần chủ dự án gửi JSON CORS đang lưu và xác nhận đúng bucket để đối chiếu. Không ghi browser E2E đã qua. Các object thử đã xóa; script/profile/browser thử được dọn sau kiểm tra, không sửa dữ liệu PostgreSQL.
- Đã thử lại theo yêu cầu “thử lại đi”: preflight vẫn 403, corsReady=false; Edge tại origin ứng dụng vẫn bị chặn upload File. Object thử đã xóa và tài nguyên browser/profile/script được dọn; chưa có bằng chứng CORS đã hoạt động.
- Chủ dự án gửi cấu hình cũ chỉ GET từ localhost:3000, rồi sửa theo cấu hình FE/PUT/header đã hướng dẫn. Lượt kiểm tra cuối qua: OPTIONS 204/corsReady=true; Edge headless tại origin ứng dụng upload File bằng presigned PUT trả 200, BE xác minh R2 và ảnh public decode/render được (1×1). Không chạy login Google/OTP, popup avatar hoặc complete API trong lượt này; 29 kiểm tra API/DB trước đó tiếp tục là bằng chứng cho phần complete. Object/browser/profile/script thử đã dọn, không sửa dữ liệu PostgreSQL.

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

### 2026-10-11 — payOS, attendee → phát vé → vào cửa → FE (ADR-027)

- Chủ dự án xác nhận một kênh/VND/tiền muộn đối soát. Tách PaymentService qua gateway/booking port/ticket issuer OOP; idempotency dùng chung, network ngoài PG transaction, recovery trong worker bookings hiện có. Không thay JWT/cookie/CSRF/provider/linking/role hoặc thêm distributed system.
- Booking attendee đầy đủ và đủ tuổi trước payment; khóa sửa khi đang trả tiền. Signed webhook inbox/reference dedupe, confirmation/ghế/ticket issuance nguyên tử, partial/over/late reconciliation. QR mã hóa độc lập; owner read, online/counter check-in vẫn VALID, admission physical CCCD/tuổi/cửa sổ/company quyền đúng org rồi USED một lần.
- FE chọn ghế/phòng chờ, ba bộ attendee, redirect/return, vé/QR và trang nhân viên đã nối. Edge headless với DB/phiên/gateway giả và queue stub qua cả luồng 3 vé → callback → QR → quầy → đối chiếu CCCD; không storage PII/token/QR. Không thử onboarding company hoặc cấp quyền ngầm.
- Unit/HTTP/architecture hiện 75 checks qua; PostgreSQL tích hợp + Edge 16/16 qua, fresh/upgrade 007 khớp. TypeScript/lint qua cả BE/FE; FE build qua. Kiểm tra tổng cuối và dọn build còn thực hiện tiếp.
- Metadata local: 46 bảng, payments rỗng. Backup before-007-1791713695285.dump đã kiểm tra pg_restore --list; áp dụng 007 chỉ ba cột/index payments. Không tạo/xóa bảng; không sửa migration đã áp dụng.
- Kênh payOS thật tạo link thử 2.000 VND và hủy amountPaid=0; webhook qua tunnel chủ dự án cung cấp được payOS confirm thành công. Link thử đầu có expiry 5 phút nhưng harness gọi sai tham số cancel, chưa kiểm chứng hủy link đó; lần kế tiếp dùng đúng SDK đã hủy. Không chuyển tiền/ghi dữ liệu thật/OTP email. Chưa thử giao dịch chuyển tiền thật, company login/onboarding và giao diện đối soát/refund/payout. Tài liệu [32](32-payos-booking-ticket-flow.md).

- Kiểm tra cuối: BE secret guard/lint/typecheck/build/format qua; unit/HTTP/architecture/config 77/77 qua. PostgreSQL độc lập + Edge headless 16/16 qua sau khi sửa shape danh sách bookings ở FE và lazy routes. FE toàn bộ check qua; main chunk 496 KB, QR tải riêng. npm audit trước đó có 8 cảnh báo ở dependency build sẵn có (Tailwind/source-map); không đến từ thư viện QR mới, không tự nâng major ngoài phạm vi. Cập nhật Swagger, README, ADR-027/Q-026 và Docs/32.
- Dọn BE/Fe dist do kiểm tra tạo; runner đã dừng PostgreSQL và đóng Edge riêng, xóa database/profile tạm. BE/tmp không còn tài nguyên test. Giữ backup trước migration và các tiến trình/dữ liệu của chủ dự án.

### 2026-10-11 — Sửa lỗi đăng nhập/đăng ký khi Redis local ngừng chạy

- Tái hiện trên BE/FE đang chạy: health/config 200 và Google/OTP bật, nhưng POST google/start và otp/request đều 503 ADMISSION_UNAVAILABLE trước controller. Redis PING ECONNREFUSED; Docker Desktop engine chưa chạy. Nguyên nhân trực tiếp là auth rate limiter dùng Redis hiện có (không fallback), không phải thiếu khóa Google/SMTP hoặc migration payment.
- Khởi động Docker Desktop đã cài; container eventix-redis-1 tự chạy lại và healthy, PING PONG. Giữ dịch vụ Redis đang chạy để chủ dự án tiếp tục dùng app; không dựng hạ tầng/container mới, không đổi rate limit/Origin/CSRF/cookie/JWT/provider/linking/quyền.
- FE thêm thông báo rõ khi dịch vụ đăng nhập chưa sẵn sàng và RATE_LIMITED; không đưa tên Redis/hạ tầng vào UI. ESLint/TypeScript/Prettier của FE qua.
- Kiểm chứng sau khôi phục: Google start với Origin 127.0.0.1:5173 trả 200, HTTPS và PKCE S256; OTP request đầu vào sai trả 400 VALIDATION_ERROR đúng, không còn 503. Origin localhost:5173 trả 403 INVALID_ORIGIN đúng quyết định hiện có, dùng website 127.0.0.1:5173. Không gửi OTP/email, không thực hiện Google callback/login thật hoặc ghi dữ liệu user thử. Không tạo tài nguyên test cần dọn.

### 2026-10-11 — Làm rõ dữ liệu catalog và giới hạn test payment local

- Theo phản hồi chủ dự án, kiểm tra read-only DB/API: FE gọi /api/v1/catalog/home qua proxy, BE dùng postgresCatalogRepository; HTTP 200 trả 13 event public IDs khớp event_publications. Đây là dữ liệu demo đã seed vào DB, không phải dữ liệu hardcode event trong FE.
- DB local có 13 events/13 sessions nhưng seats=0, ticket_types=0, session_seats=0. Dữ liệu catalog không đủ làm inventory bán vé; một số suất không mở bán. Vì vậy chủ dự án chưa thể chọn ghế/giữ chỗ/tạo đơn/thanh toán thực tế qua FE với DB hiện tại.
- 77 tests + 16 integration/browser trước đó xác minh code trên PostgreSQL tạm, tự thêm fixture ghế/giá/attendee và dùng payment gateway giả/queue stub. Không phải đã thử giao dịch chuyển tiền thật trên DB local. payOS thật mới tạo/hủy link và confirm webhook.
- Để thử FE/payOS thật cần dữ liệu test bán vé được tạo có chủ đích: event đã duyệt/public, session mở bán, layout/ghế, ticket type/giá và attendee; sau đó chủ dự án tự chuyển tiền và kiểm tra signed webhook/đơn/QR. Check-in thật còn cần company session/membership/quyền hợp lệ, không tự cấp role để test. Chưa tự thêm seed hoặc sửa dữ liệu DB trong bước kiểm tra này.

### 2026-10-11 — Personalized onboarding và Organizer cá nhân (đang kiểm tra cuối)

- Chủ dự án đổi yêu cầu và đã chốt Q-027/ADR-029: role lúc onboarding, hồ sơ bắt buộc, email cá nhân; Organizer riêng Customer, bật Customer sau, Admin vẫn duyệt trước mở bán. Giữ provider/proof/linking/lifetime/cookie/CSRF. Không cấp Admin thật.
- Tài khoản mới xác minh chưa tự nhận Customer; API onboarding/options/preferences/activate Customer/recommendations đã mount. R2/age/attendee/check-in bỏ gate domain công ty, vẫn scope role/organization/membership/session/identity hợp lệ.
- Organization application/review và event draft/layout/session/type/pricing/submit/withdraw/reopen/Admin review có code. Review snapshot/freeze, TTL15 ngày, gửi trước một tháng lịch; approve tạo inventory/publication atomically, outbox follow hiện có. Worker booking cùng codebase thêm expiry review; không thêm broker/hạ tầng phân tán.
- Migration 008 dùng Users có sẵn, đổi tên metadata tổ chức/membership và thêm PENDING; 009 cấu hình giá nháp trong event_sessions, inventory chỉ sau duyệt. Không thêm bảng, không sửa migration đã áp dụng. Fresh và upgrade có dữ liệu demo đã qua trên PG tạm. Chưa áp dụng 008/009 lên DB local tại thời điểm log này.
- BE typecheck và 80 unit/HTTP/architecture/config qua. PG tích hợp 21 ca qua, gồm tạo nháp bằng Organizer cá nhân → tổ chức/event Admin fixture duyệt → hold3 ghế → attendee3 riêng → fake payment/callback trùng →3 vé→counter/check CCCD/admission USED replay. Không chuyển tiền thật hoặc upload R2 thật trong bài test mới.
- FE có onboarding bắt buộc/skip preferences, sửa hồ sơ/sở thích/follows, bật Customer và gợi ý trang chủ; lint/typecheck lượt đầu qua. Browser mới và kiểm tra cuối đang thực hiện, chưa ghi hoàn tất.

### 2026-10-11 — Kiểm chứng cuối onboarding/Organizer cá nhân

- BE secret guard/lint/typecheck/build/format qua; 83 unit/HTTP/architecture/config qua. PostgreSQL độc lập + Edge headless 23/23 qua, gồm onboarding Customer không có role ban đầu, bỏ qua sở thích rồi purchase3 vé/check-in/admission; luồng Organizer cá nhân tạo nháp trước org approval, Admin fixture duyệt, fake callback lặp và phát vé đã qua. Expiry commit trước trả conflict, reason notice gửi một lần, reopen tăng version được kiểm chứng.
- Fresh schema và upgrade 007/008/009 trên DB tạm có dữ liệu seed khớp metadata Users/Organization/membership/session/payment. 008/009 vẫn chưa áp dụng DB của chủ dự án; cần chạy sau backup trước khi dùng luồng mới. Không tạo bảng mới, vẫn 46 bảng; không xóa lịch sử hoặc tự cấp Admin thật.
- FE lint/typecheck/build/format qua. Onboarding load riêng 8 KB, main498 KB; sửa hồ sơ/preferences/follow và bật Customer có giao diện, recommendations lấy API RULES_V1, detail tải riêng khi event ngoài catalog home. Browser mới kiểm chứng bước mandatory + skip rồi purchase; chưa chạy browser độc lập mọi tổ hợp optional/category/city/follow/profile edit.
- Swagger đã mount các endpoint với input schema từ Zod đúng OpenAPI3, Bearer/Origin/idempotency; thêm options category ID số/venue bounds và danh sách organization applications riêng. Controller/service/repository tách lớp; payment/booking vẫn port/adapter như ADR-027. JWT/refresh/CSRF/provider/linking không thay.
- Không sử dụng AI, load balancer, broker hoặc thay đổi kiến trúc phân tán. Chưa thử giao dịch chuyển tiền thật, dashboard Organizer/Admin hoặc inventory quantity. Migration/document/source/test là kết quả reviewable, phần DB local còn người vận hành chạy script.

### 2026-10-12 — Dọn tài nguyên và trạng thái bàn giao

- Đã dừng/dọn PostgreSQL và Edge riêng qua runner, BE/tmp rỗng; xóa BE/Fe dist do build kiểm tra tạo và folder company trống do phương án cũ. Giữ tiến trình, Redis và dữ liệu của chủ dự án. Git diff không còn whitespace lỗi.
- Clear trạng thái mở sửa hồ sơ khi logout/mất phiên/nhận logout tab khác; FE lint/typecheck qua sau sửa. Cho Admin từ chối hồ sơ identity đã thu hồi để người đại diện có thể gửi lại bằng identity hợp lệ; approval vẫn bắt buộc identity active.
- Source/API và kiểm thử đã bàn giao; 008/009 chưa áp dụng DB local. Cần backup rồi chạy hai migration trước dùng onboarding/Organizer mới; không cấp Admin thật hay chuyển tiền thật.

- Bổ sung test identity applicant bị thu hồi: approval trả IDENTITY_INVALID, rejection thành công để cho gửi lại; PG integration cuối 23/23 qua (browser không chạy lại trong lượt này), cộng lượt Edge trước đã qua. TypeScript qua. Không có migration/tài khoản thật được ghi.

### 2026-10-12 — Admin quản lý câu hỏi onboarding (kiểm tra cuối)

- Chủ dự án chốt bốn trường lõi bắt buộc, Admin quản lý câu bổ sung. Code quyền onboarding.manage/Admin, immutable questionnaire versions, stale409/idempotency/audit, server validation trước grant role. Custom answers private trong Users; preferences/follows không sao chép.
- Metadata DB local read-only46 bảng và không bảng cấu hình câu hỏi tương đương. Migration010 thêm questionnaire lifecycle table + User answers/FK; canonical fresh47 bảng. Chưa apply008/009/010, không cấp Admin thật.
- FE /admin/onboarding thêm/bỏ/required/reorder/labels và TEXT/SINGLE_CHOICE/MULTI_CHOICE; đăng ký render bộ câu hỏi động và không cho skip câu bắt buộc. Tài khoản đã hoàn tất giữ phiên bản/câu trả lời, không regrant role.
- BE lint/typecheck và86 unit/HTTP/architecture/config qua; PG fresh/upgrade007–010 có seed qua. Integration24 ca + Edge1 qua (25/25): Admin fixture thêm required question trên UI → Customer trả lời → purchase3 vé/callback giả/check-in/admission. Kiểm tra denied Customer publishing, core keys, invalid/missing answers, stale và old answers/idempotency. FE lint/typecheck/build qua sau tách schema khỏi component cho Fast Refresh. Chưa thử Admin thật, tiền thật hoặc mọi kiểu câu hỏi trên browser.

- Kiểm tra cuối: BE toàn bộ check (secret guard/lint/typecheck/86 tests/build/format) qua, FE lint/typecheck/build/format qua. PG/Edge25/25 qua, gồm Admin thêm required question qua UI và Customer trả lời thật trong browser trước purchase. Source/DDL/seed/API/ADR/ERD đã đồng bộ; không tự apply010 hoặc cấp Admin thật. Cấu hình lưu nguyên trạng không tạo thêm version. Dọn dist/PG/Edge do kiểm thử tạo trước bàn giao.

- PG integration cuối24/24 qua (browser skip ở lượt no-op); no-op publish giữ version đã kiểm chứng, Edge trước25/25 qua. Đã dọn BE/Fe dist, PG/profile browser riêng; BE/tmp rỗng, diff không lỗi whitespace. DB thật vẫn không thay đổi.

### 2026-10-12 — Rà soát bảng trùng/thừa sau onboarding

- Audit READ ONLY metadata/FK/count/code: local46 bảng, canonical47; chỉ source-only onboarding_questionnaires chưa apply010, không bảng ngoài schema hoặc CREATE trùng. Không hai bảng có toàn bộ danh sách cột giống nhau; kiểm tra cấu trúc không thay đánh giá vòng đời.
- OrganizationProfiles/EventPublications là ứng viên gộp1:1 để đơn giản hóa; ReasonNotice có state riêng sau expiry nên ít ưu tiên. Không DROP bảng đang có12 profiles/13 publications,13 ảnh catalog chỉ nằm trong publication (event cover NULL).
- Refunds/support_reports đều0 hàng và chưa có repository nghiệp vụ, nhưng được đặc tả/FK/query mẫu dùng. Quota là hàng khóa, session/refresh/hold/item/ticket/webhook/outbox có vòng đời riêng. Questionnaire dùng chung nhiều User; answers đã trên Users. Báo cáo đầy đủ Docs/36.
- Không sửa code/DDL hoặc dữ liệu thật, không đổi auth/permission/worker/payment; không tạo DB/process/file kiểm thử, không chạy application tests cho audit tài liệu. Kiểm tra diff/liên kết/tổng nhóm47 bảng.

### 2026-10-12 — ADR-031: gộp catalog và triển khai DB local

- Chủ dự án cho phép gộp organization_profiles/event_publications vào organizations/events và apply DB. Đã cập nhật catalog/follow/recommendation/booking/ticket/approval/seed/readiness, giữ SELECT DTO công khai và deferred outbox hook. Migration011 giữ mọi field/public ID/ảnh/timestamp, EXCEPT kiểm tra trước DROP; không CASCADE, không sửa migration cũ.
- Backup backups/before-008-011-1791740552152.dump,240612 bytes; pg_restore --list hợp lệ. Đã áp dụng008/009/010/011 trong một transaction. Lần kiểm tra đầu rollback do tên alias JS/SQL khác hoa-thường, không lưu thay đổi; sửa kiểm tra rồi COMMIT thành công.
- DB thật45 bảng,12 public org profiles/13 publications/13 ảnh,1 questionnaire ACTIVE; hai bảng cũ không tồn tại. Row counts giữ nguyên; hash xác nhận auth sessions/refresh/identity/OTP, role assignment, booking/item/payment/receipt/ticket/check-in và audit/outbox không đổi. Không cấp Admin thật, không phát lại outbox khi copy.
- BE86 unit/HTTP/architecture/config qua; PostgreSQL fresh/populated upgrade007–011 khớp metadata, ảnh nháp khác ảnh công bố và base timestamp giữ nguyên. PG/Edge25/25 qua: Admin fixture câu bắt buộc → onboarding → mua3 vé/payment giả → check-in/admission. FE build qua; db:check DB thật qua. Chưa thử thanh toán tiền thật.

- Xác minh read-only sau COMMIT: tất cả repository catalog dùng DB thật chạy được; HTTP readiness/home/events/organizers/detail200,13 events/12 organizers và ảnh vẫn có. Server kiểm tra tạm đã đóng, pool/Redis đã đóng; không có API3000 chạy sẵn tại thời điểm kiểm tra nên không restart process của người dùng.

- Kiểm tra cuối: BE check đầy đủ qua (secret guard/lint/typecheck/86 tests/build/format), FE build qua; diff không lỗi whitespace. Đã dọn BE/Fe dist do kiểm thử tạo, PG cluster/browser profile tự dọn trong finally, BE/tmp rỗng. Giữ backup đã xác minh ngoài Git; migration/seed/source/ADR/ERD/log đã cập nhật. Không cần quyết định bổ sung cho hai bảng đã gộp.

### 2026-10-12 — Chuẩn bị hoàn tiền/đánh giá tổ chức/góp ý app

- Chủ dự án yêu cầu cả ba chức năng. Đã đọc quy tắc, Q-004/Q-020/Docs23, giao thức khóa và metadata DB READ ONLY. Refunds/support_reports đều0 hàng, chưa có bảng feedback/rating; event_reviews là hồ sơ duyệt, không dùng làm Customer rating.
- Dùng lại refunds; report gắn event/booking và quyền can thiệp cần giữ riêng với góp ý app. Chuẩn bị phạm vi/API đích tại Docs37, chưa thêm bảng/endpoint hoặc gọi chuyển tiền. Không sửa auth/session/provider/role, không cấp Admin thật.
- Đã hỏi hạn refund và cách ghi nhận hoàn tiền thủ công; thời điểm/thang sao/điều kiện sửa đánh giá; mức riêng tư của góp ý app. Q-004/Q-020 còn thiếu chính sách nên phần phụ thuộc chờ trả lời; không tự coi đề xuất là được duyệt.
- Không chạy application tests cho thay đổi tài liệu; kết nối metadata đã đóng, không tạo process/DB/file kiểm thử tạm.

### 2026-10-12 — ADR-032: refund/review/app feedback BE

- Chủ dự án chốt refund request24 giờ trước suất; sao1–5 sau suất/khi hủy, sửa7 ngày; review riêng tư tác giả/Organizer/Admin và góp ý app tác giả/Admin. Đã cập nhật Q-030/ADR-032/Docs37, giữ các phần compensation/hủy/USED ngoài phạm vi.
- API refund/request/decision/result/retry/report claim/resolve và feedback/create/list/get/edit/reply/handle/moderate đã mount, Swagger30 path mới. RefundService qua RefundBookingPort/RefundPaymentPort, adapter trong module sở hữu; không SQL trong service/controller, không gọi provider trong transaction. Feedback một bảng chung và version/history, DTO không history/PII; audit có organization/report scope và trạng thái, không text/evidence.
- Approval cancels mọi vé nguyên tử, giữ SOLD/no resale; manual SUCCESS có reference/evidence/time/actor thì payment/booking/ticket REFUNDED. Receipt sau refund giữ REFUNDED/FUNDS_AFTER_REFUND, không phát lại. Admin report scope bắt buộc và mất quyền sau resolve. Hai permission mới chỉ dictionary/mapping, không cấp UserRole Admin thật; auth/provider/lifetimes/linking/cookie/CSRF giữ nguyên.
- DB READ ONLY trước sửa45 bảng/refunds0/reports0, chưa feedback. Backup before-012-1791805498317.dump,241990 bytes, pg_restore --list qua; apply012 transaction bảo toàn row counts/hash users/roles/credential/order/payment/ticket/check-in/audit/outbox/reports. DB46 bảng, feedback/refund chưa có dữ liệu thật.
- BE86 unit/HTTP/architecture/config qua, PG/Edge33/33 qua: deadline/full/reject/retry/USED, approval vs admission, chứng từ concurrent, receipt sau refund, Admin assigned report/close, review uniqueness/history/7 ngày/cancelled, System privacy và HTTP auth/Origin/input. Lượt mở rộng ban đầu2 ca lỗi do fixture không reset sale window sau review; đã sửa fixture độc lập và chạy lại33/33 qua. FE build qua cho browser regression, không nối UI mới.
- DB thật db:check qua; HTTP readiness/catalog/openapi200,13 events giữ nguyên, Swagger30 path refund/feedback/report. Endpoint riêng tư trả401 khi chưa đăng nhập. Server/pool/Redis kiểm tra tạm đã đóng; không tạo refund/feedback thật, không chuyển/hoàn tiền thật. Kiểm tra audit mới đang chạy cuối; cleanup thực hiện sau đó.

- Rà soát audit cuối bổ sung organization/report FK và version/status metadata, kiểm thử xác nhận Admin refund action lưu report scope. TypeScript exactOptionalPropertyTypes đã sửa bằng optional spread. Lượt PG không browser phát hiện lỗi thật ORDER BY alias ID text khi ghế qua biên chữ số; đã đổi sang seat_hold_items.session_seat_id BIGINT và thêm regression900099/900100. Không thay auth, giá hoặc allocation policy. Bộ BE check đầy đủ86 tests và PG/Edge33 ca sau sửa đã qua; regression cố định mới đang kiểm tra cuối.

- Kết quả cuối: TypeScript qua, PG/Edge34/34 qua gồm regression ID ghế900099/900100; BE check86 tests/lint/typecheck/build/format/secret guard trước đó qua, diff không lỗi whitespace. Đã dọn BE/Fe dist do kiểm thử tạo, PG/Edge tự đóng và dọn; BE/tmp rỗng. Giữ backup đã xác minh ngoài Git và source/migration/test/Docs/ERD cần thiết. DB012 đã apply, không cần chạy lại; FE refund/feedback và chuyển/hoàn tiền thật chưa kiểm thử/chưa triển khai. Không có quyết định cần hỏi thêm trong phạm vi đã chốt.
