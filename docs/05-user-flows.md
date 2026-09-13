# 05. Luồng người dùng

Nguồn hiện hành: [18](18-open-questions.md), [23](23-organization-review-seatmap.md).

## Customer

1. Duyệt event đã PUBLISHED → chọn session. Đăng nhập Google hoặc OTP điện thoại trước hold/mua; mỗi thiết bị có phiên riêng. Login lỗi không cho bỏ qua.
2. Xem layout frozen do Organizer thiết kế, chọn tối đa 6 ghế; server quyết định availability dưới khóa.
3. Lưu metadata hold request/key trước gửi; giữ cả nhóm hoặc 409. Mất response/reload cùng tab replay cùng key để lấy ID rồi GET hold, không tạo key khác khi chưa rõ kết quả.
4. Checkout trong hạn 5 phút, không gia hạn: nhập tên attendee cho từng ghế, xem giá snapshot/hạng vé; server kiểm tra đủ đúng tập ghế và snapshot tên. Không lấy tên người mua cho mọi vé.
5. Payment mock → processor xác minh → booking CONFIRMED, Ticket rows cùng transaction. Timeout giữ PENDING, không chồng attempt.
6. Xem mã loại vé và mã riêng từng vé/QR. Người mua quản lý các vé trong booking; người đi cùng không nhất thiết có tài khoản.
7. Từ 24 giờ trước starts_at đến trước starts_at, tự check-in bằng tên attendee và mã vé do hệ thống cấp. Server kiểm tra ownership/tên/mã/window rồi tạo CheckIn ONLINE; Ticket vẫn VALID.
8. Nếu chưa online, đến quầy: Organizer kiểm tra tên/mã và tạo CheckIn COUNTER. Đã online thì quầy đọc bản ghi cũ.
9. Tại cửa, quét vé kiểm tra CheckIn + VALID/session/window; một lần vào cửa đổi USED. Vé hủy/refund/đã USED bị từ chối dù đã check-in trước.
10. Nếu policy cho phép, gửi refund đến Organizer. Khi cần hỗ trợ/tranh chấp, gửi report liên quan booking/event; Admin xử lý theo report, không tự can thiệp mọi đơn.

Hold hết hạn nhả ghế; tiền thành công muộn đối soát, không hồi sinh booking. Tên/mã sai trả lỗi chung phù hợp, không tiết lộ mã đúng. Mã không phải số thẻ ngân hàng/giấy tờ.

## Organizer đại diện tổ chức

1. Dùng email công ty: Google Workspace hợp lệ hoặc email OTP → gửi hồ sơ Organization → Admin duyệt tổ chức/membership/role. Email suffix một mình không cấp quyền.
2. Tạo event DRAFT của Organization → chọn venue từ danh mục có sẵn, kiểm tra bounds/capacity và timezone.
3. Mở editor 2D: kéo thả sân khấu, khu/hàng/ghế, tạo ghế theo lưới, gán nhãn; preview như khách. Server từ chối vượt bounds/capacity, đè vùng cấm hoặc sai ownership.
4. Tạo session/layout frozen đúng venue; tạo TicketType/code, cấu hình giá và cửa sổ bán/quầy/vào cửa. Sinh inventory trước bán.
5. Submit trước session sớm nhất ít nhất một tháng lịch → PENDING_REVIEW, mỗi hồ sơ 15 ngày. Bản đang chờ không sửa; muốn sửa phải withdraw, sửa DRAFT rồi submit mới.
6. Nhận approve → PUBLISHED hoặc reject + phiếu lý do. Hết 15 ngày tự nhận thông báo hủy hồ sơ, sau đó nhận phiếu giải thích do Admin soạn. Không tự coi hết hạn là được phép đăng.
7. Quản lý bán vé, sales, quầy/check-in/vào cửa, refund thuộc Organization. Không đổi nội dung/layout đã đăng qua PATCH nháp; hủy theo policy, không xóa lịch sử.
8. Report vấn đề cần Admin hỗ trợ. Người đại diện có Customer muốn mua phải qua luồng mua bình thường.

## Admin

1. Login identity đã được cấp Admin ngoài đăng ký công khai; reauthenticate khi thao tác đặc quyền.
2. Duyệt Organization và role từ hồ sơ/email công ty đã xác minh; audit quyết định.
3. Mở hàng đợi review: xem bản event/session/layout theo version, submittedAt/expiresAt; approve hoặc reject trong hạn 15 ngày.
4. Reject dùng form reasonCode/reasonText/hướng dẫn khắc phục, preview rồi gửi. Bản expired không approve lại; xuất hiện việc bắt buộc hoàn thành phiếu lý do.
5. Form expired điền sẵn metadata chỉ đọc, Admin soạn nội dung thật và xác nhận gửi; thông báo tự động về expiry đã gửi trước, không chờ form.
6. Tiếp nhận report còn mở → chỉ đọc/can thiệp tài nguyên liên quan, có lý do và audit → đóng report khi xử lý xong. Không tự sửa giá/layout/event hoặc duyệt mọi refund trong vận hành thường ngày.

## System

Expiry hold/booking theo 11. Expiry EventReview theo Event → Review locks, conditional state/deadline, notification + outbox cùng transaction; email lỗi retry, không rollback quyết định đã commit. Payment/refund adapter không thực hiện mạng trong transaction. Tác vụ expiry không tự soạn lý do nhân danh Admin.
