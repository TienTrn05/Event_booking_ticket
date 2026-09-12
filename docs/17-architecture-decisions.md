# 17. Architecture Decision Records

ADR “đã xác định” phản ánh yêu cầu người dùng; “đề xuất” là phương án kỹ thuật của đặc tả. Chính sách gắn Q vẫn chưa chốt dù kiến trúc đã có hướng giải quyết.

## ADR-001 — Modular Monolith theo module và tầng

- **Trạng thái:** đã xác định.
- **Bối cảnh:** dự án cá nhân cần transaction giữa booking, ghế, payment, vé; chưa có nhu cầu deploy riêng từng dịch vụ.
- **Quyết định:** một backend Express, module theo nghiệp vụ, controller/service/repository.
- **Lý do:** giảm chi phí vận hành, giữ transaction trong một DB, dễ đọc và test.
- **Thay thế:** microservices hoặc một codebase không phân module.
- **Đánh đổi/hệ quả:** phải giữ ranh giới bằng quy ước/review; scale/deploy toàn backend; có thể tách sau khi xuất hiện nhu cầu rõ ràng. Không thêm broker chỉ để mô phỏng microservices.

## ADR-002 — MySQL/InnoDB là nguồn sự thật

- **Trạng thái:** MySQL đã xác định; InnoDB đề xuất kỹ thuật.
- **Bối cảnh:** dữ liệu quan hệ và yêu cầu không bán trùng, giữ lịch sử, đối soát tiền.
- **Quyết định:** quan hệ hướng 3NF, FK/UQ/CHECK, transaction InnoDB; giá snapshot là denormalization có chủ đích.
- **Lý do:** kiểm soát nhất quán dữ liệu tại DB và có row locking.
- **Thay thế:** PostgreSQL có khả năng tương tự; document DB cần cách mô hình hóa/ràng buộc khác.
- **Đánh đổi/hệ quả:** migration và index phải được quản lý; không scale ghi vô hạn; phiên bản và query layer cần Q-016. Không đổi DB ngoài stack đã giao.

## ADR-003 — JWT access và refresh opaque có rotation

- **Trạng thái:** JWT đã xác định; quản lý phiên đề xuất.
- **Bối cảnh:** SPA cần phiên nhiều thiết bị, logout/khóa có hiệu lực và giảm lộ token.
- **Quyết định:** access token memory, refresh cookie HttpOnly/Secure; DB hash refresh và AuthSession; kiểm tra session/authVersion mỗi request riêng tư.
- **Lý do:** cân bằng API bearer với thu hồi tức thời, không lưu token trong web storage.
- **Thay thế:** server session cookie đơn giản hơn; JWT hoàn toàn stateless ít query nhưng khó thu hồi tức thời; JWT refresh không cần thiết.
- **Đánh đổi/hệ quả:** thêm DB read và CSRF protection ở cookie endpoint; rotation nghiêm ngặt có thể yêu cầu login lại nếu response refresh bị mất; TTL/MFA theo Q-006.

## ADR-004 — Khóa bi quan trên SessionSeat, transaction ngắn

- **Trạng thái:** đề xuất kỹ thuật.
- **Bối cảnh:** nhiều khách giữ cùng ghế; nhóm ghế phải thành công toàn bộ; callback/expiry có thể chạy cùng lúc.
- **Quyết định:** pre-create session-seat, UQ `(session_id,seat_id)`, READ COMMITTED + FOR UPDATE; parent SHARE locks và thứ tự khóa ở [11](11-booking-concurrency.md).
- **Lý do:** quyền phân bổ được quyết định dưới khóa, kiểm chứng được trên MySQL thật; khóa ghế khác nhau cho phép xử lý đồng thời.
- **Thay thế:** optimistic version/conditional update, khóa cả session, Redis lock, isolation SERIALIZABLE.
- **Đánh đổi/hệ quả:** ghế nóng gây chờ, deadlock vẫn phải retry; cleanup phải khóa aggregate trước ghế; không giữ transaction trong hold TTL. Khóa cả session dễ hơn nhưng giảm throughput cả những ghế không giao nhau; Redis thêm rủi ro nhiều nguồn sự thật.

## ADR-005 — SeatHold tách Booking, xác nhận và tạo vé nguyên tử

- **Trạng thái:** đề xuất, một suất/đơn và TTL cần Q-001/Q-007.
- **Bối cảnh:** giữ trước checkout không nhất thiết tạo đơn; trạng thái PAID chưa phát vé làm tăng recovery path.
- **Quyết định:** SeatHold ACTIVE/CONVERTED/RELEASED/EXPIRED; Booking AWAITING_PAYMENT/CONFIRMED/CANCELLED/EXPIRED/REFUNDED; payment hợp lệ xác nhận + Ticket rows cùng transaction.
- **Lý do:** vòng đời gọn, expiry rõ, không có khoảng trống đã xác nhận nhưng thiếu ticket row.
- **Thay thế:** tạo booking ngay khi chọn ghế; thêm PAID và worker phát vé.
- **Đánh đổi/hệ quả:** thêm bảng hold/item; phát vé phải nhẹ và trong DB; render ảnh/PDF/email nằm ngoài transaction. Nếu ticket issuance trở nên nặng phải ADR lại.

## ADR-006 — Payment adapter, inbox/outbox và idempotency MySQL

- **Trạng thái:** đề xuất kỹ thuật; payment mock MVP đã xác định.
- **Bối cảnh:** webhook lặp, timeout chưa rõ kết quả, process có thể chết trước/sau gọi mạng.
- **Quyết định:** interface adapter mock/real; attempt/provider key bền vững, inbox dedupe callback; outbox công việc sau commit với lease/retry.
- **Lý do:** core nghiệp vụ không phụ thuộc provider; không mất công việc khi process restart; không cần RabbitMQ ngay.
- **Thay thế:** gọi mạng trong transaction; queue ngoài DB không outbox; timer trong RAM; broker từ đầu.
- **Đánh đổi/hệ quả:** thêm bảng và worker polling, chấp nhận at-least-once và độ trễ; consumer phải idempotent, không hứa exactly-once qua mạng. Cần job đối soát khi outcome không rõ.

## ADR-007 — QR opaque, check-in online một lần

- **Trạng thái:** đề xuất; cửa sổ/người quét theo Q-008.
- **Bối cảnh:** cần vé khó đoán, thu hồi được và chống quét hai lần trên nhiều thiết bị.
- **Quyết định:** token QR ngẫu nhiên entropy cao, lookup bằng hash; ciphertext mã hóa để chủ vé xem lại; check-in kiểm tra DB và chuyển VALID → USED nguyên tử.
- **Lý do:** QR không chứa PII, trạng thái thu hồi có hiệu lực ở lần quét online tiếp theo.
- **Thay thế:** signed token tái dựng không cần ciphertext; QR chứa ID tuần tự; check-in offline.
- **Đánh đổi/hệ quả:** phải quản lý encryption key và kết nối khi quét; ảnh bị sao chép vẫn có thể bị dùng trước chủ vé, một lần quét không chứng minh danh tính. Offline/check tên/chuyển nhượng cần chính sách khác.

## ADR-008 — Monorepo web/API, REST có phiên bản

- **Trạng thái:** stack/REST đã xác định; layout đề xuất.
- **Bối cảnh:** một người phát triển cả hai phía, cần hợp đồng dễ review.
- **Quyết định:** apps/web và apps/api trong một repo, API `/api/v1`, schema DTO rõ, ID/tiền chuỗi.
- **Lý do:** thay đổi contract/frontend/backend cùng một PR; tránh mất chính xác BIGINT.
- **Thay thế:** hai repo độc lập; GraphQL; một thư mục trộn frontend/backend.
- **Đánh đổi/hệ quả:** CI cần chạy theo phạm vi nhưng không bỏ test contract; phải tránh chia sẻ entity chứa bí mật sang client; package manager cần Q-016.

## ADR-009 — Main và nhánh công việc ngắn

- **Trạng thái:** đề xuất, repo local khởi tạo main.
- **Bối cảnh:** dự án cá nhân chưa cần nhiều dòng phát hành song song.
- **Quyết định:** main + feature/fix/docs/refactor/chore, Conventional Commits.
- **Lý do:** lịch sử đơn giản, review nhỏ và tránh chi phí merge nhiều nhánh dài.
- **Thay thế:** GitFlow với develop/release/hotfix hoặc commit trực tiếp mọi thay đổi vào main.
- **Đánh đổi/hệ quả:** cần kỷ luật kiểm tra trước merge; thêm release strategy khi nhu cầu thật xuất hiện; remote/protection cần Q-017.

## ADR-010 — Chưa thêm realtime, Redis, search engine hoặc AI vào MVP

- **Trạng thái:** nguyên tắc tối giản đã xác định; thứ tự triển khai đề xuất.
- **Bối cảnh:** rủi ro lớn nhất hiện tại là tính đúng và bảo mật, chưa có số liệu chứng minh cần hạ tầng bổ sung.
- **Quyết định:** MySQL search + API refresh ở MVP; công nghệ bổ sung qua phase sau có đo lường.
- **Lý do:** tập trung ngân sách phát triển vào transaction, kiểm thử và vận hành cơ bản.
- **Thay thế:** thêm Socket.IO/Redis/Elasticsearch/LLM ngay từ đầu.
- **Đánh đổi/hệ quả:** UI ghế có thể trễ và SQL search hạn chế ngôn ngữ; API phải xử lý 409 tốt. Khi có nhu cầu mới, tạo ADR thay thế dựa trên metric/use case, không dựa trào lưu.
