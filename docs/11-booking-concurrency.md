# 11. Giữ ghế, transaction và xử lý đồng thời

Đây là giao thức bắt buộc cho FR-013–FR-023, BR-001–BR-019, NFR-001–NFR-003. Mục tiêu là một nguồn tồn kho có thẩm quyền, không giữ khóa xuyên thời gian thao tác của khách.

## Lựa chọn MySQL

Tạo sẵn SessionSeat cho mọi ghế trước mở bán; UQ `(session_id,seat_id)`. MVP dùng pessimistic locking trên các hàng này trong InnoDB. `SELECT ... FOR UPDATE` chỉ có ý nghĩa giữ khóa cho chuỗi thao tác khi được dùng trong transaction; khóa được giải phóng khi commit/rollback. Tham khảo [MySQL — Locking Reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html).

Đề xuất isolation `READ COMMITTED` cho transaction đặt vé để hạn chế phạm vi khóa; mọi quyết định ghi phải đọc locking/current read, không dựa SELECT snapshot trước đó. `REPEATABLE READ` mặc định của InnoDB cũng có thể đúng với giao thức này nhưng cần hiểu next-key/gap locks; `SERIALIZABLE` tăng tranh chấp không cần thiết. Cấu hình isolation phải kiểm thử trên phiên bản DB đã chọn Q-016; không thay isolation toàn hệ thống mà thiếu đánh giá.

UQ là bảo vệ cấu trúc, không tự ngăn hai service cùng bán nếu bỏ qua kiểm tra dưới khóa. Optimistic locking dùng `version` và conditional UPDATE là lựa chọn tốt cho sửa nội dung; giữ nhiều ghế nóng bằng optimistic locking thường cần retry/rollback nhiều hơn. Không dùng mutex process vì nhiều instance không chia sẻ nó; Redis/realtime chưa cần cho tính đúng.

## Thứ tự khóa thống nhất

Mọi mutation tồn kho/tiền/vé tuân theo:

1. IdempotencyRecord hoặc PaymentWebhook của chính request nếu có; xử lý cùng key trước tài nguyên nghiệp vụ.
2. Với phân bổ ghế: khóa ReservationQuota(customer_id,session_id) FOR UPDATE trước Event trên hold/checkout/release/expiry/cancel/confirm; pre-read tìm đúng chủ và verify lại. Tiếp theo khóa Organization/membership/report cần thiết trước Event, không lấy ngược sau ghế. Block Organization chỉ cập nhật Organization trước commit; hậu xử lý booking chạy transaction riêng.
3. Event theo ID, `FOR SHARE` cho hold/checkout/payment/check-in/refund; `FOR UPDATE` cho publish/cancel/block và thay cấu trúc.
4. EventSession theo ID, SHARE cho thao tác thông thường, UPDATE khi đổi cấu hình/trạng thái.
5. SeatHold theo ID tăng dần, rồi Booking theo ID tăng dần, `FOR UPDATE` nếu có.
6. SessionSeat theo PK tăng dần, `FOR UPDATE`, toàn bộ nhóm cần thay đổi.
7. Payment → Refund → Ticket → CheckIn theo ID tăng dần; audit/outbox ghi cuối.

Pre-read không khóa chỉ để tìm ID và danh sách cần khóa; sau khi lấy khóa phải tải lại, xác minh quan hệ/phiên bản. Không tin pre-read để quyết định ghế trống. Không nâng SHARE thành UPDATE giữa transaction; biết trước loại thao tác để lấy khóa thích hợp. Đọc permission/user trước giao thức nghiệp vụ, không lấy khóa user ngược thứ tự ở giữa transaction. Quota Q-002 đã chốt: tạo/lấy hàng ReservationQuota bằng PK unique rồi khóa trước Event; đếm ACTIVE hold và CONVERTED/AWAITING_PAYMENT còn hạn dưới khóa. Mọi đường thay đổi tập này tuân thủ thứ tự, kể cả callback/worker, không khóa User giữa transaction.

SHARE trên event/session cho phép nhiều giao dịch các ghế khác nhau chạy đồng thời, còn block/cancel phải đợi giao dịch đang chạy rồi chặn giao dịch mới. Thay venue/seat map phải khóa event/session chịu ảnh hưởng theo thứ tự hoặc chỉ cho sửa cấu trúc chưa tham chiếu. Không chỉ dựa cờ trạng thái đọc trước transaction.

## A và B cùng giữ ghế A1

1. Cả A/B validate ngoài transaction; server resolve A1 về SessionSeat.id.
2. A: **BEGIN**, claim idempotency key, khóa quota của A và scope Organization theo giao thức, khóa event/session SHARE, kiểm tra đang bán. Tạo hold mới chưa commit; khóa hàng A1 bằng FOR UPDATE.
3. B: **BEGIN**, khóa quota của B và scope theo giao thức, khóa event/session SHARE, đợi cùng hàng A1.
4. A đọc lại A1 AVAILABLE, lưu hold/item snapshot giá, cập nhật HELD/chủ hold/expiry, ghi kết quả key; **COMMIT**.
5. B lấy được khóa, đọc thấy HELD còn hạn → **ROLLBACK**, trả 409 `SEAT_UNAVAILABLE`.

Nếu A rollback, B có thể giữ ghế. Không bao giờ SELECT thấy trống rồi UPDATE ngoài transaction. Với nhiều ghế, khóa tuần tự theo PK và kiểm tra toàn bộ trước cập nhật; bất kỳ ghế lỗi đều rollback toàn nhóm. Truy vấn IN có ORDER BY không được coi là bằng chứng engine luôn lấy khóa đúng thứ tự; triển khai query theo PK tuần tự hoặc kiểm chứng execution plan/lock order.

## Giữ ghế đã hết hạn

Không khóa ghế trước rồi quay ngược khóa hold của người khác. Khi phát hiện ghế thuộc hold quá hạn trong transaction giữ mới: rollback; gọi tác vụ hết hạn của hold/booking đó bằng giao thức bên dưới; sau commit thử lại yêu cầu giữ mới có giới hạn. Nếu chủ phân bổ đã đổi khi retry, tải lại và kiểm tra lại. Job chậm không làm ghế mất mãi; request có thể chủ động kích hoạt cleanup rồi retry.

Expiry lấy giờ DB sau khi lấy đủ khóa, dùng một giá trị NOW cho quyết định của transaction; không lấy timestamp từ lúc request bắt đầu rồi dùng sau khi chờ khóa lâu. Hold TTL bắt đầu khi cấp giữ thành công; deadline phản hồi là deadline lưu DB.

## Checkout từ hold

Validate → **BEGIN** → key → quota/scope theo giao thức → event/session → hold → các ghế → kiểm tra ACTIVE, đúng chủ, chưa hết hạn, mỗi ghế vẫn HELD bởi hold đó → tạo Booking AWAITING_PAYMENT, BookingItem snapshot → gán current_booking_id vào ghế, Hold CONVERTED → lưu kết quả key → **COMMIT**.

Deadline booking bằng hold expiry, không cộng thêm thời gian (Q-001). UQ Booking.hold_id bảo vệ chuyển một lần. Nếu hold đã CONVERTED, tra booking cùng chủ và so toàn bộ payload/attendee snapshot; giống mới trả đơn cũ, khác tên/tập ghế trả 409. Không phát vé hoặc gọi payment gateway trong transaction này.

## Payment preparation và kết quả

**Chuẩn bị:** BEGIN → key và các aggregate theo giao thức → kiểm tra booking còn hạn, ghế vẫn thuộc đơn, không có attempt PENDING → tạo Payment PENDING với amount từ booking và provider_key ổn định → outbox yêu cầu gửi nếu cần → COMMIT. Sau đó adapter mới gọi mạng. Timeout chưa rõ giữ PENDING; worker tra cứu/tiếp tục bằng cùng provider key.

**Nhận kết quả:** xác minh chữ ký/cấu trúc ngoài transaction; lưu inbox bền vững bằng unique provider event ID. Processor BEGIN và khóa inbox trước, sau đó event/session/hold/booking/ghế/payment/vé theo thứ tự; kiểm tra amount/currency/reference và trạng thái hiện tại.

- Nếu SUCCESS hợp lệ, đơn AWAITING_PAYMENT, `DB_NOW < expires_at`, event/session cho bán và mọi ghế còn thuộc đơn: ghi Payment SUCCESS, ghế SOLD (xóa hold pointer/expiry), Booking CONFIRMED với confirmed_payment_id của khoản đó, mỗi item một Ticket VALID, audit/outbox; đánh dấu inbox xử lý; **COMMIT**.
- Nếu cùng SUCCESS đã áp dụng: không phát lại vé; đánh dấu callback đã xử lý và commit.
- Nếu thất bại chắc chắn: cập nhật Payment FAILED; booking còn hạn được thử mới. Hết hạn thì chạy expiry theo cùng giao thức.
- Nếu SUCCESS muộn/đơn đã hủy/event bị dừng/không còn ghế: ghi nhận Payment SUCCESS và reconciliation REQUIRED; chuyển đơn chưa kết thúc sang EXPIRED hoặc CANCELLED thích hợp, nhả chỉ những ghế còn thuộc nó; tạo tác vụ đối soát/COMPENSATION; không tạo vé, không hồi sinh đơn. Tự refund cần Q-004, tiền được theo dõi dù chưa tự hoàn.
- Nếu DB lỗi bất kỳ bước: **ROLLBACK** tất cả thay đổi nghiệp vụ; inbox chưa DONE và sẽ retry. Nếu ghi inbox ban đầu cũng thất bại, trả lỗi để provider gửi lại.

Callback một event ID nhưng payload hash khác: cảnh báo, cách ly; không coi là retry bình thường. Callback không có reference đủ tin cậy hoặc trạng thái mâu thuẫn phải đối soát; không “sửa” tiền dựa vào frontend.

Inbox phải lưu normalized payload đã lọc đủ để xử lý lại sau crash, không chỉ hash. Receipt thành công ngoài dự kiến vẫn được lưu để đối soát; không đổi confirmed_payment_id đã chọn, không phát vé thêm (ADR-011). Outbox claim/reclaim có lease token và ack theo token để worker cũ không ghi đè lease mới; xem [21](21-sql-transactions.md).

## Hết hạn, hủy và race với callback

Worker chọn ID ACTIVE hold hoặc AWAITING_PAYMENT booking có expiry <= giờ DB bằng index; đây chỉ là tập ứng viên. Mỗi nhóm xử lý một transaction: BEGIN → quota/scope theo giao thức → event/session SHARE → hold → booking nếu có → toàn bộ ghế → kiểm tra lại expiry/trạng thái/ownership → đổi hold ACTIVE thành EXPIRED hoặc booking thành EXPIRED → nhả các ghế HELD vẫn mang hold/booking tương ứng → audit/outbox → COMMIT.

Hold CONVERTED không đổi thành EXPIRED; expiry thuộc Booking. Worker giữ hold record để phối hợp khóa nhưng không xử lý riêng như ACTIVE hold. Hủy booking chưa xác nhận dùng cùng thứ tự và kiểm tra lại trước nhả. Không dùng UPDATE ghế hàng loạt chỉ dựa expiry mà bỏ qua aggregate.

Callback thắng khóa và kiểm tra trước deadline: commit CONFIRMED; job đến sau thấy đơn đã xác nhận, không nhả SOLD. Job thắng và hết hạn: nhả; callback đến sau đi vào đối soát. Callback chờ khóa qua deadline phải đọc giờ DB lại và không xác nhận. Mốc phân xử là kiểm tra dưới khóa, không phải thời gian trình duyệt bấm trả tiền (Q-001).

## Refund, check-in và hủy sự kiện

Refund approval và check-in dùng cùng khóa event/session/hold/booking/ghế/payment/refund/ticket phù hợp. Ở đây check-in vào cửa (admission) đổi VALID → USED sau khi có CheckIn; self check-in/quầy chỉ insert CheckIn, không USED; refund policy đề xuất chỉ chấp nhận vé chưa USED. Nếu refund thắng, vé thành CANCELLED trước gọi hoàn tiền ngoài transaction; check-in sau bị từ chối. Nếu check-in thắng, refund bị từ chối theo policy. Kết quả refund SUCCESS cập nhật tiền/đơn/vé cùng transaction; ghế vẫn SOLD nếu chưa chốt bán lại Q-004.

Block/cancel lấy Event UPDATE trước, đổi trạng thái và outbox rồi commit ngắn; các giao dịch mới kiểm tra cờ ngay. Worker hậu xử lý từng booking theo giao thức, không khóa tất cả đơn trong một transaction dài. Check-in luôn kiểm tra cờ event/session nên vé cũ không tiếp tục được sử dụng trong thời gian chờ xử lý nếu trạng thái cấm vào cửa theo Q-010.

## Deadlock, timeout và vận hành

Deadlock vẫn có thể xuất hiện dù thứ tự nhất quán do FK/index. Bắt lỗi deadlock/lock timeout, rollback toàn transaction, retry toàn operation với cùng idempotency key và jitter. Đề xuất tối đa 3 lần, giới hạn tổng thời gian; không retry lỗi nghiệp vụ. Không giả định MySQL luôn rollback toàn transaction khi chỉ có statement timeout.

Không dùng SKIP LOCKED để chọn ghế người dùng đã yêu cầu vì có thể giữ thiếu nhóm. Có thể dùng cho claim hàng outbox độc lập với lease và giao thức riêng. Giữ transaction ngắn, không gửi email/gọi mạng/render QR bên trong. Metric cần có lock wait, deadlock, retry count, hold expired backlog, payment reconciliation age; bài kiểm thử bắt buộc ở [13](13-testing-strategy.md).


## Review expiry, layout và self check-in

Giao thức bổ sung theo [23](23-organization-review-seatmap.md): idempotency → Organization/membership/report cần thiết → Event → EventSession → EventReview/ReasonNotice theo ID. Approve và job expiry khóa Event/Review cùng thứ tự rồi đọc giờ DB. DB_NOW >= review.expires_at không approve; expiry ghi EXPIRED/Event REJECTED, notification hủy hồ sơ + draft phiếu/outbox nguyên tử. Worker quét chỉ lấy ứng viên, request approve cũng enforce hạn dù worker chậm. Mạng/email ngoài transaction, reason notice send dedupe riêng.

Editor và submit kiểm tra scope/config dưới khóa trước freeze/approve. Venue catalog updates dùng phiên bản; không sửa snapshot layout frozen. Khi lấy nhiều Organization/Venue/Event/session giữ thứ tự ID thống nhất; mutation catalog không quay ngược khóa event của mọi tổ chức. Session không đổi layout sau phân bổ.

Online và quầy cùng ticket: khóa event/session/hold/booking/ghế/payment/ticket theo giao thức rồi UQ CheckIn.ticket_id; chỉ một record xác nhận. Refund approval khóa cùng ticket trước vô hiệu; tự check-in không làm mất quyền refund của vé còn VALID. Admission kiểm tra CheckIn tồn tại và trạng thái ticket dưới khóa; refund thắng thì không USED, admission thắng thì refund chưa dùng bị từ chối. Không dùng timestamp check-in online để thay deadline booking hoặc payment.
