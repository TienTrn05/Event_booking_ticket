# 12. Bảo mật, logging và auditing

## Quy tắc kiểm soát

| Rủi ro | Biện pháp bắt buộc |
| --- | --- |
| Lộ mật khẩu | Argon2id, salt do thư viện quản lý; không mã hóa hai chiều, không log hash |
| JWT giả/hết hạn | Allowlist thuật toán/key; kiểm tra exp/iss/aud; đối chiếu session và authVersion |
| Đánh cắp refresh | Cookie HttpOnly/Secure, DB chỉ hash, rotation và thu hồi family khi reuse |
| SQL injection | Query có tham số; allowlist sort/field; tài khoản DB quyền tối thiểu |
| XSS | React escape mặc định; tránh dangerouslySetInnerHTML; sanitize rich text nếu được cho phép; CSP và kiểm soát script ngoài |
| CSRF | Cookie endpoint kiểm tra Origin/Referer hợp lệ + CSRF token; SameSite chỉ là lớp bổ sung; không mutation qua GET |
| CORS sai | Allowlist origin cụ thể; credentials không đi với `*`; production ưu tiên cùng origin |
| Brute force/chiếm hold | Rate limit IP + tài khoản/route, quota nghiệp vụ; backoff, log giảm nhận dạng |
| IDOR/broken access control | Ownership service, scope query, deny mặc định; test chéo tài khoản/Organizer |
| Mass assignment | DTO allowlist; cấm client gán role, ownerId, price cuối, payment status |
| Rò dữ liệu | Response DTO riêng; no-store auth/vé; không để PII/token trong URL hoặc log |
| Webhook giả/replay | Verify raw-body signature theo provider, timestamp/replay window và event ID; dedupe bền vững |
| QR bị đoán/ảnh bị sao chép | Token ngẫu nhiên mạnh, tra hash, TLS và check-in một lần; ảnh QR là bearer credential nên chủ vé phải bảo vệ |
| Lạm dụng nội bộ | Permission tường minh, audit lý do; không cấp quyền DB trực tiếp cho Organizer |
| Lỗi cấu hình | Validate env khi startup; production fail nếu mock payment bật hoặc thiếu secret |

Argon2id cấu hình khởi điểm tối thiểu theo OWASP: memory 19 MiB, iterations 2, parallelism 1; benchmark máy triển khai để tăng chi phí phù hợp. Dùng thư viện duy trì tốt và lưu tham số cùng hash để nâng cấp khi đăng nhập. Tham khảo [OWASP Password Storage](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Chính sách độ dài/mật khẩu bị lộ/MFA cần Q-006; không tự chốt bằng regex bắt ký tự đặc biệt.

Helmet cấu hình header phù hợp, không coi mặc định của thư viện là đủ; kiểm thử CSP cho web và HSTS ở HTTPS. Reverse proxy phải có `trust proxy` theo topology thật, nếu sai IP spoof có thể làm rate limit vô dụng. Rate limit memory chỉ chấp nhận dev/single-instance demo; trước nhiều instance phải có shared store hoặc enforcement tại gateway (Q-012), không dùng nó làm khóa tồn kho.

Token reset/verify không chạy mutation trực tiếp khi mở GET trong email; trang nhận link gửi POST để tránh link scanner tiêu thụ token. Referrer-Policy hạn chế lộ link; frontend xóa token khỏi URL sau tiếp nhận. Chiến lược cookie/CSRF phải thử trên topology triển khai thực; nếu cross-site cần SameSite=None + Secure và kiểm soát CSRF đầy đủ.

Upload poster/object storage thuộc sau MVP: cần giới hạn kích thước/MIME, tên ngẫu nhiên, không thực thi nội dung và tránh fetch URL tùy ý gây SSRF. Không thêm upload trước khi có yêu cầu Q-014.

## Application log và audit log

Application log phục vụ vận hành/debug: thời gian, level, request ID, route template, status, duration, mã lỗi, job ID, retry count. Có rotation/retention, không ghi request body/header toàn bộ.

Audit log ghi ai thực hiện thay đổi nghiệp vụ nào, trên tài nguyên nào, lúc nào và vì sao. Audit thành công về tiền/quyền/trạng thái được ghi cùng transaction nghiệp vụ; audit thất bại/login thất bại ghi qua luồng riêng sau rollback để không mất dấu. Audit append-only ở ứng dụng, quyền DB riêng chỉ insert/read cần thiết; nếu cần chống sửa bởi quản trị DB phải bổ sung lưu trữ độc lập, không tự tuyên bố log bất biến tuyệt đối.

| Sự kiện | Application log | Audit |
| --- | --- | --- |
| Login thành công/thất bại, reuse refresh | Mã kết quả, request ID, định danh đã giảm nhận dạng | user/session khi biết, loại hành động, kết quả |
| Tạo/sửa/publish/block event | Duration, error code | Actor, event, version, thay đổi đã lọc, lý do |
| Hold/booking/expiry | Transaction outcome, lock metrics | Booking/hold, actor System/Customer, trạng thái |
| Payment/refund | Provider code/reference an toàn, lag | Amount/currency, trạng thái trước/sau, actor, lý do |
| Check-in | Outcome, latency | Ticket ID, session, người quét, timestamp; không QR |
| Admin sửa quyền/khóa user | Request ID, outcome | Người cấp, người nhận, quyền/thay đổi, lý do |

Không bao giờ log mật khẩu, password hash, access/refresh/reset/verify token, Authorization/Cookie, QR token/ciphertext, secret/key hoặc thông tin thẻ. Email/IP là dữ liệu cá nhân: mask/hash khi đủ dùng, giới hạn quyền xem, retention Q-013. Stack trace chỉ trong log nội bộ được kiểm soát, không trong response production.

## Kiểm tra trước phát hành

Chạy kiểm thử IDOR, token hết hạn/thu hồi/reuse, CSRF/CORS, SQL injection, payload thừa, brute force, mock bị tắt và callback sai. Quét bí mật/dependency; phân loại findings dựa khả năng khai thác. Có quy trình thay khóa và thu hồi phiên khi lộ secret; production thật cần chốt Q-006/Q-012/Q-013 trước vận hành.
