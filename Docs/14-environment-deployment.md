# 14. Môi trường, cấu hình và triển khai

Đã có khung BE/FE, `.env.example`, parser và CI kiểm tra nền tảng theo ADR-015/[24](24-local-development.md). Chưa có Dockerfile hoặc đích triển khai; các cấu hình cho tính năng chưa viết bên dưới vẫn là hợp đồng dự kiến.

## Môi trường

| Môi trường | Mục đích | Dữ liệu và adapter |
| --- | --- | --- |
| Development | Phát triển trên máy | MySQL local, seed giả, mock payment, email sink |
| Testing | Unit/integration/API/concurrency CI | DB riêng có thể reset, không kết nối production; clock/adapter điều khiển |
| Staging | Thử cấu hình giống production | Dữ liệu giả/đã ẩn danh, TLS, payment/email sandbox, kiểm tra webhook |
| Production | Người dùng thật sau khi đủ điều kiện | Secret manager, TLS, backup/monitoring, provider thật; mock bị cấm |

MVP có thể demo ở staging với mock và nhãn mô phỏng rõ ràng. Muốn vận hành thanh toán thật trên production phải hoàn thành FR-026 và chính sách liên quan; không gắn nhãn production-ready chỉ vì deploy thành công.

**Staging mock — chính sách đã duyệt Q-012:** bật có chủ đích endpoint outcome hiện có cho tài khoản demo trong allowlist backend, bắt buộc phiên hợp lệ, sở hữu booking và payment.provider=mock. Không cho mọi Customer/Admin tự mô phỏng tùy ý. Cấu hình allowlist tài khoản thực trước khi bật; không cần xin duyệt lại chính sách. Chưa có đích hosting và danh tính demo cụ thể thì chưa deploy. Hợp đồng chi tiết ở [09](09-api-design.md). APP_ENV phân biệt đích staging/production; NODE_ENV=production trên staging chỉ là chế độ runtime/build.

## Biến môi trường đề xuất

Không có secret thật trong tài liệu. Parser hiện dùng NODE_ENV, APP_ENV, HOST, PORT, DB_HOST/PORT/USER/PASSWORD/NAME, DATABASE_POOL_MAX, DB_LOCK_TIMEOUT_SECONDS và LOG_LEVEL. Các tên khác bên dưới dành cho tính năng tương lai, chưa được parser sử dụng. Không điền bí mật tương lai vào frontend.

| Biến | Mục đích / validation |
| --- | --- |
| `NODE_ENV` | development/test/production cho runtime Node |
| `APP_ENV` | development/testing/staging/production để phân biệt staging có NODE_ENV=production |
| `PORT` | Cổng API hợp lệ |
| `PUBLIC_APP_URL`, `API_PUBLIC_URL` | URL tuyệt đối; HTTPS ngoài local |
| `CORS_ALLOWED_ORIGINS` | Allowlist origin, không wildcard với credentials |
| `TRUST_PROXY` | Cấu hình proxy đáng tin theo topology, không tự bật true |
| `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Biến kết nối riêng trong BE/.env; đã có parser, không log; quyền runtime cần giới hạn khi triển khai |
| `DATABASE_POOL_MAX` | Giới hạn connection theo tải và số instance |
| `DATABASE_TIMEZONE` | UTC; session DB/time handling phải nhất quán |
| `BOOKING_TX_ISOLATION` | Giá trị đề xuất READ COMMITTED, validate và kiểm thử |
| `DB_LOCK_TIMEOUT_SECONDS`, `TX_RETRY_MAX` | Thời gian đợi khóa/retry hữu hạn; đề xuất retry 3 |
| `JWT_ACCESS_SECRET` | Bí mật entropy cao nếu chọn HMAC; không dùng chuỗi dễ đoán |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Giá trị cố định phải khớp token |
| `ACCESS_TOKEN_TTL_SECONDS` | Đề xuất 600, Q-006 |
| `REFRESH_TOKEN_TTL_SECONDS` | Đề xuất 604800 tuyệt đối, Q-006 |
| `OTP_TTL_SECONDS`, `OTP_MAX_ATTEMPTS`, `OTP_RESEND_COOLDOWN_SECONDS` | Khởi điểm 300/5/60 theo thiết kế 04, rate limit gửi tổng riêng |
| `OTP_HMAC_SECRET` | Secret riêng bảo vệ OTP entropy thấp; không gửi frontend |
| `GOOGLE_CLIENT_ID` | Audience Google ID token, allowlist backend; client ID không bí mật |
| `VITE_GOOGLE_CLIENT_ID` | Client ID công khai frontend; phải khớp backend |
| `SMS_PROVIDER`, `SMS_API_KEY` | Adapter SMS và credential backend, test dùng sink kiểm soát |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Secure bắt buộc ngoài local; SameSite phù hợp topology |
| `CSRF_SECRET` | Khóa riêng ký CSRF token nếu dùng signed double-submit |
| `TICKET_ENCRYPTION_KEY` | Khóa mã hóa token QR khi lưu DB; quản lý key version/rotation |
| `SEAT_HOLD_TTL_SECONDS` | 300 đã duyệt Q-001 |
| `MAX_SEATS_PER_BOOKING`, `MAX_ACTIVE_HOLDS_PER_USER_SESSION` | 6 và 1 theo Q-002; gồm booking chờ còn hạn trong quota |
| Self check-in / quầy / vào cửa | Online mở 86400 giây trước startsAt và đóng tại startsAt; window quầy/vào cửa lưu trên session, không gộp vào expiry booking |
| `DEFAULT_CURRENCY` | Q-003; chỉ một currency/booking |
| `PAYMENT_PROVIDER` | mock ở dev/test và staging đã duyệt Q-012; provider thật ở production |
| `MOCK_PAYMENT_ENABLED` | Startup fail nếu true khi APP_ENV=production |
| `MOCK_PAYMENT_ALLOWED_USER_IDS` | Đề xuất Q-012: allowlist ID chuỗi của tài khoản demo ở backend; staging bật mock phải cấu hình danh sách không rỗng đã duyệt, thiếu thì fail startup |
| `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET` | Chỉ khi adapter thật cần; không gửi frontend |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_API_KEY` | Adapter thật/sink; cấu hình theo Q-006 |
| `WORKER_POLL_INTERVAL_MS`, `OUTBOX_LEASE_SECONDS` | Poll/lease hữu hạn, lease phục hồi crash |
| `OUTBOX_MAX_ATTEMPTS` | Giới hạn retry, hết thì cảnh báo/can thiệp |
| `IDEMPOTENCY_RETENTION_HOURS` | Đề xuất 24 giờ, Q-013; không thay retention tiền |
| `LOG_LEVEL`, `LOG_RETENTION_DAYS` | Level/retention theo môi trường, Q-013 |
| `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX` | Theo route/IP/user; benchmark và điều chỉnh |
| `VITE_API_BASE_URL` | Biến frontend công khai, không bí mật |
| `VITE_MOCK_PAYMENT_VISIBLE` | Cờ UI cho dev/test hoặc staging đã duyệt; không cấp quyền API, không bật cho đích APP_ENV=production |
| `REDIS_URL`, `OBJECT_STORAGE_BUCKET` | Chỉ thêm sau MVP khi ADR/nhu cầu được duyệt |

Không có `JWT_REFRESH_SECRET` vì refresh token là opaque và DB lưu hash. Nếu đổi thuật toán access token sang bất đối xứng, thay secret bằng keypair/key ID theo ADR; không giữ hai cấu hình hoạt động mơ hồ. Mọi biến `VITE_*` có thể xuất hiện trong bundle nên chỉ dùng dữ liệu công khai.

## Luồng triển khai dự kiến

1. Chốt Q-012/Q-016; pin runtime/DB/package manager trong repo khi bắt đầu code; lockfile commit.
2. CI chạy kiểm thử cần thiết, build artifact cố định; quét secret/dependency; không chạy migration bằng user ứng dụng.
3. Backup và kiểm tra restore gần nhất; chạy migration có review bằng danh tính riêng. Schema thay đổi ưu tiên expand/contract để code trước/sau cùng hoạt động.
4. Deploy staging, chạy smoke: login, giữ ghế, mua mock/sandbox, replay callback, check-in và job expiry.
5. Triển khai production chỉ khi trong phạm vi được giao và đã đủ điều kiện kinh doanh/kỹ thuật; theo dõi error rate/latency/đối soát. Thay schema phá hủy dữ liệu phải có kế hoạch cụ thể.
6. Rollback code bằng artifact trước nếu schema tương thích; không chạy down migration phá dữ liệu tự động. Với migration dữ liệu, ưu tiên forward fix hoặc restore có đánh giá RPO.

Docker có thể thêm để tái lập môi trường trước staging, không bắt buộc cho bản đặc tả. Chưa cần Kubernetes/microservices. API và worker cùng codebase; khi tăng replica phải tính tổng connection và dùng lease/idempotency bền vững.

## Vận hành

- Liveness chỉ kiểm tra process; readiness kiểm tra DB/schema/config thiết yếu, không trả secret. Dependency ngoài bị lỗi dùng trạng thái phù hợp, tránh restart loop vô ích.
- Graceful shutdown ngừng nhận request/job, chờ transaction đang chạy trong giới hạn rồi đóng pool; job đang lease có thể reclaim.
- Backup mã hóa, lưu ngoài máy DB; đề xuất hàng ngày và diễn tập restore theo Q-012. Lưu ý một backup chưa thử restore chưa chứng minh khôi phục được.
- Dashboard: latency p50/p95, 5xx, DB pool, lock wait/deadlock, số hold hết hạn chưa xử lý, outbox backlog, payment PENDING lâu và reconciliation REQUIRED.
- Runbook: provider timeout → giữ pending/đối soát; DB lỗi → fail request/rollback; worker chết → restart/reclaim; lộ key → xoay key/thu hồi session và audit.
- Đồng bộ đồng hồ máy; expiry vẫn dựa DB. Retention/ẩn danh theo Q-013, không xóa sổ giao dịch bằng cleanup thông thường.


## Cấu hình theo nghiệp vụ đã chốt

Review lead time là một tháng lịch và TTL hồ sơ là 15 ngày theo 23, không phải TTL của booking. Worker review-expiry và Notification trong tài khoản là MVP; gửi email qua adapter ngoài transaction. Bản phiếu lý do DRAFT còn tồn tại sau restart phải hiển thị trên hàng đợi Admin.

Danh mục venue demo cần bounds/capacity/version tường minh và dữ liệu giả; không tải địa điểm thật từ dịch vụ ngoài hoặc bịa giới hạn. Layout renderer/editor không cần dịch vụ SaaS. Runtime Google/SMS/email yêu cầu cấu hình provider trước thử live; không gửi OTP/thông báo thật trong đợt sửa tài liệu này.
