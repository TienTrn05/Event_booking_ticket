# 20. Thiết kế SQL vật lý

Schema chuẩn để review: [database/schema.sql](../database/schema.sql), gồm 27 bảng. Khác biệt kỹ thuật so với mô hình logic ban đầu được ghi tại ADR-011; [08](08-database-design.md) đã cập nhật để thống nhất.

## Bản đồ bảng

| Miền | Bảng |
| --- | --- |
| Identity | users, roles, permissions, user_roles, role_permissions, auth_sessions, refresh_tokens, verification_tokens |
| Catalog/địa điểm | event_categories, events, venues, venue_sections, venue_rows, seats, event_sessions |
| Tồn kho/đơn/vé | session_seats, seat_holds, seat_hold_items, bookings, booking_items, tickets |
| Tiền | payments, refunds |
| Vận hành | idempotency_records, payment_webhooks, outbox_messages, audit_logs |

## Các quyết định vật lý

ID dùng BIGINT UNSIGNED, API dùng chuỗi. Tiền BIGINT có CHECK không âm, currency bắt buộc 3 chữ hoa, chưa tự xác nhận mã đó thuộc danh sách currency được kinh doanh. Không default currency hoặc TTL. Datetime UTC độ chính xác microsecond; session giữ timezone IANA để hiển thị. Mọi connection phải cấu hình UTC; DEFAULT CURRENT_TIMESTAMP phụ thuộc connection timezone.

Text dùng utf8mb4_0900_as_cs để không âm thầm gộp dấu/hoa thường; email cần được canonicalize theo Q-006 trước ghi. Slug, status, provider key và permission dùng ascii_bin để so sánh chính xác. Đây là collation kỹ thuật thận trọng; yêu cầu tìm tiếng Việt không dấu cần Q-014 và index/normalization riêng, không đổi toàn DB để giải quyết tìm kiếm.

FK dùng mặc định NO ACTION (InnoDB xử lý như RESTRICT), không cascade xóa lịch sử. Các FK tham chiếu khóa unique rõ ràng để tránh dựa vào non-standard referenced key. FK vòng Booking–Payment thêm bằng ALTER sau CREATE, không tắt kiểm tra khóa ngoại. Quy tắc này dựa trên [MySQL FOREIGN KEY constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-foreign-keys.html).

## Bất biến được DB bảo vệ

| Bất biến | Cơ chế |
| --- | --- |
| Không trùng ghế vật lý trong một suất | UQ session_seats(session_id,seat_id) |
| Booking phải cùng chủ/suất với hold | FK (hold_id,customer_id,session_id) → seat_holds |
| Hold item/booking item thuộc đúng suất | session_id lặp có chủ đích; hai composite FK đến aggregate và session-seat |
| HELD/SOLD/AVAILABLE có pointer hợp lệ | CHECK tổ hợp NULL/NOT NULL và status |
| Một hold chỉ tạo một booking | UQ bookings.hold_id |
| Một item chỉ phát một ticket | UQ tickets.booking_item_id |
| Hai vé VALID/USED không cùng một session-seat | Generated active_seat_guard + UNIQUE; FK ticket-item chứng minh đúng ghế |
| Một booking có tối đa một payment đang chờ | Generated pending_booking_guard + UNIQUE |
| Khoản dùng xác nhận phải thuộc booking đó | bookings.confirmed_payment_id + composite FK (confirmed_payment_id,id) |
| Không nhân đôi provider reference, callback hoặc key | UQ theo namespace provider hoặc actor/operation |
| Một full refund không bị tạo lặp | Generated full_refund_guard; loại REJECTED không chiếm guard; Q-004 |
| Refresh token chỉ có một con và cùng phiên | UQ parent_id + composite FK parent/session |
| Worker claim phải có lease expiry và token | CHECK outbox PROCESSING ↔ lease fields đầy đủ |

Unique index MySQL cho phép nhiều NULL; generated guard trả NULL khi hàng không còn thuộc tập cần unique. Biểu thức guard không dùng thời gian hiện tại: expiry phải được service/worker xử lý thành trạng thái. Tham khảo [Generated Columns](https://dev.mysql.com/doc/refman/8.4/en/create-table-generated-columns.html).

CHECK kiểm tra một hàng, không gọi service hoặc query bảng khác; biểu thức NULL có thể thành UNKNOWN và được chấp nhận, vì vậy kiểm tra pointer/field nullable phải ghi IS NULL/IS NOT NULL tường minh. Đặc tả theo [MySQL CHECK constraints](https://dev.mysql.com/doc/refman/8.4/en/create-table-check-constraints.html).

## Không dùng unique để phủ nhận khoản tiền đã nhận

Thiết kế ban đầu có successful_booking_guard. Bản vật lý bỏ guard này: nếu provider thực sự thu hai lần hoặc báo thành công cho attempt cũ, DB vẫn phải lưu được cả hai sự kiện tiền. Booking chỉ có một `confirmed_payment_id` và vẫn xác nhận một lần dưới khóa. Khoản SUCCESS không được chọn để cấp vé phải gắn reconciliation REQUIRED, lý do và công việc xử lý. Không tạo payment mới khi đã SUCCESS/PENDING là trách nhiệm service, không phải ngăn ghi nhận sự thật kế toán.

Provider key phải ổn định theo attempt; webhook lưu normalized_payload tối thiểu gồm outcome, provider reference, amountMinor, currency, thời gian/sự kiện cần đối soát. Chỉ hash không đủ để phục hồi sau crash. Không lưu Authorization, chữ ký bí mật, dữ liệu thẻ hay raw payload tùy ý; chỉ adapter đã xác minh mới ghi inbox, JSON phải qua schema validation.

## Bất biến vẫn cần service/transaction

- Seat vật lý thuộc venue của session; session đúng event route; Organizer có quyền venue/event.
- Booking/item/hold có cùng giá snapshot, currency, tổng tiền, deadline; aggregate có ít nhất một item.
- Booking HELD pointer phải trỏ đúng hold của chính booking; ghế SOLD phải khớp các item/vé.
- Chỉ payment SUCCESS đã xác minh, còn hạn và đủ ghế mới được xác nhận/phát vé.
- Chuyển trạng thái hợp lệ, quota, hạn bán, check-in window, chính sách refund, tổng tiền hoàn không vượt khoản nhận.
- Một lần check-in cần UPDATE có điều kiện và khóa; CHECK USED có actor/time không thay thế chống đua.
- Audit append-only cần quyền DB phù hợp; DDL không tự ngăn người có quyền UPDATE audit. JSON không tự bảo đảm dữ liệu đã redact.

Truy vấn [integrity audit](../database/queries/03-integrity-audit.sql) giúp phát hiện vi phạm, không sửa dữ liệu hoặc thay giao thức khóa.

## Chỉ mục và đánh đổi chuẩn hóa

Các cột lặp `session_id` ở items, `session_seat_id` ở ticket và `provider` ở refund phục vụ composite FK/unique. Đây là denormalization có kiểm soát bằng DB, cần thiết để chặn nhầm phạm vi ngay khi ghi. Giá/nhãn snapshot là dữ liệu lịch sử riêng, không cập nhật theo giá hiện tại.

Index giá/expiry/status phục vụ truy vấn phổ biến và job; index PK/FK phục vụ lock chính xác. Không có FULLTEXT/Elasticsearch, view vật hóa hoặc partition mặc định. Chỉ đánh giá EXPLAIN/latency trên dữ liệu tải thật mới kết luận index đủ hiệu quả. Query doanh số aggregate refund trước join để không nhân tiền theo số item/refund.

## Phạm vi đề xuất cần chốt

Schema dựa phương án một session/booking, ghế đánh số, owner vé theo booking, full refund và không bán lại tự động. Nếu Q-004/Q-007/Q-008/Q-009 khác phương án này, sửa DDL/ERD/test trước migration đầu tiên. Không gọi đây là migration production đã được áp dụng.
