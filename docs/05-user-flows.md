# 05. Luồng người dùng

## Customer — FR-001, FR-013–FR-020

1. Đăng ký → xác minh email theo Q-006 → đăng nhập. Sai thông tin: lỗi chung; email chậm: gửi lại có giới hạn.
2. Duyệt/tìm sự kiện → xem chi tiết → chọn session. Sự kiện bị ẩn/hủy hoặc session hết bán: ngừng checkout, thông báo rõ.
3. Tải sơ đồ ghế → chọn ghế → gửi yêu cầu giữ. Ghế người khác vừa giữ: 409, tải lại tồn kho, không tự chọn ghế thay khách.
4. Nhận hold ID và `expiresAt`; đồng hồ đếm ngược chỉ để hiển thị. Mất mạng: truy vấn hold của mình, không giả định giữ thành công.
5. Checkout tạo booking từ hold còn hạn với idempotency key. Giá do server trả; nếu khác giá đang hiển thị phải cho khách xem trước khi thanh toán, không tự chấp nhận thay đổi giá.
6. Tạo payment attempt; trong MVP đi qua giao diện mô phỏng có nhãn rõ. Thất bại chắc chắn: được thử attempt mới khi còn hạn; timeout không rõ kết quả: hiển thị đang xác minh, không tạo attempt chồng chéo.
7. Server xử lý kết quả → xác nhận booking + tạo vé. Frontend poll chi tiết booking, không đổi trạng thái dựa vào redirect.
8. Xem vé/QR → nhân sự có quyền quét online. Vé đã dùng/hủy/hết cửa sổ: từ chối và hiển thị lý do phù hợp.
9. Nếu được chính sách cho phép, yêu cầu refund → theo dõi trạng thái; tiền chỉ được ghi đã hoàn khi adapter xác nhận.

Hết hold tại bước 5/6: trả trạng thái EXPIRED, giải phóng ghế; không kéo dài hạn do refresh trang. Thanh toán báo thành công muộn: không phát vé khi ghế đã được nhả; hiển thị cần đối soát/hoàn tiền theo [11](11-booking-concurrency.md).

## Organizer — FR-005–FR-012, FR-021

1. Đăng nhập → được duyệt Organizer (Q-005). Chưa duyệt/bị khóa: không mở chức năng quản lý.
2. Tạo event nháp → chọn danh mục, mô tả → tạo/chọn venue thuộc quyền quản lý theo Q-009.
3. Cấu hình section/row/seat → tạo session với timezone và thời gian → sinh toàn bộ session-seat → đặt giá/mở bán.
4. Preview → publish. Thiếu giá, lịch không hợp lệ, ghế trùng, venue ngoài quyền: chặn và chỉ rõ trường cần sửa.
5. Theo dõi số ghế giữ/bán, đơn thành công, tiền hoàn. Báo cáo không lấy đơn chưa trả tiền làm doanh thu.
6. Thay đổi nháp hoặc trường được phép sau publish; thay venue/sơ đồ/giờ đã bán cần chính sách Q-010, không tự sửa hàng loạt vé.
7. Quét vé thuộc suất của mình; sai suất hoặc Organizer khác: từ chối. Hủy event: dừng bán trước, sau đó chạy quy trình vé/hoàn tiền.

Organizer có thêm Customer phải chuyển luồng mua vé bình thường; quyền tổ chức không cho bỏ qua thanh toán.

## Admin — FR-005, FR-007, FR-020, FR-022

1. Đăng nhập tài khoản đã được cấp ngoài đăng ký công khai; cơ chế bootstrap/MFA theo Q-005/Q-006.
2. Duyệt hồ sơ Organizer → ghi lý do chấp nhận/từ chối và audit.
3. Quản lý user → khóa/mở khóa có lý do. Khóa thu hồi phiên, không xóa booking hay tự động hoàn tiền.
4. Kiểm duyệt event → block ngừng bán ngay; giữ lịch sử và mở công việc xử lý vé đã bán theo Q-010.
5. Xem thống kê/đối soát → duyệt refund trong phạm vi quyền. Không có nút ép booking thành công khi chưa nhận tiền.
6. Xem audit để điều tra. Thiếu quyền: 403; dữ liệu không thuộc phạm vi hỗ trợ: 404; lỗi DB: không báo thành công giả.

## System

Worker tìm hold/booking quá hạn, xử lý lại theo transaction; payment adapter chuyển thông báo đã xác minh vào service; outbox xử lý sau commit. Job lỗi có retry và cảnh báo. System không tự suy luận chính sách hoàn tiền còn mở.
