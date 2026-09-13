# 21. SQL và ranh giới transaction

**Phiên bản:** mẫu dùng DDL 38 bảng theo ADR-014. Service vẫn phải kiểm tra scope/quota theo 11 và policy theo 23; DDL không tự thực thi các bước kiểm tra bằng văn bản.

Các đoạn bên dưới là **mẫu prepared SQL cho service**, ký hiệu `:name` cần driver/query builder bind. Không chạy nguyên tài liệu như batch SQL. Bước “kiểm tra” là nhánh bắt buộc ở service; không COMMIT nếu assertion thất bại. Không đặt nghiệp vụ vào stored procedure/trigger.

## 1. Giữ nhóm ghế

1. Schema/permission/quota theo chính sách đã chốt; sắp danh sách PK, bỏ trùng bằng lỗi validation.
2. BEGIN và claim idempotency record; trùng key thì so request hash/đọc tài nguyên cũ sau kiểm tra quyền. Hash gồm route target và payload chuẩn hóa theo [09](09-api-design.md), không chỉ body. Khác target/payload với cùng actor/operation/key trả 409, không thực hiện mutation mới.
3. Tạo/khóa ReservationQuota(customer_id,session_id) trước Event, đếm hold ACTIVE và booking AWAITING_PAYMENT để chặn phân bổ thứ hai và giới hạn 6 ghế. Khóa Event SHARE, EventSession SHARE; đọc lại cờ và quan hệ. Tạo hold trong transaction với expiry dự kiến, sau khi lấy ghế dùng giờ DB mới để cập nhật expiry chính thức.
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

Khóa theo thứ tự key → ReservationQuota → Event → Session → Hold → Booking nếu có → ghế; kiểm tra lại chủ, ACTIVE, expiry và toàn bộ ghế. INSERT Booking AWAITING_PAYMENT với event_id/session_id đúng route và total/currency/expiry từ hold đã khóa; INSERT BookingItem với session_id, attendee_name_snapshot, ticket_type_code_snapshot, ticket_type_name_snapshot và snapshot giá/nhãn; gán current_booking_id vào ghế; Hold CONVERTED; lưu key → COMMIT. UQ hold_id và composite FK chặn tạo lặp/nhầm chủ, nhưng không thay kiểm tra expiry hoặc tính tổng.

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

Query ứng viên chỉ đọc `seat_holds(status,expires_at)` hoặc `bookings(status,expires_at)`. Mỗi aggregate vào transaction riêng, khóa quota trước cha/hold/booking/ghế rồi đọc giờ DB. Nếu trạng thái đã đổi hoặc chưa hết hạn: bỏ qua. Nếu hợp lệ: đổi hold ACTIVE → EXPIRED hoặc booking AWAITING_PAYMENT → EXPIRED; nhả **chỉ ghế HELD vẫn thuộc aggregate đó**, xóa cả hold/current_booking/expiry, tăng version. Giữ hold CONVERTED khi booking đã được tạo; lưu audit/outbox và commit.

Không chạy UPDATE toàn session dựa timestamp và không nhả SOLD. Callback và expiry dùng cùng thứ tự khóa nên một nhánh thắng rồi nhánh sau đọc lại kết quả.

## 5. Vào cửa (admission) và hoàn tiền

Admission khóa đủ scope trước ticket; validate Organization/permission/event/session/window và CheckIn đã có rồi (quầy cần phiên công ty/membership, không chỉ role):

```sql
UPDATE tickets
SET status='USED', admission_check_in_id=:check_in_id,
    admitted_at=:decision_time, admitted_by=:actor_id
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


## 8. Các yêu cầu xuyên suốt model hiện hành

- Checkout insert attendee snapshot đúng từng ghế; UQ hold không cho cập nhật tên bằng replay payload khác.
- Self/counter check-in INSERT CheckIn dưới khóa ticket, UQ ticket_id; không UPDATE USED. Admission mới consume vé.
- Hold/checkout/release/expiry/cancel/confirm lấy ReservationQuota trước Event theo 11, tính cả booking chờ để chống né quota.
- Event submission/review/expiry/phiếu lý do theo 23; notification/outbox cùng transaction, không gọi mạng trong khóa.
- Google/OTP consume challenge hoặc exchange proof rồi tạo app session; không có transaction password-reset.

## 9. Khóa quota và check-in trước sự kiện

Sau idempotency record, khóa hàng quota trước Event. Cùng protocol áp dụng cho hold/checkout/release/expiry/cancel/confirm; truy vấn đếm allocation hiện hành thực hiện sau khi đã khóa quota. Upsert chỉ đảm bảo hàng khóa tồn tại, không thay đếm quota.

```sql
INSERT INTO reservation_quotas (customer_id,session_id)
VALUES (:customer_id,:session_id)
ON DUPLICATE KEY UPDATE customer_id=reservation_quotas.customer_id;
SELECT customer_id,session_id FROM reservation_quotas
WHERE customer_id=:customer_id AND session_id=:session_id FOR UPDATE;
```

Check-in: xác thực chủ vé hoặc đại diện quầy, khóa scope theo 11 rồi Ticket, đọc giờ DB mới. Kiểm tra VALID, tên khớp attendee snapshot, mã hệ thống qua hash lookup; online phải thuộc `[starts_at-24h,starts_at)`, quầy theo counter window. Insert sau validation:

```sql
INSERT INTO check_ins (ticket_id,method,actor_id,checked_in_at)
VALUES (:ticket_id,:method,:actor_id,:decision_time);
```

UQ ticket_id chặn trùng; replay hợp lệ trả CheckIn đã có sau kiểm tra scope. Ticket vẫn VALID; ghi audit và kết quả idempotency cùng transaction. Admission ở mục 5 mới đổi USED; composite FK đảm bảo check_in_id thuộc chính vé.

## 10. Gửi duyệt, quyết định và hết hạn hồ sơ

Organizer cần Organization APPROVED, membership ACTIVE và phiên company identity đã duyệt. Submission khóa Event, xác minh version/status, layout FROZEN cùng snapshots và tính cutoff trừ một tháng lịch trong timezone suất sớm nhất (clamp ngày cuối tháng). Service ghi earliest_session_starts_at, submission_cutoff_at, calendar_timezone và snapshot_json, không nhận các giá trị tin cậy từ client. Sau khi khóa, lấy submitted_at bằng giờ DB; nếu đã qua cutoff thì rollback. INSERT EventReview PENDING với expires_at=submitted_at+15 ngày; Event chuyển PENDING_REVIEW, audit/outbox cùng commit.

Admin hoặc worker đều khóa Event trước EventReview, đọc lại version/status và thời gian sau khóa. Ví dụ chọn hồ sơ theo scope:

```sql
SELECT id,status,version,organization_id FROM events
WHERE id=:event_id FOR UPDATE;
SELECT id,event_id,event_version,status,expires_at FROM event_reviews
WHERE id=:review_id AND event_id=:event_id FOR UPDATE;
SELECT UTC_TIMESTAMP(6) AS decision_time;
```

Approve chỉ khi event PENDING_REVIEW, version đúng snapshot và `decision_time < expires_at`. Cập nhật review trước pointer event trong cùng transaction; mỗi update phải một hàng:

```sql
UPDATE event_reviews SET status='APPROVED',decided_by=:admin_id,decided_at=:decision_time
WHERE id=:review_id AND status='PENDING' AND expires_at>:decision_time;
UPDATE events SET status='PUBLISHED',approved_review_id=:review_id,
    approved_event_version=:event_version,approval_status='APPROVED'
WHERE id=:event_id AND status='PENDING_REVIEW' AND version=:event_version;
```

Không tăng version nội dung khi chỉ đóng bản duyệt; bất kỳ sửa nội dung phải withdraw/reject và tạo version/bản gửi mới theo 23. Reject có phiếu lý do do Admin viết; không tái dùng review đã đóng. Approve/reject ghi Notification đúng recipient và outbox/audit cùng transaction.

Hết hạn từ `decision_time >= expires_at`, dù request là nút Admin hay worker, thực hiện nhánh expiry và không approve:

```sql
UPDATE event_reviews SET status='EXPIRED',decided_by=NULL,decided_at=:decision_time
WHERE id=:review_id AND status='PENDING' AND expires_at<=:decision_time;
UPDATE events SET status='REJECTED'
WHERE id=:event_id AND status='PENDING_REVIEW' AND version=:event_version;
INSERT INTO reason_notices (review_id,status) VALUES (:review_id,'DRAFT');
INSERT INTO notifications (recipient_user_id,type,review_id,payload_redacted)
VALUES (:recipient_id,'REVIEW_EXPIRED',:review_id,:notification_json);
```

Kiểm tra affectedRows mỗi bước và insert audit/outbox trước COMMIT. Hủy **hồ sơ xin đăng**, không hủy event đã bán vé. UQ notice/review và recipient/type/review bảo vệ dedupe; job lặp đọc trạng thái đã đóng rồi kết thúc. Không gọi email trong transaction.

## 11. Form phiếu lý do và phiên OTP

Form theo 23 gồm reasonCode, reasonText bắt buộc và guidance tùy chọn; event/review/deadline là thông tin chỉ đọc. Admin lưu DRAFT với optimistic version, gửi dưới khóa Event→Review→Notice. Kiểm tra review REJECTED/EXPIRED, quyền event.review, version và nội dung, rồi:

```sql
UPDATE reason_notices
SET status='SENT',reason_code=:reason_code,reason_text=:reason_text,
    guidance=:guidance,authored_by=:admin_id,sent_at=:decision_time,version=version+1
WHERE id=:notice_id AND review_id=:review_id AND status='DRAFT' AND version=:version;
INSERT INTO notifications (recipient_user_id,type,review_id,reason_notice_id,payload_redacted)
VALUES (:recipient_id,'REASON_NOTICE',:review_id,:notice_id,:notification_json);
```

affectedRows=1, audit/outbox cùng commit; SENT bất biến tại service, không phải trigger DB. Chưa có form frontend được triển khai trong phạm vi SQL.

OTP: kiểm tra rate limit, challenge/channel/purpose/target/browser binding; dùng key phiên bản tương ứng tính HMAC rồi so constant-time. Khóa challenge, ghi attempts cả khi sai và **commit lần thử sai**, không rollback để xóa bộ đếm. Khi đúng, consume bằng điều kiện used_at/revoked_at NULL, attempts < max_attempts, expires_at > giờ DB mới; tạo/link identity đúng purpose và AuthSession/RefreshToken cùng transaction. Replay không tạo phiên thứ hai. Không lưu/log OTP hoặc proof Google trong audit/outbox.
