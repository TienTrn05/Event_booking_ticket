# 13. Chiến lược kiểm thử

Chưa có code ứng dụng hoặc bộ test chính thức; đây là kế hoạch kiểm thử theo phase. DDL đã qua 26 kiểm tra trên MySQL 8.0.46, gồm ràng buộc, truy vấn mẫu và race hai connection. Công cụ/script và báo cáo máy sinh của lần kiểm tra đã được dọn theo yêu cầu, không kèm runner trong repo. Kết quả này không chứng minh toàn bộ các test API/E2E/concurrency dưới đây đã pass.

## Các lớp kiểm thử

| Lớp | Phạm vi | Dữ liệu/công cụ dự kiến |
| --- | --- | --- |
| Unit | Giá tiền chính xác, state transition, policy ownership/refund, deadline boundary | Clock/adapter giả; không mô phỏng khóa DB để kết luận chống race |
| Integration | Service–repository–MySQL, rollback, UQ/FK/CHECK, token rotation | MySQL thật cùng phiên bản/isolation mục tiêu; DB test riêng |
| API | HTTP/schema/envelope/auth/permission/error/idempotency | Express test server và DB test; runner chọn Q-016 |
| Database | Migration lên từ rỗng và bản trước; seed; index/EXPLAIN; timezone | Dữ liệu nhỏ để assertion + tập gần thực để đo truy vấn |
| Concurrency | Nhiều connection/process giữ cùng ghế, expiry/callback/refund/check-in | Barrier đồng bộ để ép overlap, không chỉ Promise.all chạy tình cờ |
| Security | IDOR, mass assignment, token/CSRF/CORS, injection, replay, secret redaction | Hai Customer, hai Organizer, Admin hạn quyền, user bị khóa |
| E2E | UI mua vé mock và quản lý event/check-in; lỗi mạng, mất ghế, reload | Trình duyệt tự động; payment/email sandbox |
| Vận hành/tải | Restart worker, fail DB, backup restore, p95 và lock wait | Kịch bản có cấu hình máy/tải, kết quả có timestamp |

## Ma trận tình huống bắt buộc

| Test | Tình huống và kết quả cần chứng minh | Tham chiếu |
| --- | --- | --- |
| T-001 | Hai user cùng một ghế: đúng một hold; bên thua 409; DB một chủ | UC-005, BR-001/BR-002, NFR-001 |
| T-002 | Hai nhóm ghế giao nhau, thứ tự request ngược nhau: không giữ một phần; retry deadlock không tạo bản ghi thừa | UC-005, ADR-004 |
| T-003 | Hai session cùng ghế vật lý: cả hai đặt được độc lập | FR-011, BR-001 |
| T-004 | Checkout cùng hold với key giống/khác: tối đa một booking; sai chủ 404 | UC-006, BR-006/BR-032 |
| T-005 | Hold hết hạn đúng boundary và worker chưa chạy: không checkout/xác nhận; request mới cleanup được | BR-003/BR-007 |
| T-006 | Callback SUCCESS gửi hai lần và song song, cả cùng/khác event ID: một lần xác nhận, một ticket/item | UC-008, BR-011/BR-013, NFR-002 |
| T-007 | Callback race với expiry theo cả hai thứ tự: hoặc CONFIRMED + SOLD hoặc EXPIRED + đối soát; không cả hai | BR-012, NFR-003 |
| T-008 | Đơn A hết hạn, B mua ghế, SUCCESS A đến muộn: vé B và ghế B không đổi; A vào đối soát | BR-001/BR-012 |
| T-009 | Adapter timeout sau khi đã nhận yêu cầu: giữ PENDING, retry cùng provider key, không tạo attempt chồng | BR-010, FR-023 |
| T-010 | Callback sai signature/amount/currency/reference hoặc payload thay với cùng event ID: không cấp vé | BR-011, NFR-004 |
| T-011 | Crash trước commit xác nhận: rollback booking/payment/ticket/ghế; inbox retry phục hồi | BR-013, NFR-003/NFR-011 |
| T-012 | Crash sau commit trước response: replay key/callback trả tài nguyên cũ, không nhân đôi | BR-032, NFR-002 |
| T-013 | Customer A đọc/hủy/refund/ticket của B; Organizer A sửa/xem sales/check-in của B: từ chối | FR-015/FR-021, NFR-004 |
| T-014 | Admin thiếu permission và user tự gửi role/ownerId/total/status: bị từ chối | BR-025/BR-026 |
| T-015 | Quét cùng QR đồng thời: đúng một USED; lần khác 409; sai session không consume vé | UC-009, BR-015 |
| T-016 | Refund approval race check-in: chỉ một nhánh đạt policy; không vừa USED vừa hoàn theo policy chưa dùng | UC-011, BR-017/BR-018 |
| T-017 | Refund trùng, callback hoàn trùng, timeout hoàn: không vượt tiền, retry cùng khoản, vé không tự VALID lại | BR-017, NFR-002 |
| T-018 | Event block/cancel race với hold/confirm: sau commit dừng bán; tiền muộn không phát vé | BR-005/BR-026 |
| T-019 | Access hết hạn/thu hồi, refresh reuse, logout-all, đổi mật khẩu, user block: không dùng phiên cũ | FR-002/FR-004, NFR-010 |
| T-020 | Reset/verify token sai/hết hạn/dùng hai lần; hai refresh song song: đúng chính sách rotation nghiêm ngặt | FR-003, ADR-003 |
| T-021 | Thiếu CSRF token, origin lạ, SQL injection, sort lạ, XSS trong mô tả, body quá lớn | FR-006, NFR-004/NFR-010 |
| T-022 | Log/response không chứa token/QR/password hash; mock route không tồn tại trên production | BR-014/BR-031, NFR-010 |
| T-023 | Worker bị kill sau gửi trước ack; lease hết hạn: reclaim và retry, không mất công việc | FR-023/FR-024, NFR-011 |
| T-024 | Filter ngày/giá/availability phải khớp cùng session; phân trang ổn định và không lộ nháp | FR-008/FR-009 |
| T-025 | Migration, constraint sai có lỗi; tổng booking khớp item, tất cả tiền cùng currency | FR-012/FR-014, BR-009 |
| T-026 | Restore backup vào DB thử, chạy smoke test; không nối nhầm DB production | NFR-006/NFR-013 |

## Thiết kế bài concurrency

Tạo một event/session với ghế cố định; mỗi actor dùng connection/transaction riêng. Barrier đặt trước lúc acquire khóa để bảo đảm cạnh tranh. Chạy ít nhất hai thứ tự thắng, nhiều vòng; không dùng SQLite hoặc repository mock cho kết luận ACID. Dùng SQL assertion sau mọi worker hoàn tất: số phân bổ hiện tại, vé đang có hiệu lực, booking thành công, tiền/refund, ghế mồ côi.

Kiểm thử boundary bằng giờ DB hoặc expiry fixture được điều khiển, không dựa `sleep` may rủi. Chaos test chèn lỗi sau từng bước critical và kiểm tra rollback; thử commit thành công nhưng response bị mất. Mỗi test cleanup dữ liệu riêng, không dùng transaction test bao ngoài làm mất hành vi commit/locking thật.

## Mục tiêu tải và nghiệm thu

Đề xuất workload để review Q-011: 100 khách đồng thời, 1 session có 1.000 ghế, kết hợp đọc/giữ/checkout; thêm case 100 request tranh một ghế. Đo riêng tỷ lệ xung đột dự kiến (409) và lỗi hệ thống (5xx), không coi thua ghế là lỗi availability. Ghi cấu hình máy, phiên bản DB, isolation, pool size, thời lượng warmup và sample count.

Definition of Done của booking: T-001–T-012, T-015–T-018 pass trên MySQL thật; không vi phạm bất biến sau stress; retry hữu hạn; không giữ transaction khi gọi mạng; tài liệu/API khớp implementation. Toàn MVP còn cần kiểm thử auth/security/E2E và các quyết định policy liên quan đã chốt. Không đặt tỷ lệ coverage tùy ý thay cho kiểm thử rủi ro.

CI tương lai: lint/typecheck → unit → migration/integration/API → concurrency có kiểm soát → build → smoke/E2E phù hợp. Test ngẫu nhiên phải có seed tái lập; test flaky cần xử lý nguyên nhân, không chỉ tăng retry.
