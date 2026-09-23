# 12. Bảo mật, logging và auditing

## Quy tắc kiểm soát

| Rủi ro | Biện pháp bắt buộc |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Google/OTP giả hoặc bị dò | Verify Google proof ở backend, OTP HMAC/expiry/attempt limit/consume một lần theo 04; không có mật khẩu nội bộ |
| JWT giả/hết hạn | Allowlist thuật toán/key; kiểm tra exp/iss/aud; đối chiếu session và authVersion |
| Đánh cắp refresh | Cookie HttpOnly/Secure, DB chỉ hash, rotation và thu hồi family khi reuse |
| SQL injection | Query có tham số; allowlist sort/field; tài khoản DB quyền tối thiểu |
| XSS | React escape mặc định; tránh dangerouslySetInnerHTML; sanitize rich text nếu được cho phép; CSP và kiểm soát script ngoài |
| CSRF | Cookie endpoint kiểm tra Origin/Referer hợp lệ + CSRF token; SameSite chỉ là lớp bổ sung; không mutation qua GET |
| CORS sai                   | Allowlist đúng Public Web và Admin Web khi gọi chéo origin; credentials không đi với `*`; production ưu tiên `/api/v1` cùng origin qua reverse proxy của từng portal |
| Brute force/chiếm hold | Rate limit IP + tài khoản/route, quota nghiệp vụ; backoff, log giảm nhận dạng |
| IDOR/broken access control | Ownership service, scope query, deny mặc định; test chéo tài khoản/Organizer |
| Mass assignment | DTO allowlist; cấm client gán role, ownerId, price cuối, payment status |
| Rò dữ liệu | Response DTO riêng; no-store auth/vé; không để PII/token trong URL hoặc log |
| Webhook giả/replay | Verify raw-body signature theo provider, timestamp/replay window và event ID; dedupe bền vững |
| QR bị đoán/ảnh bị sao chép | Token ngẫu nhiên mạnh, tra hash, TLS và check-in một lần; ảnh QR là bearer credential nên chủ vé phải bảo vệ |
| Lạm dụng nội bộ | Permission tường minh, audit lý do; không cấp quyền DB trực tiếp cho Organizer |
| Lỗi cấu hình | Validate env khi startup; production fail nếu mock payment bật hoặc thiếu secret |

Login Google/OTP và mail công ty theo [04](04-authentication-authorization.md). Không log OTP/token, không auto-link identity từ email giống nhau. Domain email công ty không tự cấp Organizer; membership/Organization phải được Admin duyệt. Admin dùng identity bootstrap có kiểm soát, xác thực lại trước thao tác nhạy cảm.

Public Web phục vụ Customer và Organizer; Admin Web chạy trên origin riêng theo [22](22-frontend-architecture.md). Không chia sẻ bundle hoặc route Admin sang Public Web. Nếu mỗi portal proxy `/api/v1` cùng origin, refresh cookie nên là host-only để phiên Public/Organizer và phiên Admin không tự lan qua host khác; Admin đăng nhập lại trên Admin Web. Nếu chọn cookie domain dùng chung hoặc API cross-site, phải có threat model và kiểm thử CSRF/session fixation riêng trước khi triển khai. Dù theo topology nào, backend vẫn kiểm tra Admin permission cho từng request và audit thao tác nhạy cảm; origin/host không phải bằng chứng phân quyền.

Helmet cấu hình header phù hợp, không coi mặc định của thư viện là đủ; kiểm thử CSP cho web và HSTS ở HTTPS. Reverse proxy phải có `trust proxy` theo topology thật, nếu sai IP spoof có thể làm rate limit vô dụng. Rate limit memory chỉ chấp nhận dev/single-instance demo; trước nhiều instance phải có shared store hoặc enforcement tại gateway (Q-012), không dùng nó làm khóa tồn kho.

Google proof/OTP chỉ nhận qua POST bảo vệ CSRF/nonce theo adapter. Cookie/CSRF phải thử đúng topology; cross-site cần SameSite=None + Secure và kiểm soát CSRF đầy đủ. Không có GET tiêu thụ OTP hoặc login bằng mã trong URL.

Upload poster/object storage thuộc sau MVP: cần giới hạn kích thước/MIME, tên ngẫu nhiên, không thực thi nội dung và tránh fetch URL tùy ý gây SSRF. Không thêm upload trước khi có yêu cầu Q-014.

Mock staging theo đề xuất Q-012 cần đồng thời kiểm tra môi trường, cờ bật, phiên, allowlist tài khoản demo, ownership booking và provider mock theo [09](09-api-design.md). Cờ VITE không là cơ chế bảo vệ. APP_ENV=production luôn không mount mock endpoint, kể cả khi caller có role Admin.

Metadata khôi phục hold trong sessionStorage theo [22](22-frontend-architecture.md) chỉ chứa ID/request/key tối thiểu, không chứa credential hoặc QR. Dữ liệu đó không cấp quyền; server kiểm tra actor hiện tại và target trước replay. Logout/đổi tài khoản phải dọn metadata để không replay thao tác của tài khoản cũ.

## Application log và audit log

Application log phục vụ vận hành/debug: thời gian, level, request ID, route template, status, duration, mã lỗi, job ID, retry count. Có rotation/retention, không ghi request body/header toàn bộ.

Audit log ghi ai thực hiện thay đổi nghiệp vụ nào, trên tài nguyên nào, lúc nào và vì sao. Audit thành công về tiền/quyền/trạng thái được ghi cùng transaction nghiệp vụ; audit thất bại/login thất bại ghi qua luồng riêng sau rollback để không mất dấu. Audit append-only ở ứng dụng, quyền DB riêng chỉ insert/read cần thiết; nếu cần chống sửa bởi quản trị DB phải bổ sung lưu trữ độc lập, không tự tuyên bố log bất biến tuyệt đối.

| Sự kiện | Application log | Audit |
| ---------------------------------------- | --------------------------------------------------- | --------------------------------------------------- |
| Login thành công/thất bại, reuse refresh | Mã kết quả, request ID, định danh đã giảm nhận dạng | user/session khi biết, loại hành động, kết quả |
| Tạo/sửa/publish/block event | Duration, error code | Actor, event, version, thay đổi đã lọc, lý do |
| Hold/booking/expiry | Transaction outcome, lock metrics | Booking/hold, actor System/Customer, trạng thái |
| Payment/refund | Provider code/reference an toàn, lag | Amount/currency, trạng thái trước/sau, actor, lý do |
| Check-in | Outcome, latency | Ticket ID, session, người quét, timestamp; không QR |
| Admin sửa quyền/khóa user | Request ID, outcome | Người cấp, người nhận, quyền/thay đổi, lý do |

Không bao giờ log mật khẩu, password hash, access/refresh/reset/verify token, Authorization/Cookie, QR token/ciphertext, secret/key hoặc thông tin thẻ. Email/IP là dữ liệu cá nhân: mask/hash khi đủ dùng, giới hạn quyền xem, retention Q-013. Stack trace chỉ trong log nội bộ được kiểm soát, không trong response production.

## Kiểm tra trước phát hành

Chạy kiểm thử IDOR, token hết hạn/thu hồi/reuse, CSRF/CORS, SQL injection, payload thừa, brute force, mock bị tắt và callback sai. Quét bí mật/dependency; phân loại findings dựa khả năng khai thác. Có quy trình thay khóa và thu hồi phiên khi lộ secret; production thật cần chốt Q-006/Q-012/Q-013 trước vận hành.

## Bảo vệ model tổ chức/review/layout/check-in

- Admin review bản gửi đúng version; mọi can thiệp ngoài role/event review cần report OPEN/IN_REVIEW đúng tài nguyên, có audit; không để API hỗ trợ trở thành đường đọc mọi booking.
- Company session phải chứng minh identity công ty đã duyệt; phone session không tự cấp quyền Organization. Domain lookalike hoặc đổi email profile không vượt approval.
- Reason form render text an toàn, cấm HTML/script; notification chỉ đến đại diện/người nhận được scope cho phép. Không nhân danh Admin tự tạo lý do đã ký.
- TicketType code không là credential; ticketCode/QR riêng đủ entropy, tên/mã xác thực không fuzzy match; không thu giấy tờ hay thẻ ngân hàng. Online CheckIn không consume vé, admission vẫn recheck VALID.
- Layout chỉ JSON schema/hình học được phép, giới hạn body/số phần tử, kiểm tra server-side bounds/capacity/collision và ownership/version. Không upload SVG chứa script hoặc tham chiếu URL tùy ý.
