# 02. Yêu cầu hệ thống

## Yêu cầu chức năng

“MVP*” là phạm vi đề xuất phụ thuộc quyết định Q, chưa được duyệt. Các điều kiện nghiệm thu dưới đây là hành vi đích.

| ID | Phạm vi | Yêu cầu và điều kiện nghiệm thu |
| --- | --- | --- |
| FR-001 | MVP | Đăng ký email/mật khẩu; email chuẩn hóa không trùng; không tự gán Organizer/Admin |
| FR-002 | MVP | Đăng nhập, refresh luân chuyển token, logout một/toàn bộ thiết bị; token bị thu hồi không dùng lại được |
| FR-003 | MVP* | Xác minh email, đặt lại mật khẩu bằng mã dùng một lần; kích hoạt theo Q-006; không tiết lộ tài khoản tồn tại |
| FR-004 | MVP | Xem/sửa hồ sơ của mình bằng allowlist; đổi mật khẩu yêu cầu xác thực lại; tài khoản bị khóa bị từ chối |
| FR-005 | MVP* | Admin duyệt Organizer, khóa người dùng và thay đổi quyền có lý do, audit; Q-005 |
| FR-006 | MVP | Organizer tạo/sửa bản nháp của mình; chỉ xóa cứng nháp không có dữ liệu phụ thuộc |
| FR-007 | MVP* | Publish khi có suất, địa điểm, tồn kho và giá hợp lệ; cancel/block dừng bán ngay; xử lý vé cũ theo Q-004/Q-010 |
| FR-008 | MVP | Guest xem danh sách/chi tiết sự kiện công khai; không đọc được bản nháp hoặc dữ liệu khách |
| FR-009 | MVP | Tìm theo từ khóa, danh mục, địa điểm, khoảng thời gian, giá, còn ghế; phân trang và sort ổn định |
| FR-010 | MVP* | Quản lý venue, section, row, seat và tọa độ sơ đồ đơn giản; quyền venue theo Q-009 |
| FR-011 | MVP | Một event có nhiều session; một session có một venue; ánh xạ session-seat không trùng; tránh thay sơ đồ đã bán |
| FR-012 | MVP* | Cấu hình giá từng session-seat và khoảng mở bán; giá tiền/currency theo Q-003 |
| FR-013 | MVP* | Giữ nguyên nhóm ghế hoặc không giữ ghế nào; trả expiry theo giờ máy chủ; TTL/hạn mức theo Q-001/Q-002 |
| FR-014 | MVP* | Tạo một booking từ hold còn hạn của mình; chụp giá; gửi lại cùng key trả cùng đơn; Q-007 |
| FR-015 | MVP | Khách xem đơn/vé của mình; người khác không truy xuất được bằng cách đoán ID |
| FR-016 | MVP | Payment mock có thành công/thất bại/timeout/callback lặp; đổi adapter được khi thêm nhà cung cấp thật |
| FR-017 | MVP | Thanh toán hợp lệ xác nhận đơn và phát đúng một vé cho mỗi booking item trong cùng transaction |
| FR-018 | MVP* | Vé có QR khó đoán; kiểm tra trạng thái, suất và cửa sổ check-in; hai lần quét đồng thời chỉ một lần thành công; Q-008 |
| FR-019 | MVP* | Hủy đơn chưa thanh toán hoặc đơn hết hạn nhả ghế; không tự chuyển đơn đã thanh toán sang CANCELLED; Q-001 |
| FR-020 | MVP* | Hoàn toàn bộ bằng mock theo chính sách, thu hồi vé trước khi xử lý tiền; không hoàn vượt tiền đã nhận; Q-004 |
| FR-021 | MVP | Organizer chỉ xem số liệu các event của mình; doanh thu thành công và hoàn tiền tách biệt; không gọi mock là tiền thật |
| FR-022 | MVP | Admin xem thống kê vận hành tổng hợp; thao tác nhạy cảm có audit và quyền cụ thể |
| FR-023 | MVP | Worker giải phóng hold/booking hết hạn, thử lại công việc bền vững và đối soát payment chưa rõ kết quả |
| FR-024 | Sau MVP | Email xác nhận đơn/thanh toán, gửi vé, hủy sự kiện, nhắc lịch; retry/deduplicate và trạng thái gửi |
| FR-025 | Sau MVP | Websocket/Socket.IO cập nhật ghế; mất kết nối phải tải lại snapshot từ API |
| FR-026 | Sau MVP | Cổng thanh toán thật: webhook có xác thực, đối soát và refund; không lưu thông tin thẻ |
| FR-027 | Sau MVP | Hoàn một phần/chuyển nhượng/vé không đánh số chỉ sau khi có chính sách và sửa mô hình |
| FR-028 | Tùy chọn | AI đề xuất sự kiện, tìm kiếm ngôn ngữ tự nhiên, hỗ trợ nội dung/hỗ trợ khách theo ranh giới bên dưới |

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

FR-024 chạy bất đồng bộ từ outbox ghi cùng transaction nghiệp vụ. Email thất bại không rollback đơn đã xác nhận. Mỗi loại thông báo có khóa dedupe `(type, aggregate_id, version, recipient)`; retry có backoff và giới hạn. Worker MySQL đủ ban đầu, chưa cần RabbitMQ. Nhà cung cấp email và nội dung/opt-in: Q-006/Q-013.

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
