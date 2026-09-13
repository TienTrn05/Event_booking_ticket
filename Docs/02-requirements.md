# 02. Yêu cầu hệ thống

## Yêu cầu chức năng

“MVP*” có phần chi tiết còn mở tại [18](18-open-questions.md), không có nghĩa mọi Q đều chưa duyệt. Yêu cầu Organizer/review/editor/check-in mới tại [23](23-organization-review-seatmap.md) thuộc MVP do chủ dự án yêu cầu.

| ID | Phạm vi | Yêu cầu và điều kiện nghiệm thu |
| --- | --- | --- |
| FR-001 | MVP | Đăng nhập/đăng ký Customer bằng Google hoặc OTP SĐT; identity unique, không tự gán Organizer/Admin |
| FR-002 | MVP | Đăng nhập, refresh luân chuyển token, logout một/toàn bộ thiết bị; token bị thu hồi không dùng lại được |
| FR-003 | MVP | OTP một lần, giới hạn thử/gửi; xác minh email công ty; khôi phục qua identity đã liên kết, không reset mật khẩu nội bộ |
| FR-004 | MVP | Sửa profile allowlist, liên kết identity cần xác thực lại; tài khoản bị khóa bị từ chối, không sửa email công ty để né duyệt |
| FR-005 | MVP | Organizer là Organization, đại diện dùng email công ty đã xác minh, Admin duyệt role; can thiệp tài khoản cần report và audit |
| FR-006 | MVP | Organizer tạo/sửa bản nháp của mình; chỉ xóa cứng nháp không có dữ liệu phụ thuộc |
| FR-007 | MVP | Organizer submit ít nhất một tháng trước session sớm nhất; Admin duyệt trong 15 ngày mới PUBLISHED; expiry hủy hồ sơ/thông báo/phiếu lý do, không tự đăng |
| FR-008 | MVP | Guest xem danh sách/chi tiết sự kiện công khai; không đọc được bản nháp hoặc dữ liệu khách |
| FR-009 | MVP | Tìm theo từ khóa, danh mục, địa điểm, khoảng thời gian, giá, còn ghế; phân trang và sort ổn định |
| FR-010 | MVP | Chọn venue từ catalog có bounds/capacity; Organizer dùng editor kéo thả sân khấu/khu/hàng/ghế, server chặn vượt giới hạn và layout ngoài scope |
| FR-011 | MVP | Event có nhiều session, mỗi session một venue và layout frozen đúng event/venue; inventory riêng theo session, không đổi cấu trúc đang giữ/đã bán |
| FR-012 | MVP* | Cấu hình giá từng session-seat và khoảng mở bán; giá tiền/currency theo Q-003 |
| FR-013 | MVP | Hold nguyên tử 5 phút, tối đa 6 ghế; một phân bổ còn hạn/user/session tính cả booking chờ; khóa quota và ghế |
| FR-014 | MVP | Checkout một hold của mình, một session, tên attendee mỗi ghế; snapshot giá/tên; cùng key replay, khác target/body conflict |
| FR-015 | MVP | Khách xem đơn/vé của mình; người khác không truy xuất được bằng cách đoán ID |
| FR-016 | MVP | Payment mock có thành công/thất bại/timeout/callback lặp; đổi adapter được khi thêm nhà cung cấp thật |
| FR-017 | MVP | Thanh toán hợp lệ xác nhận đơn và phát đúng một vé cho mỗi booking item trong cùng transaction |
| FR-018 | MVP | Mã từng vé unique, tên attendee; self check-in từ 24h trước diễn hoặc tại quầy; CheckIn riêng, vào cửa mới VALID → USED nguyên tử |
| FR-019 | MVP | Hủy/hết hạn đơn chưa trả nhả ghế; checkout không gia hạn; đơn CONFIRMED chỉ xử lý tiền qua refund |
| FR-020 | MVP* | Full refund mock vé chưa USED; Organizer duyệt thường xuyên, Admin qua report; vô hiệu vé trước hoàn, không resale/vượt tiền; deadline Q-004 |
| FR-021 | MVP | Organizer chỉ xem số liệu các event của mình; doanh thu thành công và hoàn tiền tách biệt; không gọi mock là tiền thật |
| FR-022 | MVP | Admin duyệt role/event, lập phiếu lý do và xử lý report có scope/audit; không quản lý vận hành thay Organizer |
| FR-023 | MVP | Worker giải phóng hold/booking hết hạn, thử lại công việc bền vững và đối soát payment chưa rõ kết quả |
| FR-024 | MVP một phần / sau MVP | MVP thông báo trong tài khoản về duyệt/từ chối/hết hạn hồ sơ và phiếu lý do, outbox bền vững; email giao dịch bán vé/nhắc lịch mở rộng sau MVP |
| FR-025 | Sau MVP | Websocket/Socket.IO cập nhật ghế; mất kết nối phải tải lại snapshot từ API |
| FR-026 | Sau MVP | Cổng thanh toán thật: webhook có xác thực, đối soát và refund; không lưu thông tin thẻ |
| FR-027 | Sau MVP | Hoàn một phần/chuyển nhượng/vé không đánh số chỉ sau khi có chính sách và sửa mô hình |
| FR-028 | Tùy chọn | AI đề xuất sự kiện, tìm kiếm ngôn ngữ tự nhiên, hỗ trợ nội dung/hỗ trợ khách theo ranh giới bên dưới |
| FR-029 | MVP | Khách/Organizer gửi report đúng tài nguyên; Admin chỉ can thiệp trong report còn mở, có lý do và audit |
| FR-030 | MVP | Form phiếu lý do Admin: metadata chỉ đọc, reasonCode/reasonText, lưu nháp/xem trước/gửi; hồ sơ expired có nhiệm vụ bắt buộc, thông báo không gửi trùng |
| FR-031 | MVP | Organization-owned TicketType có code; từng Ticket có code riêng và attendee snapshot, code type không dùng check-in |
| FR-032 | Đã yêu cầu / chi tiết cần chốt | Hồ sơ mở bán lại/thay đổi theo nhiều nguyên nhân của Organizer; tăng sức chứa chỉ là ví dụ; bảo toàn quyền người mua theo [23, phần 9](23-organization-review-seatmap.md) |
| FR-033 | Đã yêu cầu / chi tiết cần chốt | Organizer hủy sự kiện với lý do, ảnh hưởng đơn/vé, thông báo và theo dõi xử lý; không đồng nhất hủy với hoàn tiền thành công |
| FR-034 | Đã yêu cầu / chi tiết cần chốt | Feedback có sao về hệ thống và sự kiện/tổ chức; phân biệt đối tượng, xác thực/kiểm duyệt và quyền phản hồi theo chính sách cần chốt |
| FR-035 | Đã yêu cầu / chi tiết cần chốt | Điểm uy tín Organization có tăng/giảm và lịch sử nguồn điểm, hỗ trợ Admin xét duyệt; công thức/hệ số/ngưỡng chưa chốt, không tự quyết định thay Admin |

Phần mở rộng merchandise đã được yêu cầu (chi tiết ở [23, phần 10](23-organization-review-seatmap.md)):

| ID | Phạm vi | Yêu cầu và điều kiện nghiệm thu |
| --- | --- | --- |
| FR-036 | Đã yêu cầu / chi tiết cần chốt | Organization tạo/quản lý merchandise thuộc sự kiện; khách thanh toán trên web, giao tới địa chỉ người nhận; Organizer chọn mua độc lập hoặc yêu cầu vé; tồn kho hàng tách vé, phí giao/đổi trả và xác minh vé chi tiết cần chốt |
| FR-037 | Đã yêu cầu | Tag/tên hiển thị nghệ sĩ/chương trình có thể khác tên công ty; vẫn giữ Organization làm chủ sở hữu và đối tượng uy tín, không thay catalog hoặc cấp quyền bằng tag |

## Yêu cầu phi chức năng

| ID | Yêu cầu và cách đo |
| --- | --- |
| NFR-001 | Không bán trùng ghế trong một session; kiểm tra bất biến DB sau workload đồng thời |
| NFR-002 | Callback/thao tác lặp không nhân đôi booking, thu tiền logic, vé hoặc refund |
| NFR-003 | Transaction nghiệp vụ commit đầy đủ hoặc rollback; crash không để vé hợp lệ khi chưa nhận tiền |
| NFR-004 | Không có endpoint riêng tư vượt qua ma trận quyền và ownership trong bộ API/security test |
| NFR-005 | Đề xuất p95 đọc < 500 ms, giữ ghế < 1 s, tỷ lệ 5xx < 1% tại tải được chốt Q-011; không tính thời gian khách/cổng thanh toán |
| NFR-006 | Đề xuất availability 99,5%/tháng; RPO 24 giờ, RTO 4 giờ cho demo; cần duyệt Q-011/Q-012 trước khi cam kết |
| NFR-007 | Có request ID, log có cấu trúc, metric lock wait/deadlock/hold expiry/payment lag và health check |
| NFR-008 | Module độc lập theo nghiệp vụ; dependency đi qua service/interface; typecheck/lint/test là điều kiện merge khi có code |
| NFR-009 | Có khả năng chạy nhiều API instance về sau; không dùng bộ nhớ process làm nguồn tồn kho hoặc idempotency |
| NFR-010 | Không chứa bí mật trong repo/log/response; mã hóa đường truyền ở staging/production |
| NFR-011 | Job bị chạy lặp hoặc khởi động lại không sai dữ liệu; có giới hạn retry và danh sách xử lý thủ công |
| NFR-012 | UI thể hiện giá cuối, expiry theo máy chủ, lỗi mất ghế và trạng thái thanh toán chưa rõ; hỗ trợ bàn phím/nhãn ghế; mức accessibility theo Q-014 |
| NFR-013 | Backup có kiểm tra restore; migration kiểm thử trên bản dữ liệu thử; retention theo Q-013 |
| NFR-014 | Ngày giờ API dùng ISO 8601 có offset; lưu UTC, hiển thị theo timezone của session; không phụ thuộc timezone máy chủ |

## Tìm kiếm và lọc

Chỉ tìm event PUBLISHED, session SCHEDULED chưa kết thúc, trong quyền xem công khai. Dùng `EXISTS` trên cùng một session khi kết hợp ngày, giá và còn ghế; không ghép giá suất A với chỗ trống suất B để tạo kết quả sai. Khoảng ngày theo `[from,to)`; price range là giá một ghế, không phải tổng đơn. Ghế AVAILABLE hoặc hold hết hạn là ứng viên; vẫn phải xác nhận lại dưới khóa khi đặt.

MVP dùng SQL có tham số, tìm tiêu đề dạng prefix với quy tắc dấu/hoa thường cần chốt Q-014. Tìm chứa từ hoặc FULLTEXT là phương án sau khi đánh giá tiếng Việt; không giả định B-tree tối ưu `LIKE '%...%'`. Index event `(status,category_id,id)`, session `(event_id,status,starts_at)`, venue `(city,id)`, session-seat `(session_id,status,price_minor)`; kiểm tra EXPLAIN và dữ liệu thực trước khi bổ sung. Phân trang theo [09](09-api-design.md).

## Thông báo và thời gian thực

Phần thông báo MVP của FR-024 có bản ghi trong tài khoản người nhận và outbox ghi cùng transaction quyết định/expiry; xem [23](23-organization-review-seatmap.md). Email gửi thêm qua adapter khi được cấu hình; email bán vé/nhắc lịch vẫn sau MVP. Email thất bại không rollback đơn đã xác nhận. Mỗi loại thông báo có khóa dedupe `(type, aggregate_id, version, recipient)`; retry có backoff và giới hạn. Worker MySQL đủ ban đầu, chưa cần RabbitMQ. Nhà cung cấp email và nội dung/opt-in: Q-006/Q-013.

FR-025 thuộc giai đoạn sau MVP: client đăng ký room session sau kiểm tra quyền; thông điệp chỉ có session-seat ID, trạng thái, version. Không phát PII hoặc chủ hold. Websocket không khóa ghế, không đảm bảo client đã nhận mọi sự kiện; reconnect tải lại API. MVP refresh/poll có backoff và chỉ báo dữ liệu có thể thay đổi.

## AI tùy chọn — Q-015

| Tính năng | Đầu vào; trách nhiệm AI | Backend và DB | Bảo mật; nguy cơ bịa thông tin |
| --- | --- | --- | --- |
| Gợi ý cá nhân | Sở thích đã đồng ý + lịch sử được giảm nhận dạng; xếp hạng event | Backend lọc quyền/trạng thái; DB giữ sở thích và consent | Không gửi PII không cần thiết; AI có thể đề xuất event hết vé, phải đọc lại tồn kho |
| Tìm ngôn ngữ tự nhiên | Câu hỏi; chuyển thành bộ lọc có schema | Backend validate filter rồi query có tham số; DB trả dữ liệu thật | Prompt injection; không chấp nhận SQL do mô hình sinh hoặc ID không được phép |
| Viết mô tả | Brief Organizer; sinh bản nháp | Backend kiểm tra quyền, moderation; DB lưu nháp và lịch sử duyệt | Có thể bịa địa điểm/giờ/chính sách; Organizer duyệt trước publish |
| Trợ lý hỗ trợ | Câu hỏi + FAQ có phiên bản; giải thích | Backend chỉ cung cấp đơn của người đăng nhập; DB truy xuất qua service | Không tự refund/hủy/đổi quyền; không khẳng định chính sách không có nguồn |
| Phân tích bán vé | Số liệu tổng hợp; giải thích xu hướng | Backend tính số tiền; DB aggregate theo quyền | Tránh lộ dữ liệu khách; phân biệt quan sát và dự báo, không đảm bảo doanh thu |

AI không trực tiếp ghi DB, không cầm thông tin xác thực DB, không quyết định giá/quyền/thanh toán. Chỉ triển khai sau baseline không AI, có dữ liệu phù hợp và đánh giá chất lượng/chi phí.
