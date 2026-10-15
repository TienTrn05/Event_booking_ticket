# 12. Bảo mật, logging và auditing

> Quyết định hiện hành 2026-10-11: ADR-028 dùng một FE với ba khu vực; ADR-029 cho chọn Customer hoặc Organizer khi onboarding bằng Google/email cá nhân. Không còn yêu cầu domain/phiên công ty để vận hành Organizer. Vai trò, tên, giới tính và ngày sinh bắt buộc; sở thích/thành phố/theo dõi có thể bỏ qua. Organizer không tự nhận Customer; tạo nháp ngay, Admin vẫn duyệt tổ chức và sự kiện trước mở bán. Các đoạn mô tả cơ chế cũ dưới đây được thay thế trong phạm vi này. Xem [33](33-registration-onboarding.md) và [34](34-organizer-event-api.md).

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

Login Google/email OTP Customer và mail công ty theo [04](04-authentication-authorization.md). Không log OTP/token, không auto-link identity từ email giống nhau. Domain email công ty không tự cấp Organizer; membership/Organization phải được Admin duyệt. Admin dùng identity bootstrap có kiểm soát, xác thực lại trước thao tác nhạy cảm.

Public Web phục vụ Customer và Organizer; Admin Web chạy trên origin riêng theo [22](22-frontend-architecture.md). Không chia sẻ bundle hoặc route Admin sang Public Web. Nếu mỗi portal proxy `/api/v1` cùng origin, refresh cookie nên là host-only để phiên Public/Organizer và phiên Admin không tự lan qua host khác; Admin đăng nhập lại trên Admin Web. Nếu chọn cookie domain dùng chung hoặc API cross-site, phải có threat model và kiểm thử CSRF/session fixation riêng trước khi triển khai. Dù theo topology nào, backend vẫn kiểm tra Admin permission cho từng request và audit thao tác nhạy cảm; origin/host không phải bằng chứng phân quyền.

Helmet cấu hình header phù hợp, không coi mặc định của thư viện là đủ; kiểm thử CSP cho web và HSTS ở HTTPS. Reverse proxy phải có `trust proxy` theo topology thật, nếu sai IP spoof có thể làm rate limit vô dụng. Rate limit memory chỉ chấp nhận dev/single-instance demo; trước nhiều instance phải có shared store hoặc enforcement tại gateway (Q-012), không dùng nó làm khóa tồn kho.

Google proof/OTP chỉ nhận qua POST bảo vệ CSRF/nonce theo adapter. Cookie/CSRF phải thử đúng topology; cross-site cần SameSite=None + Secure và kiểm soát CSRF đầy đủ. Không có GET tiêu thụ OTP hoặc login bằng mã trong URL.

Chủ dự án yêu cầu upload R2 ngày 2026-10-10, ADR-022/Q-014: presigned PUT 5 phút, JPEG/PNG/WebP tối đa 5 MB, key ngẫu nhiên do server tạo, chữ ký ràng buộc type/length/If-None-Match. Complete kiểm tra receipt/User/session/ownership/quyền, HEAD/signature và revalidate dưới khóa; chỉ lưu URL. Không nhận SVG hoặc URL tùy ý để fetch. CORS bucket và giới hạn kiểm chứng tại [28](28-r2-image-upload.md).

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
- TicketType code không là credential; ticketCode/QR riêng đủ entropy, tên/mã xác thực không fuzzy match. ADR-023 ngày 2026-10-11 chủ dự án yêu cầu số CCCD riêng mỗi vé (không ảnh giấy tờ/thẻ ngân hàng): mã hóa/HMAC bằng key độc lập ngoài Git, che số ở response, staff đúng company/Organization/permission đối chiếu thật tại cửa, xóa CCCD/derivative sau ends_at +30 ngày. DOB/gender hồ sơ riêng tư; tự khai chưa được xác minh. Online CheckIn không consume vé, admission vẫn recheck VALID và proof tuổi/danh tính. Chi tiết [29](29-profile-follow-age-attendees.md).
- Layout chỉ JSON schema/hình học được phép, giới hạn body/số phần tử, kiểm tra server-side bounds/capacity/collision và ownership/version. Không upload SVG chứa script hoặc tham chiếu URL tùy ý.

## ADR-021 — email OTP Customer

SĐT chỉ là alias, không dùng để xác minh/khôi phục. EMAIL OTP gửi SMTP Gmail TLS 465; App Password/HMAC ngoài Git, không log OTP, cookie, SMTP lỗi thô/body. Challenge chỉ active sau gửi thành công; binding riêng CSRF; hạn 5 phút, attempts tổng/target chống reset resend, quota DB và IP. Consume/tăng attempts commit; replay không mở session.

Liên kết có login mới 5 phút + proof mới cùng email; revalidate dưới khóa, không auto merge email. EMAIL Customer không tạo company session/Organizer. JWT/refresh không đổi. SMTP unavailable không bypass; Gmail quota/khả năng gửi thật phải test riêng.

ADR-027: payOS webhook xác minh SDK/checksum, chuẩn hóa receipt trước lưu và bỏ raw bank payload; reference duy nhất chống callback trùng. Không tin browser redirect. Mã vé ngẫu nhiên 128 bit, DB hash + AES-GCM/AAD item/session với TICKET_ENCRYPTION_KEY độc lập. GET chỉ owner, staff cần company session/membership/permission và đúng cửa sổ; admission kiểm CCCD thật rồi USED nguyên tử. FE không lưu JWT/CCCD/QR trong storage hoặc URL. Chi tiết [32](32-payos-booking-ticket-flow.md).

ADR-030 / chủ dự án chốt2026-10-12: Admin có onboarding.manage để cấu hình câu hỏi bổ sung (thêm/bỏ/required/nhãn/thứ tự). Bốn trường role/displayName/gender/DOB luôn bắt buộc. Bộ câu hỏi có phiên bản; giữ câu trả lời cũ, không cấp quyền từ custom answers. Xem Docs/35.

## Hoàn tiền và nội dung feedback — ADR-032

Khóa đơn/ghế/payment/refund/ticket theo giao thức để approval không tranh chấp với admission; đủ mọi vé chưa USED, full amount, payment đúng và không cần đối soát. Admin phải report IN_REVIEW được giao đúng tài nguyên; reference hoàn tiền unique, evidence/time/actor bắt buộc, callback sau refund không hồi sinh. Nội dung feedback JSON/plain text, DTO không có history/contact/identity credential; audit không lưu text/refund evidence, nhưng giữ organization/report scope và version/status. Review riêng tư tác giả/Organizer/Admin, SYSTEM chỉ tác giả/Admin. Không suy quyền từ trường kind, role, eventId hoặc reportId do client gửi.


## Bổ sung 2026-10-14

Quản lý phiên giữ Bearer/Origin/CSRF, User→Session locks và revalidation; logout-all tăng authVersion/revoke toàn bộ. Audit chỉ metadata theo scope, không raw JSON/evidence/credential/PII. report.handle của Organizer không là Admin; queue/claim/support-booking/gỡ cần ADMIN/permission/report được giao đúng tài nguyên. Đóng report thu hồi scope kể cả replay. Catalog cá nhân từ JWT, no-store/Vary Authorization, token sai không fallback Guest. Chặn cá nhân không là quyền, đơn/vé/tiền giữ nguyên. Readiness cần014; cache ghế revalidate event hiện hành trước trả snapshot. Docs40/ADR-035.
