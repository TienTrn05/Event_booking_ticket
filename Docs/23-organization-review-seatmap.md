# 23. Tổ chức, duyệt sự kiện và công cụ thiết kế sơ đồ

Merchandise theo sự kiện và tên hiển thị nghệ sĩ/chương trình được bổ sung ở phần 10. Đây là đặc tả sản phẩm/UI, chưa phải chức năng BE/SQL đã triển khai.

**Cập nhật theo làm rõ của chủ dự án:** phần 9 bên dưới mở rộng nghiệp vụ thay đổi/mở bán lại, hủy sự kiện, feedback có sao và điểm uy tín tổ chức. Tăng sức chứa 200 → 300 chỉ là ví dụ, không phải định nghĩa duy nhất của “Vé bán lại”. Các mô tả SQL/ghế bên dưới phản ánh mô hình hiện có, chưa triển khai phần mở rộng này.

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

## 9. Thay đổi sự kiện, feedback và uy tín tổ chức

### 9.1. Phạm vi đã được chủ dự án xác nhận

Website đóng vai trò trung gian, cung cấp công cụ cho Organizer vận hành và xử lý các tình huống. Admin duyệt quyền/hồ sơ và xem thông tin uy tín để hỗ trợ quyết định, không quản lý thường nhật thay tổ chức.

- “Vé bán lại” không bị giới hạn vào tăng sức chứa. Ví dụ 200 → 300 chỉ minh họa một nguyên nhân mở bán tiếp; không đủ cơ sở để tự định nghĩa toàn bộ chính sách bằng ví dụ này hoặc suy ra marketplace vé cá nhân.
- Organizer có chức năng hủy sự kiện và xử lý tình huống liên quan. Các hành động ảnh hưởng người mua cần trạng thái, thông báo và lịch sử theo dõi, không chỉ một nút xóa sự kiện.
- Người dùng được feedback về hệ thống và về sự kiện/cách tổ chức bán vé, có đánh giá sao.
- Hệ thống có thuật toán tính điểm uy tín cho tài khoản tạo sự kiện, có tăng/giảm điểm. Vì Organizer là tổ chức, hồ sơ uy tín gắn với **Organization**, đồng thời lưu người đại diện thực hiện hành động. Thay người đại diện không làm mất lịch sử tổ chức.
- Admin xem điểm cùng bằng chứng/lịch sử để chấp nhận hoặc từ chối hồ sơ. Điểm không thay thế xác minh email công ty, duyệt tổ chức hoặc quyền quyết định của Admin.
- Không gian là khối do Organizer thiết kế và đề xuất sức chứa để Admin xét; không có sẵn ghế cố định như rạp phim. Ghế đánh số chỉ dùng khi bố trí yêu cầu.

### 9.2. Hồ sơ thay đổi và mở bán lại — thiết kế đề xuất

Dùng một luồng chung: Organizer chọn sự kiện/suất → nêu loại yêu cầu và lý do → mô tả thay đổi/ảnh hưởng tới người mua → gửi xét duyệt khi thay đổi cần duyệt → nhận quyết định → thực hiện đợt mở bán theo bản hợp lệ. Không hard-code duy nhất loại “tăng sức chứa”.

Các nguyên nhân có thể đưa ra để chốt chính sách: bổ sung sức chứa, mở đợt bán tiếp theo trong hạn mức đã duyệt, điều chỉnh cấu hình bán hoặc khôi phục bán sau tạm dừng. Đây là ví dụ đề xuất, không có nghĩa mọi nguyên nhân đã được phép tự động thực hiện. Mỗi loại phải xác định điều kiện, có cần duyệt lại không và cách ảnh hưởng tồn kho/vé/tiền. Luồng hủy sự kiện là hành động riêng, không tự biến vé hủy/hoàn thành vé được bán lại.

Form có loại yêu cầu, lý do chi tiết, bản trước/sau nếu có, các suất bị ảnh hưởng, vé đã bán/đang giữ, phương án xử lý người mua và tài liệu tham chiếu trong hệ thống. Admin xem hồ sơ kèm uy tín tổ chức; khi từ chối/duyệt có lý do và audit. Không thêm upload tài liệu thật khi chưa có chính sách upload.

**Ví dụ tăng sức chứa:** bản hiện hành 200, đề xuất 300, phần tăng tối đa 100 sau duyệt. Canvas lớn hơn không tự tạo tồn kho; venue có giới hạn cứng thì phải tuân thủ. Bản chờ duyệt không sửa vé đã bán hoặc hold còn hiệu lực; duyệt lặp không cộng lượng tăng nhiều lần. Khối không đánh số dùng khu/loại vé/số lượng, không tạo ghế giả. Đây là một test case trong luồng chung, không phải module độc lập.

### 9.3. Organizer hủy sự kiện — yêu cầu UI và đề xuất xử lý

Có hành động “Hủy sự kiện” với lý do, phạm vi sự kiện/suất, số đơn/vé bị ảnh hưởng, thông báo dự kiến cho khách, phương án xử lý và xác nhận rõ ràng. Không xóa lịch sử bán vé. Phân biệt hủy sự kiện đang vận hành với hồ sơ đăng sự kiện hết hạn duyệt.

Khi việc hủy có hiệu lực, đề xuất dừng bán mới và chặn admission; hiển thị vé/đơn bị ảnh hưởng cùng trạng thái xử lý. Phải xử lý cả hold đang có, thanh toán đang chờ và tiền đến muộn; không chỉ đổi nhãn trên trang sự kiện. Thông báo đã hủy không đồng nghĩa đã hoàn tiền. UI phân biệt “Chờ xử lý”, “Đang hoàn”, “Đã hoàn”, “Hoàn thất bại” theo dữ liệu thực.

Quyền Organizer chủ động xử lý đã được yêu cầu; việc hủy có cần Admin xác nhận, thời điểm có hiệu lực, hạn hoàn tiền, tự động hay thủ công và xử lý vé đã USED khi hủy một phần chưa được chốt. Không tự áp dụng điều kiện refund tự nguyện “chưa USED” cho mọi tình huống Organizer hủy sự kiện. Nền tảng trung gian vẫn phải theo dõi kết quả xử lý, không tự đánh dấu hoàn tất thay tổ chức.

### 9.4. Feedback có sao và quyền phản hồi

Tách rõ đối tượng:

| Đối tượng | Nội dung | Cách sử dụng |
| --- | --- | --- |
| Hệ thống | Trải nghiệm tìm kiếm, đặt vé, lỗi thao tác, khả năng sử dụng | Cải thiện nền tảng; không trực tiếp trừ điểm tổ chức vì lỗi nền tảng |
| Sự kiện/tổ chức | Cách bán vé, thông tin công bố, tổ chức sự kiện, cách xử lý thay đổi/hủy | Đầu vào đánh giá uy tín đúng Organization và sự kiện liên quan |

Form đề xuất gồm đối tượng feedback, sự kiện/đơn liên quan khi có, đánh giá **1–5 sao**, nội dung và xác nhận gửi. Thang 1–5 là đề xuất UI; user đã yêu cầu sao nhưng chưa chốt thang điểm. Không bắt người mua của sự kiện bị hủy phải có check-in mới được phản ánh.

Đề xuất chống thao túng: đăng nhập để gửi; feedback giao dịch liên kết đơn thuộc người gửi, có nhãn “Đã mua vé” khi xác thực; một đánh giá có hiệu lực/người/sự kiện/nhóm nội dung, sửa có lịch sử; không nhân trọng số vì mua nhiều vé hay đăng nhập nhiều thiết bị. Feedback không có giao dịch vẫn có kênh gửi phù hợp, nhưng không tự có trọng số như giao dịch xác thực. Quyền gửi, thời điểm và giới hạn chính xác cần chốt trước code.

Organizer có thể phản hồi hoặc báo cáo đánh giá sai; không tự xóa đánh giá xấu. Đề xuất trạng thái chờ kiểm tra/công khai/ẩn có lý do, lịch sử kiểm duyệt và khiếu nại. Đánh giá thấp không tự đồng nghĩa vi phạm; report chưa xác minh không tự trừ điểm. Xử lý nội dung spam/xúc phạm độc lập với việc ý kiến tích cực hay tiêu cực. Không công khai mã vé, thông tin liên hệ hoặc dữ liệu đơn của người đánh giá.

### 9.5. Điểm uy tín — thuật toán đề xuất để duyệt

Tách **sao người dùng** và **điểm uy tín nội bộ**. Admin xem cả hai cùng số lượng mẫu, không coi 5 sao từ một người tương đương 5 sao từ hàng trăm giao dịch. Chưa chốt công khai điểm nội bộ cho khách.

Đề xuất sao hiệu chỉnh với prior để giảm tác động mẫu nhỏ:

```text
R = (sum(w_i * stars_i) + m * C) / (sum(w_i) + m)
F = 100 * (R - 1) / 4
S = clamp(a * F + (1 - a) * O + B - P, 0, 100)
```

- `stars_i`: sao 1–5 của feedback hợp lệ về tổ chức/sự kiện; `w_i` là trọng số xác thực. Không dùng feedback hệ thống vào `F`.
- `C`: prior sao tham chiếu được quản trị chính sách; `m`: cỡ mẫu prior. `F` là thành phần phản hồi quy đổi về 0–100.
- `O`: điểm vận hành 0–100 từ các sự kiện/hồ sơ đã có kết quả xác minh; `a` cân bằng feedback và vận hành.
- `B/P`: các khoản cộng/trừ được quy định, có nguồn và lý do. Một sự cố không bị tính lại cả trong `O` và `P`; chính sách phải chỉ rõ thành phần sở hữu từng tín hiệu.
- Tổ chức mới/không đủ dữ liệu hiển thị **“Chưa đủ dữ liệu”**, không mặc định 0 điểm/xấu hoặc uy tín cao. Điểm prior tính nội bộ nếu có không thay nhãn này.

Đây là công thức để thảo luận, **chưa có hệ số, ngưỡng hay mức phạt được duyệt**. Bảng chính sách cần chốt:

| Tín hiệu | Hướng tác động đề xuất | Điều kiện |
| --- | --- | --- |
| Feedback xác thực | Sao cao/thấp làm tăng/giảm thành phần `F` | Loại trừ spam và feedback sai đối tượng theo kiểm duyệt có lý do |
| Hoàn thành tổ chức/xử lý đúng cam kết | Tăng điểm vận hành hoặc khoản cộng | Có kết quả xác minh; không cộng chỉ vì tự khai hoàn thành |
| Hủy sự kiện | Xét nguyên nhân, tần suất và cách giải quyết | Không mặc định mọi lần hủy đều cùng mức phạt; không ngăn hủy cần thiết bằng hình phạt tự động |
| Khiếu nại được xác minh, không thực hiện phương án đã cam kết | Giảm theo mức độ đã xác định | Có kết luận và căn cứ; số lượng report thô không phải kết luận |
| Khắc phục được xác nhận/khiếu nại được chấp nhận | Phục hồi hoặc đảo khoản điểm liên quan | Liên kết điều chỉnh với bút toán gốc, không xóa lịch sử |

Mỗi lần tính/điều chỉnh cần nguồn sự kiện, Organization, thời điểm, phiên bản thuật toán, điểm trước/sau và lý do. Chống xử lý lặp để không cộng/trừ nhiều lần cho cùng một nguồn. Feedback được sửa/ẩn/khôi phục phải tính lại đóng góp một cách nhất quán. Đề xuất cơ chế decay hoặc cửa sổ thời gian chỉ sau khi chốt, không tự cho điểm phạt biến mất.

Màn Admin hiển thị điểm, số sao/số đánh giá, độ đầy đủ dữ liệu, lịch sử sự kiện và hủy, tình trạng xử lý khách, lý do biến động và vấn đề chưa kết luận. Khi duyệt, lưu snapshot điểm/bằng chứng tại thời điểm quyết định; điểm đổi sau đó không sửa lịch sử xét duyệt. Không tự approve, tự khóa đăng sự kiện hoặc đặt ngưỡng loại hồ sơ khi chưa có chính sách; Admin đưa ra quyết định có lý do.

### 9.6. Giới hạn triển khai và quyết định còn mở

Chức năng đã yêu cầu: hồ sơ linh hoạt cho tình huống bán lại/thay đổi, Organizer hủy sự kiện, feedback có sao cho hai đối tượng, điểm uy tín tổ chức hỗ trợ Admin. Cần chốt ma trận lý do/duyệt lại, hạn xử lý thay đổi, chính sách hủy/tiền, điều kiện feedback/kiểm duyệt, hệ số và ngưỡng điểm, mức công khai/khiếu nại. Không hỏi lại nhu cầu có các chức năng này.

SQL/API/ứng dụng chưa hỗ trợ đầy đủ các phần mới. Trước triển khai cần đồng bộ revision/đợt bán, tồn kho theo khối, workflow hủy, feedback/rating, lịch sử điểm và audit; kiểm thử chống vượt tồn kho, thao tác lặp, sửa đánh giá, tính trùng điểm và bảo toàn đơn/vé. Không coi bản thiết kế UI là tính năng đã hoạt động.

## 10. Merchandise theo sự kiện và tên hiển thị

### 10.1. Yêu cầu đã xác nhận

Sự kiện có thể bán thêm merchandise ngay trên nền tảng. Merchandise thuộc sự kiện, do Organization sở hữu sự kiện tạo và quản lý; không tự mở marketplace cho người bán ngoài sự kiện.

Ví dụ của chủ dự án: công ty chủ quản xác minh bằng email công ty, tạo sự kiện **Fanmeeting PMC**; tag nổi bật với khách là **PMC** thay vì tên công ty. Đây là ví dụ về tên hiển thị, không giới hạn merchandise vào fanmeeting hoặc âm nhạc.

| Khái niệm | Ví dụ minh họa | Vai trò |
| --- | --- | --- |
| Organization | Công ty chủ quản (tên giả) | Chủ sở hữu, quyền quản lý, hồ sơ duyệt, uy tín và xử lý đơn/report |
| Tên sự kiện | Fanmeeting PMC | Tên trang sự kiện và ngữ cảnh mua vé/hàng hóa |
| Tag/tên hiển thị | PMC | Nhận diện nghệ sĩ/chương trình ở card, header và gian hàng sự kiện |
| Danh mục | Nhạc sống hoặc danh mục phù hợp do Organizer chọn | Phân loại catalog; không thay danh mục bằng PMC |

Tag PMC không tạo tài khoản Organizer mới, không thay email công ty, không chuyển quyền sở hữu sang nghệ sĩ và không xóa tên đơn vị tổ chức khỏi phần thông tin tổ chức/đơn hàng. Điểm uy tín vẫn thuộc Organization; đổi tag không làm mới lịch sử. Không tự gắn nhãn “chính thức/đã xác minh nghệ sĩ” chỉ vì đã xác minh email công ty.

### 10.2. Trải nghiệm khách và Organizer

Trang sự kiện có khu **Merchandise** cùng nhận diện PMC, danh sách sản phẩm và liên kết chi tiết. Ví dụ minh họa có thể là áo, túi hoặc vật phẩm sự kiện; không mặc định mọi sản phẩm đều có size/màu.

Thiết kế đề xuất cho sản phẩm: tên, hình minh họa, mô tả, giá, biến thể nếu có, số lượng, trạng thái còn/hết hàng và thông tin cách nhận hàng theo chính sách được chốt. Chọn biến thể phải làm rõ giá/tồn kho tương ứng. Không tự bật preorder, hàng số, hàng cá nhân hóa, combo giảm giá hoặc phí giao hàng.

Organizer có tab quản lý Merchandise trong đúng sự kiện: danh sách, tạo/sửa sản phẩm, biến thể, giá, tồn kho, trạng thái bán và theo dõi đơn/giao nhận. Nhãn trạng thái và dữ liệu mẫu phục vụ thiết kế, chưa phải enum/schema đã triển khai. Sửa sản phẩm không đổi tên/giá/biến thể đã chụp vào đơn cũ; ngừng bán không xóa lịch sử mua.

Admin giữ vai trò xét duyệt và hỗ trợ theo scope. Chưa chốt merchandise được duyệt cùng hồ sơ sự kiện hay có hồ sơ riêng; không tự thêm nhiệm vụ Admin quản lý giá, kho hoặc giao hàng thường xuyên. Các thay đổi tên hiển thị/nội dung đang công khai phải tuân thủ chính sách duyệt nội dung, không dùng tag để vượt quy trình hiện hành.

### 10.3. Ranh giới vé, hàng hóa và tồn kho

**Chốt bổ sung của chủ dự án:** website hỗ trợ thanh toán hàng hóa và giao tới **địa chỉ người nhận**. Organizer chọn điều kiện mua: **được mua độc lập, không cần vé**, hoặc **phải có vé**. Điều kiện phải hiện trước khi khách bắt đầu thanh toán, không chỉ báo lỗi ở bước cuối. Không coi mua hàng độc lập là guest checkout: theo chính sách tài khoản hiện hành, khách đăng nhập để thanh toán và quản lý đơn.

Luồng UI gồm sản phẩm/biến thể/số lượng → kiểm tra điều kiện mua → thông tin người nhận và địa chỉ giao → xem lại hàng, tiền hàng và phí giao theo dữ liệu hợp lệ → thanh toán trên web → theo dõi đơn/giao hàng. Form nhận hàng có tên người nhận, thông tin liên hệ và địa chỉ theo vùng phục vụ; không lấy tên người tham dự vé thay cho người nhận hàng. Dữ liệu địa chỉ chỉ dùng trong phạm vi xử lý đơn, không công khai trên feedback.

Organizer có cấu hình điều kiện vé và chỉ dẫn rõ cho khách. Đề xuất điều kiện yêu cầu vé được kiểm tra ở server với vé thuộc người mua và sự kiện liên quan; không nhận mã vé bất kỳ làm bằng chứng. Cấp cấu hình theo sự kiện hay từng sản phẩm, vé hợp lệ ở trạng thái nào, một vé mua được bao nhiêu hàng, có chấp nhận vé đang mua cùng checkout và việc vé bị hoàn sau khi hàng đã giao cần chốt trước code. Không tự áp dụng điều kiện có vé cho mọi sự kiện.

Theo dõi riêng trạng thái tiền và trạng thái giao: chờ thanh toán, đã thanh toán/đang xử lý tiền; chờ xử lý hàng, đang giao, đã giao, giao thất bại (nhãn UX đề xuất). Chưa chọn hãng vận chuyển hoặc tích hợp tracking; không hứa cập nhật vận chuyển tự động nếu chưa có nguồn. Đơn vị bán hoặc hệ thống tích hợp chỉ cập nhật theo quyền và dữ liệu thực. Phí chưa xác định không được hiển thị thành 0 hoặc miễn phí; trước thu tiền phải có tổng tiền được xác nhận.

Merchandise không phải TicketType hoặc ghế. Tồn kho hàng hóa tách khỏi sức chứa sự kiện; khi có biến thể thì theo biến thể. Mua áo không chiếm suất tham dự và không cấp quyền vào cửa. Mã nhận hàng nếu sử dụng phải tách khỏi credential check-in/admission; đã nhận hàng không đồng nghĩa đã vào sự kiện.

Đề xuất lưu dòng hàng với snapshot sản phẩm, biến thể, giá, số lượng và đơn vị bán. Theo dõi thanh toán và giao/nhận hàng riêng: đã trả tiền chưa có nghĩa đã nhận đủ hàng. Cần chống bán vượt tồn kho và xử lý lặp khi thanh toán/ghi nhận nhận hàng. Không tự áp dụng hold 5 phút hoặc giới hạn 6 vé cho hàng hóa; thời gian giữ kho và giới hạn mua merchandise chưa chốt.

Nếu mua vé kèm hàng trong một lần checkout, phải chốt nguyên tắc khi một phần hết chỗ/hết hàng hoặc thanh toán chưa rõ kết quả. Không tự báo cả đơn thành công hoặc tự bỏ hàng khỏi đơn. Chưa quyết định giỏ hàng chung hay đơn tách, không tự cho phép giỏ nhiều sự kiện/tổ chức.

### 10.4. Hủy, feedback và quyết định còn mở

Hủy sự kiện không tự xác định cách xử lý hàng đã giao/chưa giao. UI cần hiển thị từng phần vé/merchandise và tình trạng giải quyết tương ứng; không áp dụng chính sách full refund vé một cách máy móc cho đơn hàng hỗn hợp.

Đề xuất mở rộng feedback về tổ chức với đối tượng **đơn merchandise**, phân biệt chất lượng hàng/giao nhận với trải nghiệm website và tổ chức sự kiện. Đây là đề xuất phân loại thêm; trọng số vào điểm uy tín chưa chốt. Không tính cùng một phản ánh nhiều lần qua cả đơn vé, đơn hàng và report.

Đã chốt: thanh toán trên web, giao tới địa chỉ người nhận; Organizer cấu hình cho mua độc lập hoặc yêu cầu có vé. Không dựng nhận tại quầy làm luồng mặc định. Cần chốt phạm vi giao, phí/đơn vị vận chuyển, thời gian bán/giao, giữ kho/hạn mức, đổi trả/hoàn khi hủy, checkout chung/tách, chi tiết xác minh vé và phạm vi duyệt sản phẩm/ảnh. Luồng thiết kế phải hoàn chỉnh tới địa chỉ, thanh toán và theo dõi giao hàng; chỉ đánh dấu các chính sách thực sự còn mở.

SQL/API hiện tại chưa có đầy đủ catalog hàng hóa/biến thể/tồn kho/đơn hàng/giao nhận và dữ liệu nhận diện hiển thị. Khi triển khai phải đồng bộ hợp đồng dữ liệu, quyền theo tổ chức/sự kiện, thanh toán, hoàn tiền, report và audit; không dùng bảng vé để giả lập merchandise.
