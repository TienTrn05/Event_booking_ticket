# 21. SQL và ranh giới transaction

Các đoạn bên dưới là **mẫu prepared SQL cho service**, ký hiệu `:name` cần driver/query builder bind. Không chạy nguyên tài liệu như batch SQL. Bước “kiểm tra” là nhánh bắt buộc ở service; không COMMIT nếu assertion thất bại. Không đặt nghiệp vụ vào stored procedure/trigger.

## 1. Giữ nhóm ghế

1. Schema/permission/quota theo chính sách đã chốt; sắp danh sách PK, bỏ trùng bằng lỗi validation.
2. BEGIN và claim idempotency record; trùng key thì so request hash/đọc tài nguyên cũ.
3. Khóa Event SHARE, EventSession SHARE; đọc lại cờ và quan hệ. Tạo hold trong transaction với expiry dự kiến, sau khi lấy ghế dùng giờ DB mới để cập nhật expiry chính thức.
4. Lặp từng ID tăng dần bằng query dưới; bất kỳ ghế thiếu/khác session/không AVAILABLE thì rollback toàn bộ. Hold quá hạn cần rollback rồi cleanup aggregate theo giao thức [11](11-booking-concurrency.md), không nâng ngược thứ tự khóa.

```sql
SELECT id, event_id, status, sale_opens_at, sale_closes_at
FROM event_sessions WHERE id = :session_id FOR SHARE;

SELECT id, session_id, status, hold_id, current_booking_id,
       hold_expires_at, price_minor, currency
FROM session_seats WHERE id = :session_seat_id FOR UPDATE;

SELECT UTC_TIMESTAMP(6) AS decision_time;
```

Service dùng decision_time đọc **sau lúc đã lấy đủ khóa** để kiểm tra hạn mở bán và tính expiry bằng TTL được duyệt. Ghi hold/item snapshot và cập nhật từng ghế:

```sql
UPDATE session_seats
SET status='HELD', hold_id=:hold_id, hold_expires_at=:expires_at,
    current_booking_id=NULL, version=version+1
WHERE id=:session_seat_id AND session_id=:session_id AND status='AVAILABLE';
```

Mỗi update phải affectedRows = 1, tổng số item đúng số ghế. Ghi kết quả idempotency cùng transaction → COMMIT. Chưa gọi payment hoặc email.

## 2. Checkout

Khóa theo thứ tự key → Event → Session → Hold → Booking nếu có → ghế; kiểm tra lại chủ, ACTIVE, expiry và toàn bộ ghế. INSERT Booking AWAITING_PAYMENT với total/currency/expiry từ hold đã khóa; INSERT BookingItem với session_id, snapshot giá/nhãn; gán current_booking_id vào ghế; Hold CONVERTED; lưu key → COMMIT. UQ hold_id và composite FK chặn tạo lặp/nhầm chủ, nhưng không thay kiểm tra expiry hoặc tính tổng.

## 3. Xác nhận payment

Xác minh provider, lưu inbox tối thiểu bền vững. Processor khóa inbox rồi các aggregate theo [11](11-booking-concurrency.md), kiểm tra payload/provider/currency/amount và giờ DB. Nhánh hợp lệ:

```sql
UPDATE payments SET status='SUCCESS'
WHERE id=:payment_id AND booking_id=:booking_id AND status='PENDING';

UPDATE bookings
SET status='CONFIRMED', confirmed_at=:decision_time,
    confirmed_payment_id=:payment_id
WHERE id=:booking_id AND status='AWAITING_PAYMENT'
  AND expires_at > :decision_time;

UPDATE session_seats
SET status='SOLD', hold_id=NULL, hold_expires_at=NULL, version=version+1
WHERE id=:session_seat_id AND status='HELD'
  AND hold_id=:hold_id AND current_booking_id=:booking_id;
```

Service kiểm tra số hàng từng bước, INSERT Ticket cho mỗi BookingItem với token/ciphertext do server tạo, ghi audit/outbox và inbox PROCESSED → COMMIT nguyên tử. Nếu callback lặp, đọc trạng thái đã áp dụng trước để trả kết quả, không yêu cầu UPDATE lần hai phải affectedRows=1.

Nhánh muộn: ghi nhận receipt SUCCESS, reconciliation REQUIRED, giữ booking EXPIRED/CANCELLED; không đổi ghế của đơn khác. Khi có khoản SUCCESS ngoài dự kiến, không overwrite `confirmed_payment_id`; tạo đối soát theo ADR-011. Không coi redirect frontend là bằng chứng tiền.

## 4. Hết hạn

Query ứng viên chỉ đọc `seat_holds(status,expires_at)` hoặc `bookings(status,expires_at)`. Mỗi aggregate vào transaction riêng, khóa cha/hold/booking/ghế rồi đọc giờ DB. Nếu trạng thái đã đổi hoặc chưa hết hạn: bỏ qua. Nếu hợp lệ: đổi hold ACTIVE → EXPIRED hoặc booking AWAITING_PAYMENT → EXPIRED; nhả **chỉ ghế HELD vẫn thuộc aggregate đó**, xóa cả hold/current_booking/expiry, tăng version. Giữ hold CONVERTED khi booking đã được tạo; lưu audit/outbox và commit.

Không chạy UPDATE toàn session dựa timestamp và không nhả SOLD. Callback và expiry dùng cùng thứ tự khóa nên một nhánh thắng rồi nhánh sau đọc lại kết quả.

## 5. Check-in và hoàn tiền

Check-in khóa đủ scope trước ticket; validate permission/event/session/window rồi:

```sql
UPDATE tickets
SET status='USED', checked_in_at=:decision_time, checked_in_by=:actor_id
WHERE id=:ticket_id AND status='VALID';
```

affectedRows=1 mới thành công, ghi audit cùng transaction. Refund approval dùng cùng lock order; chỉ policy vé chưa dùng được duyệt mới đổi vé VALID → CANCELLED và refund PROCESSING. Gọi hoàn tiền ngoài transaction bằng key ổn định. Callback hoàn thành đổi Refund SUCCESS, Payment REFUNDED và booking/vé tương ứng trong transaction mới. Compensation cho đơn EXPIRED/CANCELLED không chuyển đơn đó REFUNDED: booking chưa từng được xác nhận; trạng thái tiền nằm ở Payment/Refund.

## 6. Outbox và lease fencing

BEGIN → SELECT job có thể claim FOR UPDATE SKIP LOCKED (chỉ queue, không chọn ghế người dùng) → đặt PROCESSING, lease_until và token ngẫu nhiên mới → COMMIT → gọi adapter ngoài transaction. Sau kết quả:

```sql
UPDATE outbox_messages
SET status='DONE', lease_until=NULL, lease_token=NULL
WHERE id=:job_id AND status='PROCESSING' AND lease_token=:my_lease_token;
```

affectedRows=0 nghĩa đã mất ownership; không ack hoặc ghi đè retry của worker khác. Lease hết hạn có thể reclaim với token mới. Chưa có exactly-once qua mạng: provider/consumer vẫn phải dedupe bằng key ổn định.

## 7. Retry và lỗi

Mọi exception → rollback toàn transaction và trả connection trong finally. Deadlock/lock timeout retry toàn operation có giới hạn, cùng key; không retry lỗi nghiệp vụ và không giữ transaction khi chờ người dùng/mạng. Không trả thành công khi COMMIT chưa xác nhận; nếu mất kết nối tại COMMIT, coi kết quả chưa rõ và tra lại bằng key trước tạo mới.
