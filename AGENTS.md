# Quy tắc làm việc trong repository

Áp dụng cho mọi công việc tiếp theo trong repository này. Yêu cầu trực tiếp của chủ dự án trong hội thoại có ưu tiên cao hơn file này.

## Trước khi sửa

### Kiến trúc giai đoạn phát triển — chủ dự án chốt 2026-10-11

- Ưu tiên hoàn thiện sản phẩm bằng **Modular Monolith**, một API instance. Không tự thêm load balancer hoặc chuyển sang distributed system.
- **Phải hỏi chủ dự án trước khi triển khai bất kỳ thay đổi liên quan distributed system**, kể cả dựng cấu hình hoặc thử nghiệm nhiều instance: microservices, message broker (Kafka/RabbitMQ), cluster/replication/sharding, distributed lock/transaction hoặc hạ tầng điều phối/mở rộng phân tán. Nêu nhu cầu, lựa chọn, tác động và chi phí; chờ câu trả lời trước khi làm phần phụ thuộc.
- Redis, R2 và worker cùng codebase đã được chấp thuận chỉ tiếp tục trong phạm vi hiện có; không suy ra đây là quyền mở rộng kiến trúc phân tán. Công việc chức năng trong monolith và kiểm tra độc lập vẫn được tiếp tục theo yêu cầu hiện hành.
- Quy tắc này áp dụng cho mọi người/agent làm việc sau này, cho đến khi chủ dự án đổi quyết định rõ ràng. Xem ADR-025 trong `Docs/17-architecture-decisions.md`.

1. Đọc `PROJECT_RULES.md`, `README.md` và phần liên quan trong `Docs/`. Với auth, đọc tối thiểu `Docs/03-user-roles-permissions.md`, `Docs/04-authentication-authorization.md`, `Docs/09-api-design.md`, `Docs/12-security.md`, `Docs/18-open-questions.md` và `Docs/26-auth-progress.md`.
2. Kiểm tra Git status, code và tài liệu hiện có. Phân biệt phần đã triển khai, phần mới là đặc tả và thay đổi chưa commit của người khác. Không ghi đè thay đổi sẵn có.
3. Đối chiếu yêu cầu mới với quyết định đã ghi. Nếu mâu thuẫn, thiếu thông số ảnh hưởng bảo mật/nghiệp vụ hoặc gặp `DECISION REQUIRED`, hỏi chủ dự án trước khi triển khai phần phụ thuộc. Nêu các lựa chọn và hệ quả ngắn gọn; tiếp tục việc độc lập trong lúc chờ.

## Trong khi làm

- Không tự thay đổi cơ chế đăng nhập, cấp quyền, liên kết danh tính, lifetime token, cookie, CSRF hoặc provider đã chốt. Không tự suy ra quyền từ dữ liệu frontend, email hoặc domain.
- Thay đổi hợp đồng auth phải cập nhật tài liệu liên quan và ghi quyết định mới theo quy trình trong `Docs/15-development-rules.md`.
- Ghi việc đã làm, kiểm tra đã chạy, kết quả và việc còn chờ vào `Docs/26-auth-progress.md` sau mỗi bước auth có ý nghĩa. Trước khi làm tiếp, đọc log để tránh làm lặp hoặc hiểu nhầm trạng thái.
- Giữ bí mật ngoài Git. Không ghi token, OTP, cookie, client secret hoặc thông tin kết nối thật vào log tiến độ.

## Trước khi kết thúc

- Kiểm tra diff, chạy các kiểm tra phù hợp, dọn tài nguyên kiểm thử do mình tạo theo `PROJECT_RULES.md`.
- Cập nhật log với trạng thái thực tế; không ghi “hoàn thành” cho endpoint, luồng FE hoặc provider chưa được kiểm thử/chưa tồn tại.
- Báo ngắn gọn phần đã xong, bằng chứng kiểm tra và quyết định còn cần chủ dự án.

## Auth Customer — quyết định chủ dự án 2026-10-09

- Giữ Google Authorization Code + PKCE; phương thức thứ hai nhập email/SĐT và xác minh OTP email qua SMTP Gmail App Password ngoài Git. SĐT chỉ là alias chưa xác minh, không dùng SMS Customer.
- Hai phương thức dùng chung User qua liên kết tường minh: phiên hiện tại được xác thực trong 5 phút, proof phương thức mới cùng email; identity đã thuộc User khác trả conflict, không tự merge theo email.
- EMAIL Customer khác COMPANY_EMAIL, không cấp phiên công ty/Organizer. JWT 10 phút, refresh 7 ngày tuyệt đối/rotation, Origin/CSRF và bảo vệ credential giữ nguyên.

## Onboarding — chủ dự án đổi quyết định 2026-10-11 / ADR-029

Google/email OTP dùng được cho Customer và Organizer, không yêu cầu mail công ty. Vai trò chọn lúc onboarding (CUSTOMER hoặc ORGANIZER), displayName/gender/DOB bắt buộc. Organizer riêng Customer; chỉ bật Customer khi người dùng yêu cầu rõ qua API. Không tự cấp ADMIN. Tạo tổ chức/sự kiện nháp ngay, Admin duyệt tổ chức và sự kiện trước mở bán. Yêu cầu company session/domain cũ bị thay thế trong phạm vi này. JWT/refresh/cookie/CSRF/linking giữ nguyên. Xem Docs/33 và Docs/34.

ADR-030 / chủ dự án chốt2026-10-12: Admin có onboarding.manage để cấu hình câu hỏi bổ sung (thêm/bỏ/required/nhãn/thứ tự). Bốn trường role/displayName/gender/DOB luôn bắt buộc. Bộ câu hỏi có phiên bản; giữ câu trả lời cũ, không cấp quyền từ custom answers. Xem Docs/35.

## Search Home — chủ dự án chốt 2026-10-14 / ADR-036

Đã chấp thuận Elasticsearch **một instance** cho search/autocomplete sự kiện Home, PostgreSQL dữ liệu gốc, Redis cache, English analyzer, N-gram và gợi ý tiền tố. API vẫn Modular Monolith một instance, worker cùng codebase hiện có. Đây là ngoại lệ search được chốt của ADR-025, không quyền mở cluster/replica/sharding, broker hoặc API instance mới. Xem Docs/41. Không hỏi lại quyền cho phạm vi search đã chấp thuận.

## Indoor/outdoor — chủ dự án chốt 2026-10-14 / ADR-037

Indoor dùng ghế đánh số; outdoor dùng khu/sức chứa và khách chọn số lượng. Hoàn thiện BE outdoor, giữ lifecycle hold5 phút/tối đa6 vé/payment/attendee/QR/check-in/refund/cancel đã chốt. Mode NUMBERED/QUANTITY ở draft, không đổi sự kiện đang bán; không ghế vật lý giả hoặc hạ tầng mới. Docs42/migration016. FE editor/picker khu chưa thuộc lượt BE này.
