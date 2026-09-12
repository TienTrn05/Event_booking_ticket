# 14. Môi trường, cấu hình và triển khai

Đây là hướng dẫn dự kiến; chưa có app, Dockerfile, CI hoặc `.env.example` thực thi. Phiên bản runtime/công cụ và nơi triển khai cần Q-012/Q-016.

## Môi trường

| Môi trường | Mục đích | Dữ liệu và adapter |
| --- | --- | --- |
| Development | Phát triển trên máy | MySQL local, seed giả, mock payment, email sink |
| Testing | Unit/integration/API/concurrency CI | DB riêng có thể reset, không kết nối production; clock/adapter điều khiển |
| Staging | Thử cấu hình giống production | Dữ liệu giả/đã ẩn danh, TLS, payment/email sandbox, kiểm tra webhook |
| Production | Người dùng thật sau khi đủ điều kiện | Secret manager, TLS, backup/monitoring, provider thật; mock bị cấm |

MVP có thể demo ở staging với mock và nhãn mô phỏng rõ ràng. Muốn vận hành thanh toán thật trên production phải hoàn thành FR-026 và chính sách liên quan; không gắn nhãn production-ready chỉ vì deploy thành công.

## Biến môi trường đề xuất

Không có secret thật trong tài liệu. Tất cả tên dưới đây là hợp đồng đề xuất, chưa có parser sử dụng.

| Biến | Mục đích / validation |
| --- | --- |
| `NODE_ENV` | development/test/production cho runtime Node |
| `APP_ENV` | development/testing/staging/production để phân biệt staging có NODE_ENV=production |
| `PORT` | Cổng API hợp lệ |
| `PUBLIC_APP_URL`, `API_PUBLIC_URL` | URL tuyệt đối; HTTPS ngoài local |
| `CORS_ALLOWED_ORIGINS` | Allowlist origin, không wildcard với credentials |
| `TRUST_PROXY` | Cấu hình proxy đáng tin theo topology, không tự bật true |
| `DATABASE_URL` | Thông tin kết nối bí mật; không log; user ứng dụng quyền hạn chế |
| `DATABASE_POOL_MAX` | Giới hạn connection theo tải và số instance |
| `DATABASE_TIMEZONE` | UTC; session DB/time handling phải nhất quán |
| `BOOKING_TX_ISOLATION` | Giá trị đề xuất READ COMMITTED, validate và kiểm thử |
| `DB_LOCK_TIMEOUT_SECONDS`, `TX_RETRY_MAX` | Thời gian đợi khóa/retry hữu hạn; đề xuất retry 3 |
| `JWT_ACCESS_SECRET` | Bí mật entropy cao nếu chọn HMAC; không dùng chuỗi dễ đoán |
| `JWT_ISSUER`, `JWT_AUDIENCE` | Giá trị cố định phải khớp token |
| `ACCESS_TOKEN_TTL_SECONDS` | Đề xuất 600, Q-006 |
| `REFRESH_TOKEN_TTL_SECONDS` | Đề xuất 604800 tuyệt đối, Q-006 |
| `PASSWORD_RESET_TTL_SECONDS` | Đề xuất 900, Q-006 |
| `EMAIL_VERIFY_TTL_SECONDS` | Đề xuất 86400, Q-006 |
| `COOKIE_SECURE`, `COOKIE_SAME_SITE` | Secure bắt buộc ngoài local; SameSite phù hợp topology |
| `CSRF_SECRET` | Khóa riêng ký CSRF token nếu dùng signed double-submit |
| `TICKET_ENCRYPTION_KEY` | Khóa mã hóa token QR khi lưu DB; quản lý key version/rotation |
| `SEAT_HOLD_TTL_SECONDS` | Q-001, không triển khai default nghiệp vụ chưa duyệt |
| `MAX_SEATS_PER_BOOKING`, `MAX_ACTIVE_HOLDS_PER_USER` | Q-002; validate số nguyên dương |
| `CHECKIN_OPENS_BEFORE_SECONDS`, `CHECKIN_CLOSES_AFTER_SECONDS` | Q-008; chính sách theo session |
| `DEFAULT_CURRENCY` | Q-003; chỉ một currency/booking |
| `PAYMENT_PROVIDER` | mock ở dev/test; provider thật ở production |
| `MOCK_PAYMENT_ENABLED` | Startup fail nếu true khi APP_ENV=production |
| `PAYMENT_API_KEY`, `PAYMENT_WEBHOOK_SECRET` | Chỉ khi adapter thật cần; không gửi frontend |
| `EMAIL_PROVIDER`, `EMAIL_FROM`, `EMAIL_API_KEY` | Adapter thật/sink; cấu hình theo Q-006 |
| `WORKER_POLL_INTERVAL_MS`, `OUTBOX_LEASE_SECONDS` | Poll/lease hữu hạn, lease phục hồi crash |
| `OUTBOX_MAX_ATTEMPTS` | Giới hạn retry, hết thì cảnh báo/can thiệp |
| `IDEMPOTENCY_RETENTION_HOURS` | Đề xuất 24 giờ, Q-013; không thay retention tiền |
| `LOG_LEVEL`, `LOG_RETENTION_DAYS` | Level/retention theo môi trường, Q-013 |
| `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX` | Theo route/IP/user; benchmark và điều chỉnh |
| `VITE_API_BASE_URL` | Biến frontend công khai, không bí mật |
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
