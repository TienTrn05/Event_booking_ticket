# Quy tắc bắt buộc của dự án

## Phạm vi và nguồn yêu cầu

- Đọc [README](README.md) và tài liệu của module trước khi sửa. Phạm vi đã mở rộng theo yêu cầu chủ dự án: đặc tả, SQL và khung BE/FE với môi trường local, công cụ chất lượng và test nền tảng. Cấu trúc chính BE/, Fe/, Docs/, database/; nghiệp vụ ứng dụng triển khai theo yêu cầu tiếp theo.
- Stack: React/TypeScript/Vite, Node.js/Express/TypeScript, PostgreSQL, REST `/api/v1`, JWT, Modular Monolith.
- Không tự thêm microservices, Redis, Kafka, RabbitMQ, Kubernetes, Elasticsearch hoặc AI. Mỗi công nghệ mới phải có nhu cầu đo được và ADR.
- `DECISION REQUIRED` là quyết định chưa chốt. Không biến đề xuất thành nghiệp vụ mặc định; hỏi trước khi triển khai phần phụ thuộc. Công việc độc lập vẫn tiếp tục.
- Quyết định chủ dự án 2026-09-12 ở [18](Docs/18-open-questions.md)/[23](Docs/23-organization-review-seatmap.md) đã thay model Organizer cá nhân, tự publish và venue riêng. SQL/ERD đã đồng bộ theo ADR-014 ngày 2026-09-13; tiếp tục giữ DDL, seed/query, Mermaid/SVG và tài liệu khớp nhau khi thay model. DDL hiện hành dành cho database rỗng, không phải migration nâng cấp DB cũ.
- Mã tham chiếu: FR = chức năng, NFR = phi chức năng, BR = nghiệp vụ, UC = use case, ADR = quyết định kiến trúc; Q = câu hỏi mở. Không đổi ý nghĩa mã đã dùng.

## Kiến trúc và dữ liệu

- Quyết định chủ dự án **2026-10-11 / ADR-025**: giai đoạn phát triển triển khai **Modular Monolith, một API instance**, ưu tiên hoàn thiện sản phẩm. Không tự dựng lại load balancer.
- Mọi thay đổi liên quan distributed system phải hỏi chủ dự án **trước khi triển khai hoặc dựng thử nghiệm/hạ tầng**: nhiều instance, microservices, Kafka/RabbitMQ, cluster/replication/sharding, distributed lock/transaction và điều phối/mở rộng phân tán. Trình bày nhu cầu, tác động, lựa chọn/chi phí rồi chờ quyết định; không coi mục tiêu tải là sự đồng ý tự chuyển kiến trúc.
- Redis/R2/worker cùng codebase hiện có chỉ tiếp tục trong phạm vi đã chấp thuận; không mặc nhiên cho phép mở rộng phân tán. Quy tắc giữ hiệu lực cho mọi người/agent đến khi chủ dự án đổi quyết định rõ ràng.

- Controller chuyển đổi HTTP; service giữ nghiệp vụ, kiểm tra ownership và điều phối transaction; repository chỉ truy cập dữ liệu bằng cùng transaction context.
- TypeScript strict; không dùng `any` tùy tiện; kiểm tra mọi đầu vào ngoài hệ thống. Frontend không quyết định quyền, giá hoặc trạng thái thanh toán.
- PostgreSQL là nguồn sự thật của ghế. Mọi thay đổi tồn kho tuân thủ [giao thức khóa](Docs/11-booking-concurrency.md), không giữ transaction trong lúc người dùng thanh toán hoặc gọi mạng.
- Chống bán trùng bằng khóa hàng, kiểm tra trạng thái dưới khóa và ràng buộc unique. Không dùng riêng cache, websocket hoặc kiểm tra ở frontend.
- Thanh toán, callback, hoàn tiền, phát vé phải idempotent. Callback đến muộn không được chiếm lại ghế đã cấp cho đơn khác.
- Giá được chụp vào booking item; tiền dùng đơn vị nhỏ nhất và currency, không dùng số thực. Timestamp lưu UTC; thời gian nghiệp vụ dựa vào DB.
- Không xóa lịch sử giao dịch. Migration phải được review, có cách khôi phục và không sửa migration đã áp dụng.
- [database/schema.sql](database/schema.sql) là bản DDL để review, chưa là migration production. ERD phải khớp SQL; thay schema phải cập nhật sơ đồ, [20](Docs/20-physical-sql-design.md), ADR và kiểm tra liên quan.

## Bảo mật và chất lượng

- Mặc định từ chối quyền; kiểm tra chủ sở hữu từng tài nguyên; Admin chỉ có quyền cấp rõ ràng, có audit.
- Auth Customer dùng Google OAuth hoặc nhập email/SĐT và xác minh OTP email (SMTP Gmail). SĐT chỉ là alias chưa xác minh; phương thức mới liên kết sau login mới và proof, không tự gộp theo email. Organizer dùng email công ty theo [04](Docs/04-authentication-authorization.md); OTP lưu keyed hash có expiry/attempt limit, refresh lưu hash trong DB/cookie HttpOnly/Secure; không lưu credential vào localStorage.
- Không commit bí mật; không log mật khẩu, hash mật khẩu, token, QR bí mật, dữ liệu thẻ hoặc stack trace trong phản hồi production.
- Không cho client tự xác nhận đã trả tiền. Payment mock phải được cô lập và không thể bật trên production.
- Lỗi xử lý tập trung; SQL có tham số; allowlist trường cập nhật và sort. Quyết định thay đổi quyền, tiền, trạng thái phải có audit phù hợp.
- Kiểm thử tích hợp PostgreSQL thật cho transaction; kiểm thử tranh chấp ghế, callback trùng, hết hạn và IDOR trước khi hoàn thành đặt vé.
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

## Trước khi thêm bảng hoặc cột

- Đối chiếu schema DB thực tế, schema.sql, migration và tài liệu nghiệp vụ; ưu tiên bổ sung bảng hiện có nếu cùng thực thể/vòng đời. Không thêm bảng 1:1 hoặc bản sao field khi chưa có lý do tách biệt rõ ràng.
- Phân biệt snapshot giao dịch, cấu hình, credential, dữ liệu cá nhân và lịch sử trước khi kết luận trùng. Mọi phần dọn DB cần migration bảo toàn dữ liệu, backup và kiểm thử, không sửa migration đã áp dụng.

## Onboarding — chủ dự án đổi quyết định 2026-10-11 / ADR-029

Google/email OTP dùng được cho Customer và Organizer, không yêu cầu mail công ty. Vai trò chọn lúc onboarding (CUSTOMER hoặc ORGANIZER), displayName/gender/DOB bắt buộc. Organizer riêng Customer; chỉ bật Customer khi người dùng yêu cầu rõ qua API. Không tự cấp ADMIN. Tạo tổ chức/sự kiện nháp ngay, Admin duyệt tổ chức và sự kiện trước mở bán. Yêu cầu company session/domain cũ bị thay thế trong phạm vi này. JWT/refresh/cookie/CSRF/linking giữ nguyên. Xem Docs/33 và Docs/34.

ADR-030 / chủ dự án chốt2026-10-12: Admin có onboarding.manage để cấu hình câu hỏi bổ sung (thêm/bỏ/required/nhãn/thứ tự). Bốn trường role/displayName/gender/DOB luôn bắt buộc. Bộ câu hỏi có phiên bản; giữ câu trả lời cũ, không cấp quyền từ custom answers. Xem Docs/35.

## Search Home — ngoại lệ đã chấp thuận ADR-036 / 2026-10-14

Chủ dự án đã chọn Elasticsearch một instance để tìm/autocomplete sự kiện trang chính; PostgreSQL là dữ liệu gốc, Redis cache candidates, English/N-gram/prefix. API vẫn Modular Monolith một instance; không suy ra chấp thuận mở rộng distributed system khác. Quy tắc không tự thêm Elasticsearch ở trên được thay thế chỉ trong phạm vi này. Cấu hình, migration015, đồng bộ, kiểm chứng và giới hạn tại [Docs41](Docs/41-home-event-search.md).
