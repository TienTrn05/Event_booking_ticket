# 23. Tổ chức, duyệt sự kiện và công cụ thiết kế sơ đồ

Nguồn: quyết định trực tiếp của chủ dự án ngày 2026-09-12: chấp thuận các khuyến nghị trước đó, với điều chỉnh về Organizer tổ chức, quyền Admin, đăng nhập, vé/check-in và venue. [18](18-open-questions.md) ghi trạng thái từng quyết định. Đây là đặc tả, chưa phải chức năng đã triển khai.

## 1. Organizer là tổ chức

`Organization` là đơn vị tổ chức, độc lập với `User` là người đăng nhập. Event và layout thuộc Organization; audit ghi người thực hiện. Không dùng chung một mật khẩu cho cả công ty. MVP bắt đầu bằng một người đại diện đã được Admin duyệt; mô hình membership giữ scope tổ chức, không cần thêm hệ thống phân cấp nhân sự trong MVP.

Người đại diện đăng ký hồ sơ gồm tên tổ chức, domain công ty và email công ty của mình. Đăng nhập công ty bằng Google Workspace phù hợp hoặc email OTP theo [04](04-authentication-authorization.md), xác minh quyền truy cập mailbox rồi Admin duyệt hồ sơ/role; việc email kết thúc bằng một chuỗi giống tên công ty không tự cấp quyền. Domain được chuẩn hóa và so khớp chính xác, không dùng contains/endsWith tùy tiện; `company.com.attacker.example` không khớp `company.com`. Gmail hoặc số điện thoại dùng cho tài khoản cá nhân không thay thế email công ty khi xin Organizer. Không coi domain email là bằng chứng pháp lý duy nhất của tổ chức.

Organization: PENDING_REVIEW → APPROVED hoặc REJECTED; hồ sơ bị từ chối có thể sửa rồi gửi lại. Chỉ Admin cấp quyền Organizer gắn membership sau duyệt; trạng thái tổ chức và membership phải được kiểm tra trên mọi thao tác quản lý. Report hợp lệ có thể dẫn đến SUSPENDED qua thao tác Admin được audit. Không tự khôi phục role/phiên cũ khi mở lại.

## 2. Organizer vận hành; Admin duyệt và hỗ trợ

Organizer quản lý nội dung sự kiện, lịch, loại vé/giá, layout, bán vé, check-in, doanh số và refund thuộc tổ chức. Không quản lý tổ chức khác hoặc tự xác nhận thanh toán. Admin thực hiện hai nghiệp vụ thường xuyên: duyệt tổ chức/role và duyệt sự kiện trước khi đăng.

Các quyền can thiệp khác của Admin (xem đơn hỗ trợ, khóa, xử lý tranh chấp/refund) phải đi qua report liên quan, có lý do, scope và audit. Không có thao tác giả danh Organizer để sửa nội dung tùy ý. RBAC vẫn giữ quyền Admin nhưng service chỉ cho thực thi khi có report OPEN/IN_REVIEW đúng tài nguyên; đóng report thì không tiếp tục dùng làm lý do truy cập. Một chuỗi truy vết report → event/booking/refund phải được kiểm tra từ DB, không tin reportId client gửi.

`SupportReport`: người gửi, loại vấn đề, nội dung, tài nguyên liên quan, trạng thái OPEN/IN_REVIEW/RESOLVED và Admin tiếp nhận. Người gửi chỉ đọc report của mình; Organizer chỉ thấy report thuộc tổ chức trong phạm vi cần xử lý; Admin có quyền tiếp nhận. Báo cáo không cấp quyền đọc QR, credential hoặc dữ liệu không liên quan. Chưa thêm chat/tệp đính kèm/SLA hỗ trợ.

Refund thông thường do Organizer duyệt trong phạm vi event của tổ chức; Admin chỉ xử lý refund khi có report cần can thiệp. Giữ toàn bộ bất biến full refund, chưa USED, thu hồi vé trước gọi adapter, retry cùng key, không resale. Deadline refund và bù trừ tự động còn cần Q-004; không tự suy ra từ thời hạn duyệt sự kiện.

## 3. Sự kiện phải được Admin duyệt trước khi công khai

Organizer tạo DRAFT, chuẩn bị session/layout/giá, rồi submit → PENDING_REVIEW. Admin duyệt đúng phiên bản đã gửi → PUBLISHED; từ chối → REJECTED kèm lý do. Organizer sửa bản bị từ chối → DRAFT và submit lại. Organizer có thể rút bản đang chờ về DRAFT, tăng version để request approve cũ không còn hợp lệ.

Trong PENDING_REVIEW, không sửa trực tiếp nội dung, lịch, loại vé/giá hoặc layout đã gửi; phải rút hồ sơ trước. Approval khóa Event UPDATE rồi session theo ID, kiểm tra lại event.version, tổ chức đã duyệt, cấu hình hợp lệ và layout đã đóng băng trước commit PUBLISHED + audit. Hai quyết định cạnh tranh chỉ một lần chuyển trạng thái thành công. Organizer không có endpoint tự publish.

MVP không sửa nội dung/cấu trúc sự kiện đã PUBLISHED qua PATCH để vượt vòng duyệt. Organizer vẫn quản lý tồn kho, xem doanh số, check-in, xử lý refund và hủy đúng policy. Quy trình cập nhật nội dung đã đăng nếu cần về sau phải có phiên bản được duyệt riêng; không âm thầm thay bản đang bán.

### Thời hạn và phiếu lý do hủy hồ sơ

Organizer phải gửi hồ sơ ít nhất **1 tháng trước session sớm nhất**. Quy ước kỹ thuật: một tháng lịch theo timezone của session sớm nhất, trừ một tháng giữ giờ địa phương và chặn ngày ở cuối tháng khi cần; ví dụ session 31/03 thì hạn gửi là 28/02 (29/02 năm nhuận) cùng giờ. Đổi kết quả sang UTC để so với giờ DB; không dùng timezone máy chủ. Đây là cách cụ thể hóa “1 tháng”, không đổi thành 30 ngày ngầm.

Mỗi lần submit hợp lệ tạo EventReview PENDING với submitted_at và expires_at = submitted_at + 15 ngày (15 × 24 giờ). Admin chỉ approve/reject khi DB_NOW < expires_at dưới khóa. Worker hoặc request phát hiện quá hạn dùng cùng khóa Event → EventReview: chuyển review EXPIRED, event chưa đăng thành REJECTED với lý do hệ thống REVIEW_EXPIRED, tạo outbox thông báo **hủy hồ sơ duyệt** và bản nháp phiếu lý do phải hoàn thành. Không chờ Admin soạn lý do mới hết hạn; không tự publish hoặc hủy booking đã bán.

Notification ngay khi hết hạn nói đúng sự thật “Hồ sơ hết hạn 15 ngày và đã bị hủy; đang chờ phiếu giải thích của Admin”. Admin phải mở form hoàn tất lý do rồi gửi phiếu riêng đến Organizer. Không giả mạo lý do do Admin viết bằng nội dung tự sinh. Nếu chưa có Admin nhận hồ sơ, nhiệm vụ soạn phiếu nằm trong danh sách chung cần tiếp nhận.

Form có event/review ID, tên tổ chức/sự kiện, ngày gửi/hạn duyệt (chỉ đọc), loại xử lý, reasonCode chọn danh mục, reasonText bắt buộc, hướng dẫn khắc phục, người xử lý và nút lưu nháp/xem trước/gửi phiếu. Mẫu gợi ý có thể điền sẵn các trường nhận diện, nhưng Admin phải xác nhận nội dung trước gửi. Rejection trong hạn cũng dùng form, transaction lưu quyết định + phiếu + audit/outbox; expiry tạo nhiệm vụ và gửi phiếu sau. Phiếu đã gửi bất biến, không sửa/xóa lịch sử; nếu cần bổ sung thì thêm thông báo liên kết.

EventReview: PENDING → APPROVED/REJECTED/EXPIRED/WITHDRAWN. ReasonNotice: DRAFT → SENT. Status SENT là đã ghi bền vững thông báo trong tài khoản người nhận; email adapter thất bại không làm mất thông báo đó. Dedupe theo reviewId + loại thông báo; retry không nhân thông báo. Nộp lại là review mới, vẫn phải đủ khoảng cách một tháng; không gia hạn hồ sơ cũ hoặc approve muộn. Đổi lịch trong bản nháp rồi gửi lại phải qua validation từ đầu.

## 4. Vé, người tham dự và check-in

Khách bắt buộc đăng nhập trước hold/mua, hỗ trợ nhiều AuthSession độc lập trên nhiều thiết bị. Người mua sở hữu/quản lý booking; khi checkout phải nhập tên người tham dự cho từng vé. Một đơn nhiều vé có nhiều tên, không lấy display_name người mua cho mọi vé.

`TicketType` phân loại vé trong một session (ví dụ tên hạng do Organizer đặt), có code unique trong session. Mỗi SessionSeat gắn một TicketType; giá thực tế vẫn snapshot theo ghế lúc hold. `ticket_code` riêng unique toàn hệ thống nhận diện từng vé phát hành; không dùng code loại vé làm credential check-in. Vé cùng loại vẫn có mã vé riêng. QR tiếp tục opaque, không chứa tên/số giấy tờ.

Checkout gửi holdId và danh sách `{sessionSeatId, attendeeName}` khớp chính xác tập ghế giữ; validate số lượng, không trùng/thiếu/ghế lạ. Snapshot tên vào BookingItem và đọc qua Ticket; tên không tự đổi khi người mua sửa profile. Cùng hold đã chuyển với danh sách tên khác là conflict, không trả thành công như payload tương đương. Idempotency hash bao gồm tên đã chuẩn hóa và target, không log payload.

### Check-in trước sự kiện và tại quầy

“Mã số thẻ” là **mã vé do hệ thống cấp**, không phải số giấy tờ hay thẻ ngân hàng. Tên và mã phải khớp vé được mua; chuẩn hóa tên bằng Unicode NFC, trim và gộp khoảng trắng, không fuzzy match hoặc tự bỏ dấu để chấp nhận sai người. Mã dùng bảng ký tự không gây nhầm, ngẫu nhiên đủ mạnh (ít nhất 128 bit entropy), unique; hiển thị/nhập hoặc copy được, có rate limit chống dò.

Khách đăng nhập, chọn vé thuộc booking của mình, nhập/xác nhận attendeeName và ticketCode. Cửa sổ self check-in: starts_at - 24 giờ <= DB_NOW < starts_at. Thành công tạo CheckIn với method ONLINE, checked_in_at và actor, **Ticket vẫn VALID**. Mỗi vé tối đa một CheckIn, retry trả cùng kết quả. Khách mua hộ có thể thao tác cho từng vé thuộc booking, tên vẫn là tên attendee đã khai.

Tại quầy, người đại diện Organization có quyền tra tên + mã của vé đúng event/session và tạo CheckIn method COUNTER; người tham dự không cần tự đăng nhập máy quầy. Đã online thì quầy chỉ đọc kết quả, không tạo bản ghi thứ hai. Giờ quầy là cấu hình session counter_opens_at/counter_closes_at hợp lệ, bắt buộc trước gửi duyệt; chưa áp một con số ngoài yêu cầu.

Vào cửa là thao tác riêng: nhân sự được quyền quét QR hoặc mã vé, kiểm tra CheckIn đã có, tên khi cần đối chiếu, session/window, event không block/cancel và Ticket VALID rồi mới đổi USED nguyên tử. Quầy có thể thực hiện hai thao tác nối tiếp nhưng không đồng nhất chúng. Vé đã self check-in vẫn refund được nếu các điều kiện refund khác đạt; khi refund hủy vé, CheckIn giữ lịch sử nhưng không tạo quyền vào cửa. Hai quét vào cửa chỉ một thành công, kể cả từ hai thiết bị khác nhau.

CheckIn không chứa dữ liệu thẻ/giấy tờ và không chứng minh danh tính pháp lý. Không thêm QR công khai chứa tên. Các giờ cửa vào admission_opens_at/admission_closes_at phải cấu hình/validate, chưa được suy ra từ thời hạn duyệt hoặc hold. Các cửa sổ này có timezone/UTC rõ ràng, mở trước đóng; thời gian online cố định từ starts_at-24h đến starts_at, không do Organizer kéo dài tùy ý.

## 5. Danh mục venue và layout tách riêng

Venue là địa điểm có sẵn để tìm/chọn theo tên/thành phố, có địa chỉ, timezone, sức chứa tối đa và biên không gian thiết kế. Organizer chọn địa điểm; họ sở hữu layout sự kiện, không sở hữu hoặc sửa giới hạn của venue dùng chung. Danh mục demo được chuẩn bị bằng dữ liệu có nguồn/seed có kiểm soát; ai duy trì danh mục thật và nguồn giới hạn cần Q-009. Không gán số đo tùy ý cho địa điểm thật.

`SeatLayout` thuộc Organization/Event và tham chiếu venue cùng phiên bản giới hạn. `Seat` lúc này là một vị trí ngồi trong layout, không còn là ghế vật lý dùng chung cho mọi event tại venue. Session tham chiếu một layout đóng băng đúng venue/event; SessionSeat vẫn là nguồn tồn kho riêng của session. Hai event cùng venue có layout độc lập; sửa layout A không sửa ghế của B. Venue trùng thời gian có được phép vẫn là câu hỏi Q-010 riêng.

## 6. Công cụ kéo thả được xây như thế nào?

MVP xây **editor 2D ngay trong trang quản lý bằng React + SVG**, không cần dịch vụ thiết kế bên ngoài, AI hoặc mô hình 3D. Đây là phần mở rộng MVP do yêu cầu trực tiếp của chủ dự án. Cùng dữ liệu layout được dùng cho màn hình chọn ghế của khách.

1. Chọn venue: tải phiên bản bounds, width/height, maxCapacity và các vùng không được đặt ghế. Demo có thể dùng biên chữ nhật; venue có biên phức tạp phải có dữ liệu phù hợp trước khi hỗ trợ, không giả rằng mọi địa điểm là hình chữ nhật.
2. Editor hiển thị khung thiết kế cố định bằng SVG viewBox; tọa độ lưu theo đơn vị layout thống nhất, không lưu pixel viewport. Zoom/pan chỉ đổi cách nhìn. Kéo thả chuyển tọa độ con trỏ về hệ tọa độ layout trước khi cập nhật.
3. Organizer thêm sân khấu, vùng trống/lối đi, khu ghế, hàng ghế; công cụ tạo một hàng hoặc lưới ghế rồi chỉnh số ghế, khoảng cách, nhãn, di chuyển/xóa trong bản nháp. Có nhập tọa độ/số lượng bằng form để không phụ thuộc hoàn toàn vào chuột.
4. Chặn phần tử vượt bounds, ghế chồng ghế hoặc nằm trên sân khấu/vùng cấm, mã hàng/ghế trùng, tổng ghế vượt maxCapacity. Kiểm tra trên frontend để phản hồi nhanh và kiểm tra lại ở backend khi lưu/submit. Dữ liệu catalog quyết định giới hạn; canvas không cho người tổ chức tăng giới hạn đó.
5. Lưu layout bằng JSON có schema (hình học sân khấu/vùng trống) và các hàng ghế có ID ổn định, version optimistic lock. Server không nhận SVG/HTML/script tùy ý hoặc URL ngoài. Ghế bán được là hàng quan hệ, không chỉ nằm trong một ảnh hoặc JSON vô danh.
6. Preview ở chế độ khách để kiểm tra nhãn/hạng vé. Khi gửi duyệt, đóng băng bản layout; session-seat được sinh trong transaction cấu hình trước bán, unique theo session/seat. Kiểm tra capacity và số inventory thực tế khớp.
7. Khách chỉ xem sân khấu/khu/ghế và chọn SessionSeat; không tải khả năng chỉnh sửa hoặc ownership nội bộ. Availability lấy từ API, giữ ghế vẫn dùng khóa MySQL. Không lấy số ghế trống từ canvas làm bằng chứng đặt thành công.

Một bản frozen không bị PATCH/DELETE; nếu cần sửa khi event còn nháp thì tạo revision mới, gắn lại các session chưa có hold/booking rồi sinh lại inventory trong transaction. Không đổi inventory đang được giữ hoặc đã bán. Giới hạn venue được snapshot theo version; cập nhật catalog không âm thầm dịch chuyển ghế đã duyệt.

## 7. Ảnh hưởng dữ liệu và giới hạn bàn giao

DDL đã bổ sung Organization/membership, ExternalIdentity/OTP challenge, EventReview/ReasonNotice/Notification, SupportReport, SeatLayout, TicketType và CheckIn; đổi ownership Event từ User sang Organization, thêm tên attendee và mã vé. Chi tiết logic ở [08](08-database-design.md); hợp đồng API ở [09](09-api-design.md).

`database/schema.sql` hiện có 38 bảng; seed/query và ERD/SVG đã đồng bộ theo ADR-014 ngày 2026-09-13. [20](20-physical-sql-design.md) phân biệt ràng buộc DB với policy cần backend. 67 kiểm tra DB đã đạt trên MySQL 8.0.46; chưa có ứng dụng, validator editor hoặc form web chạy thực tế. DDL dùng cho database rỗng, không phải migration nâng cấp dữ liệu cũ.


## 8. Mẫu phiếu để dựng form Admin

| Trường | Nội dung mặc định / validation |
| --- | --- |
| Hồ sơ | reviewId/eventId, tên event/tổ chức, ngày gửi và hạn duyệt do server trả, chỉ đọc |
| Loại phiếu | Từ chối trong hạn / Giải thích hồ sơ hết hạn; server xác định theo review |
| Mã lý do | Danh mục hiển thị: hết hạn xử lý, thiếu thông tin, cấu hình không hợp lệ, khác; “khác” vẫn bắt buộc diễn giải |
| Lý do chi tiết | Textarea bắt buộc; Admin tự viết và kiểm tra, không cho gửi chỉ khoảng trắng |
| Hướng dẫn tiếp theo | Textarea để chỉ rõ cần bổ sung hoặc cách nộp hồ sơ mới; không tự cam kết duyệt |
| Người gửi / thời điểm | Backend ghi actor và DB time khi xác nhận gửi |
| Hành động | Lưu nháp → xem trước → xác nhận gửi; phiếu SENT chỉ đọc |

Khung xem trước: “Hồ sơ [reviewId] của [tổ chức] cho sự kiện [tên] đã [bị từ chối/hết hạn]. Lý do: [reasonText]. Hướng dẫn: [guidance]. Người xử lý: [Admin].” Giá trị trong ngoặc do form/server cung cấp và escape, không là HTML được Organizer/Admin chèn. Đây là mẫu đặc tả UI sẵn cho implementation, chưa có trang web thực thi.
