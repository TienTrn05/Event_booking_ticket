# 16. Lộ trình MVP và mở rộng

Các phase là thứ tự phụ thuộc, chưa phải cam kết ngày hoàn thành. Thời gian/nguồn lực cần Q-018. Bảo mật, logging và kiểm thử được làm từ đầu theo module, không dồn cuối.

| Phase | Sản phẩm bàn giao | Điều kiện bắt đầu | Điều kiện hoàn thành |
| --- | --- | --- | --- |
| 0 — Đặc tả | README, PROJECT_RULES, 18 docs, Git local | Yêu cầu ban đầu | Tài liệu nhất quán; câu hỏi còn mở có owner; chưa viết ứng dụng |
| 1 — Nền tảng và tài khoản | Workspace web/API, config, MySQL migrations, error/logging, auth/session/permission | Q-005/Q-006/Q-016; người dùng yêu cầu triển khai | Register/login/rotation/logout/reset hoạt động; test quyền/token pass; không lộ secret |
| 2 — Quản lý sự kiện | Event/category, venue/section/row/seat, session, giá, publish, discovery UI | Q-003/Q-009/Q-010/Q-014 | Organizer không sửa tài nguyên khác; dữ liệu ghế duy nhất; tìm kiếm đúng session |
| 3 — Giữ ghế và booking | MySQL row lock, hold, checkout, expiry worker, idempotency, UI countdown | Q-001/Q-002/Q-007 | T-001–T-005/T-012 pass; restart không mất tồn kho; không giữ một phần |
| 4 — Payment mock và vé | Adapter mock, inbox/outbox, confirm nguyên tử, QR, check-in, refund mock theo policy | Q-004/Q-008 | T-006–T-018 pass; callback muộn/duplicate được xử lý; E2E mua/quét/hoàn |
| 5 — Ổn định MVP và staging | CI/CD, backup/restore, health/metric, load test, tài liệu chạy, Docker nếu có ích | Q-011/Q-012/Q-013/Q-017 | Security test, restore/smoke/tải đạt mục tiêu đã chốt; demo ghi rõ payment mô phỏng |
| 6 — Sau MVP: thanh toán/vận hành thật | Provider thật, webhook/đối soát/refund, email giao dịch, quy trình vận hành | Chính sách/nhà cung cấp được duyệt | Sandbox và failure/reconciliation tests pass trước production thật |
| 7 — Sau MVP: realtime/quy mô | Websocket, tối ưu truy vấn; Redis/object storage/broker chỉ khi đo được nhu cầu | Số liệu tải, ADR mới, Q-014 | Có đo cải thiện; tồn kho vẫn đúng khi realtime/cache lỗi |
| 8 — AI tùy chọn | Chọn một tính năng có baseline, dữ liệu và eval | Q-015, consent/chi phí/metric rõ | Backend giữ quyền kiểm soát; đánh giá hallucination/quyền/chi phí đạt mục tiêu |

MVP kỹ thuật kết thúc ở phase 5. Refund nghiệp vụ có thể bị loại khỏi MVP nếu Q-004 quyết định như vậy, nhưng phát hiện tiền thành công muộn và lưu đối soát vẫn bắt buộc. Không được che khoản tiền chưa cấp vé chỉ vì chưa có refund tự động.

## Khi nào thêm công nghệ

- Redis: chỉ khi cần chia sẻ rate limit/cache nhiều instance hoặc có nút thắt đã đo; không thay MySQL làm nguồn tồn kho.
- Websocket/Socket.IO: khi cần cập nhật ghế tức thời; sau MVP. Snapshot API và revalidation khi đặt vẫn bắt buộc.
- RabbitMQ: khi outbox worker MySQL không đáp ứng throughput/routing/consumer độc lập; vẫn giữ transactional outbox.
- Elasticsearch: khi SQL search không đạt nhu cầu tìm kiếm đã đo; cần chiến lược đồng bộ và dữ liệu trễ.
- Object storage: khi có upload/ảnh/vé xuất file thật cần lưu trữ, retention và signed URL.
- Microservices: chỉ khi biên module ổn định và có yêu cầu triển khai/scale/tổ chức độc lập đủ bù chi phí consistency/ops. Không có trong kế hoạch hiện tại.

## Ưu tiên rủi ro

Chốt TTL/quota/currency/refund trước phần đặt vé; xây transaction/concurrency trước làm UI nâng cao. Không trì hoãn ownership/idempotency đến cuối. Mỗi phase chỉ qua khi kiểm thử rủi ro cốt lõi pass; phạm vi mới phải điều chỉnh FR, ADR và roadmap cùng lúc.
