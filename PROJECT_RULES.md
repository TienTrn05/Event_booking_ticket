# Quy tắc bắt buộc của dự án

## Phạm vi và nguồn yêu cầu

- Đọc [README](README.md) và tài liệu của module trước khi sửa. Phạm vi hiện tại gồm đặc tả, sơ đồ, thiết kế SQL và kiểm tra schema; chỉ triển khai ứng dụng khi người dùng yêu cầu tiếp.
- Stack: React/TypeScript/Vite, Node.js/Express/TypeScript, MySQL, REST `/api/v1`, JWT, Modular Monolith.
- Không tự thêm microservices, Redis, Kafka, RabbitMQ, Kubernetes, Elasticsearch hoặc AI. Mỗi công nghệ mới phải có nhu cầu đo được và ADR.
- `DECISION REQUIRED` là quyết định chưa chốt. Không biến đề xuất thành nghiệp vụ mặc định; hỏi trước khi triển khai phần phụ thuộc. Công việc độc lập vẫn tiếp tục.
- Mã tham chiếu: FR = chức năng, NFR = phi chức năng, BR = nghiệp vụ, UC = use case, ADR = quyết định kiến trúc; Q = câu hỏi mở. Không đổi ý nghĩa mã đã dùng.

## Kiến trúc và dữ liệu

- Controller chuyển đổi HTTP; service giữ nghiệp vụ, kiểm tra ownership và điều phối transaction; repository chỉ truy cập dữ liệu bằng cùng transaction context.
- TypeScript strict; không dùng `any` tùy tiện; kiểm tra mọi đầu vào ngoài hệ thống. Frontend không quyết định quyền, giá hoặc trạng thái thanh toán.
- MySQL/InnoDB là nguồn sự thật của ghế. Mọi thay đổi tồn kho tuân thủ [giao thức khóa](docs/11-booking-concurrency.md), không giữ transaction trong lúc người dùng thanh toán hoặc gọi mạng.
- Chống bán trùng bằng khóa hàng, kiểm tra trạng thái dưới khóa và ràng buộc unique. Không dùng riêng cache, websocket hoặc kiểm tra ở frontend.
- Thanh toán, callback, hoàn tiền, phát vé phải idempotent. Callback đến muộn không được chiếm lại ghế đã cấp cho đơn khác.
- Giá được chụp vào booking item; tiền dùng đơn vị nhỏ nhất và currency, không dùng số thực. Timestamp lưu UTC; thời gian nghiệp vụ dựa vào DB.
- Không xóa lịch sử giao dịch. Migration phải được review, có cách khôi phục và không sửa migration đã áp dụng.
- [database/schema.sql](database/schema.sql) là bản DDL để review, chưa là migration production. ERD phải khớp SQL; thay schema phải cập nhật sơ đồ, [20](docs/20-physical-sql-design.md), ADR và kiểm tra liên quan.

## Bảo mật và chất lượng

- Mặc định từ chối quyền; kiểm tra chủ sở hữu từng tài nguyên; Admin chỉ có quyền cấp rõ ràng, có audit.
- Hash mật khẩu bằng thuật toán chuyên dụng; refresh token lưu hash trong DB, cookie HttpOnly/Secure; không lưu token vào localStorage.
- Không commit bí mật; không log mật khẩu, hash mật khẩu, token, QR bí mật, dữ liệu thẻ hoặc stack trace trong phản hồi production.
- Không cho client tự xác nhận đã trả tiền. Payment mock phải được cô lập và không thể bật trên production.
- Lỗi xử lý tập trung; SQL có tham số; allowlist trường cập nhật và sort. Quyết định thay đổi quyền, tiền, trạng thái phải có audit phù hợp.
- Kiểm thử tích hợp MySQL thật cho transaction; kiểm thử tranh chấp ghế, callback trùng, hết hạn và IDOR trước khi hoàn thành đặt vé.
- Cập nhật đặc tả/ADR khi thay đổi hành vi; báo cáo kiểm thử đã chạy và giới hạn thực tế, không tuyên bố đã triển khai khi chỉ có tài liệu.

## Hoàn tất công việc và phản hồi

- Trước khi báo hoàn tất, dừng process/server tạm do mình khởi chạy và xóa file/thư mục dư thừa do mình tạo để kiểm thử: database tạm, log tạm, ảnh chụp kiểm tra, cấu hình tạm và dependency chỉ cài phục vụ lần kiểm tra đó.
- Chỉ xóa dữ liệu xác định là do mình tạo và không còn cần thiết. Kiểm tra đường dẫn tuyệt đối nằm trong phạm vi dự kiến trước khi xóa đệ quy; không xóa dữ liệu có sẵn của người dùng hoặc process không thuộc công việc.
- Chỉ giữ sản phẩm người dùng yêu cầu: source ứng dụng nếu thuộc phạm vi, SQL, tài liệu và sơ đồ đầu ra. Xóa cả thư mục công cụ tự tạo, script kiểm thử phụ trợ, manifest/lockfile và báo cáo máy sinh chỉ phục vụ kiểm tra trong lúc làm việc; không giữ chỉ vì có thể tái sử dụng. Bộ test chính thức của ứng dụng chỉ giữ khi thuộc phạm vi được yêu cầu. `.gitignore` không thay thế việc dọn file trên ổ đĩa.
- Kiểm tra lại file còn lại và Git diff/status sau khi dọn. Nếu còn file không thể xóa hoặc process chưa dừng, nói rõ trong kết quả; không báo đã dọn sạch.
- Theo yêu cầu người dùng, mặc định chỉ gửi phản hồi cuối cùng ngắn gọn khi đã hoàn tất; không gửi cập nhật tiến độ trừ khi hướng dẫn cấp cao hơn bắt buộc hoặc cần thông tin để tiếp tục.

## Git

- Nhánh chính `main`; nhánh công việc ngắn `feature/*`, `fix/*`, `docs/*`, `refactor/*`, `chore/*`.
- Conventional Commits; commit nhỏ, có mục đích. Không ghi đè thay đổi của người dùng hoặc tự push/triển khai ngoài phạm vi được giao.
