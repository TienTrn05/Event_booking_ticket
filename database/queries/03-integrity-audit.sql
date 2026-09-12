-- Chỉ SELECT: mỗi hàng kết quả là bất biến liên bảng cần điều tra.
-- Chạy trên snapshot nhất quán, ví dụ READ ONLY transaction REPEATABLE READ.
-- Không tự sửa/xóa dữ liệu, không dùng làm thay thế transaction của service.
SELECT 'SEAT_WRONG_VENUE' AS violation, ss.id AS resource_id
FROM session_seats ss
JOIN event_sessions es ON es.id=ss.session_id
JOIN seats s ON s.id=ss.seat_id
JOIN venue_rows vr ON vr.id=s.row_id
JOIN venue_sections vs ON vs.id=vr.section_id
WHERE vs.venue_id <> es.venue_id
UNION ALL
SELECT 'BOOKING_TOTAL_OR_CURRENCY', b.id
FROM bookings b
LEFT JOIN booking_items bi ON bi.booking_id=b.id
GROUP BY b.id, b.total_minor, b.currency
HAVING COUNT(bi.id)=0 OR SUM(bi.price_minor)<>b.total_minor
    OR SUM(CASE WHEN bi.currency<>b.currency THEN 1 ELSE 0 END)>0
UNION ALL
SELECT 'CONFIRMED_WITHOUT_SETTLED_PAYMENT', b.id
FROM bookings b LEFT JOIN payments p ON p.id=b.confirmed_payment_id
WHERE b.status IN ('CONFIRMED','REFUNDED')
  AND (p.id IS NULL OR p.status NOT IN ('SUCCESS','REFUNDED')
       OR p.amount_minor<>b.total_minor OR p.currency<>b.currency)
UNION ALL
SELECT 'ACTIVE_TICKET_WITHOUT_ALLOCATION', t.id
FROM tickets t
JOIN booking_items bi ON bi.id=t.booking_item_id
JOIN bookings b ON b.id=bi.booking_id
JOIN session_seats ss ON ss.id=t.session_seat_id
WHERE t.status IN ('VALID','USED')
  AND (b.status<>'CONFIRMED' OR ss.status<>'SOLD'
       OR NOT (ss.current_booking_id <=> b.id))
UNION ALL
SELECT 'HELD_WRONG_BOOKING_HOLD', ss.id
FROM session_seats ss JOIN bookings b ON b.id=ss.current_booking_id
WHERE ss.status='HELD' AND (b.hold_id<>ss.hold_id OR b.status<>'AWAITING_PAYMENT')
UNION ALL
SELECT 'REFUND_EXCEEDS_RECEIPT', p.id
FROM payments p JOIN refunds r ON r.payment_id=p.id
WHERE r.status IN ('PROCESSING','SUCCESS','FAILED')
GROUP BY p.id,p.amount_minor
HAVING SUM(r.amount_minor)>p.amount_minor;
