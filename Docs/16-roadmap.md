# 16. Lộ trình MVP và mở rộng

Cập nhật theo quyết định chủ dự án 2026-09-12 tại [18](18-open-questions.md)/[23](23-organization-review-seatmap.md). Đã có khung BE/FE và bộ kiểm tra nền tảng; các phase nghiệp vụ vẫn là lộ trình, chưa cam kết ngày. Không xin duyệt lại quy tắc đã RESOLVED.

| Phase | Bàn giao | Phụ thuộc / nghiệm thu |
| --- | --- | --- |
| 0 — Đặc tả và đồng bộ dữ liệu | 23 docs hiện hành; DDL/seed/query/ERD cho Organization/review/layout/Google-OTP/CheckIn | Markdown, DDL 38 bảng và ERD/SVG đã đồng bộ; 67 kiểm tra DB tạm đạt, xem 20. Khung ứng dụng đã có theo ADR-015; migration production và nghiệp vụ chưa triển khai. Chốt currency và các window/policy cụ thể trước cấu hình dữ liệu tương ứng |
| 1 — Tài khoản và tổ chức | Google, OTP PHONE/COMPANY_EMAIL, sessions đa thiết bị, Organization/membership và Admin duyệt role | Chọn công cụ Q-016 và adapter test; T-019/T-020/T-032/T-033, không auto-link sai identity |
| 2 — Venue/editor và review event | Catalog có capacity/bounds, editor React/SVG, layout frozen, session/TicketType/giá, review queue, lead time 1 tháng, expiry 15 ngày, notification và form phiếu | T-034–T-037, quyền Organization/report, không tự publish hoặc approve quá hạn; app notifications là MVP |
| 3 — Hold/booking | Quota 6 ghế/1 phân bổ, TTL 5 phút, row locking, attendee snapshot, recovery request/key qua reload | T-001–T-005/T-012/T-027/T-028/T-031/T-038/T-041 trên MySQL thật |
| 4 — Tiền/vé/check-in/report | Mock adapter/inbox/outbox, confirm nguyên tử, code vé/QR, online 24h/quầy, admission một lần, Organizer refund và Admin hỗ trợ report | T-006–T-018 theo semantics admission mới, T-030/T-039/T-040; chốt deadline refund và window quầy/vào cửa |
| 5 — Staging và ổn định MVP | CI, backup/restore, security, health/metric/load tests, mock staging allowlist, Google/SMS/email cấu hình nếu thử live | T-029, restore/smoke/E2E model mới, cấu hình máy ghi rõ; cần đích hosting/danh tính demo thực, không dùng secret trong frontend |
| 6 — Sau MVP | Provider thanh toán thật, email bán vé/nhắc lịch, vận hành thật | Chính sách và nhà cung cấp được chốt; sandbox/reconciliation/security pass |
| 7 — Mở rộng có nhu cầu | Realtime/upload/object storage, tối ưu search/rate limit/scale | Chỉ thêm công nghệ theo đo lường/ADR |
| 8 — AI tùy chọn | Chọn một tính năng sau baseline/eval | Hoãn theo Q-015 |

## Ranh giới MVP đã cập nhật

MVP gồm auth/authorization; Organization và role approval; event review; venue catalog + editor; session/loại vé/giá; hold/booking/attendee; mock payment/refund; mã vé/QR; online/quầy/admission; report; notification review + form Admin; sales/audit/test/vận hành cơ bản. Editor, review và notification không còn là mở rộng tùy chọn vì chủ dự án yêu cầu trực tiếp.

Ngoài MVP: thanh toán thật, email giao dịch bán vé nâng cao, websocket, upload, partial refund, vé tự do, chuyển nhượng, offline admission, phân cấp staff phức tạp, AI. Không thêm microservices/Kafka/Kubernetes/dynamic pricing.

## Kết quả audit và thay đổi tiếp theo

Audit trước quyết định tổ chức/editor kết luận GO cho kiến trúc monolith; không dùng kết quả đó để khẳng định DDL/ERD cũ đã bao phủ yêu cầu mới.

- M-01: chính sách mock staging đã được duyệt; cần cấu hình allowlist thực và T-029.
- M-02: danh sách refund thường xuyên thuộc Organizer; Admin chỉ theo report, T-030/T-040.
- M-03: canonical hash gồm target/payload; checkout thêm attendee snapshot, T-027/T-038.
- M-04: giữ metadata hold để replay sau reload, retention 24h đã duyệt; T-028.
- ADR-013/014: model mới theo 23 đã có SQL/ERD và kiểm tra DB; implementation vẫn cần validator và transaction/service tests.

## Khi nào thêm công nghệ

- Redis: chỉ khi cần chia sẻ rate limit/cache nhiều instance hoặc có nút thắt đã đo; không thay MySQL làm nguồn tồn kho.
- Websocket/Socket.IO: khi cần cập nhật ghế tức thời; sau MVP. Snapshot API và revalidation khi đặt vẫn bắt buộc.
- RabbitMQ: khi outbox worker MySQL không đáp ứng throughput/routing/consumer độc lập; vẫn giữ transactional outbox.
- Elasticsearch: khi SQL search không đạt nhu cầu tìm kiếm đã đo; cần chiến lược đồng bộ và dữ liệu trễ.
- Object storage: khi có upload/ảnh/vé xuất file thật cần lưu trữ, retention và signed URL.
- Microservices: chỉ khi biên module ổn định và có yêu cầu triển khai/scale/tổ chức độc lập đủ bù chi phí consistency/ops. Không có trong kế hoạch hiện tại.

## Ưu tiên rủi ro

Chốt TTL/quota/currency/refund trước phần đặt vé; xây transaction/concurrency trước làm UI nâng cao. Không trì hoãn ownership/idempotency đến cuối. Mỗi phase chỉ qua khi kiểm thử rủi ro cốt lõi pass; phạm vi mới phải điều chỉnh FR, ADR và roadmap cùng lúc.
