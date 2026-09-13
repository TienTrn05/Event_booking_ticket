-- Chỉ SELECT: mỗi hàng kết quả là bất biến liên bảng cần điều tra.
-- Chạy trên snapshot nhất quán, ví dụ READ ONLY transaction REPEATABLE READ.
-- Không tự sửa/xóa dữ liệu, không dùng làm thay thế transaction của service.
SELECT 'SEAT_OUTSIDE_CANVAS' AS violation, s.id AS resource_id
FROM seats s JOIN seat_layouts l ON l.id=s.layout_id
WHERE s.map_x+s.width>l.canvas_width OR s.map_y+s.height>l.canvas_height
UNION ALL
SELECT 'LAYOUT_OVER_CAPACITY', l.id
FROM seat_layouts l JOIN seats s ON s.layout_id=l.id AND s.is_active=1
GROUP BY l.id,l.capacity_snapshot HAVING COUNT(*)>l.capacity_snapshot
UNION ALL
SELECT 'PUBLISHED_LAYOUT_NOT_FROZEN', es.id
FROM event_sessions es JOIN events e ON e.id=es.event_id
JOIN seat_layouts l ON l.id=es.layout_id
WHERE e.status='PUBLISHED' AND l.status<>'FROZEN'
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
HAVING SUM(r.amount_minor)>p.amount_minor
UNION ALL
SELECT 'CONFIRMED_ITEM_WITHOUT_TICKET', bi.id
FROM booking_items bi JOIN bookings b ON b.id=bi.booking_id
LEFT JOIN tickets t ON t.booking_item_id=bi.id
WHERE b.status='CONFIRMED' AND t.id IS NULL
UNION ALL
SELECT 'ONLINE_CHECKIN_WRONG_OWNER_OR_WINDOW', ci.id
FROM check_ins ci JOIN tickets t ON t.id=ci.ticket_id
JOIN booking_items bi ON bi.id=t.booking_item_id
JOIN bookings b ON b.id=bi.booking_id JOIN event_sessions es ON es.id=b.session_id
WHERE ci.method='ONLINE' AND (ci.actor_id<>b.customer_id
  OR ci.checked_in_at<DATE_SUB(es.starts_at,INTERVAL 1 DAY) OR ci.checked_in_at>=es.starts_at)
UNION ALL
SELECT 'ADMISSION_BEFORE_CHECKIN_OR_OUTSIDE_WINDOW', t.id
FROM tickets t JOIN check_ins ci ON ci.id=t.admission_check_in_id
JOIN session_seats ss ON ss.id=t.session_seat_id JOIN event_sessions es ON es.id=ss.session_id
WHERE t.status='USED' AND (t.admitted_at<ci.checked_in_at
  OR t.admitted_at<es.admission_opens_at OR t.admitted_at>=es.admission_closes_at)
UNION ALL
SELECT 'EXPIRED_REVIEW_WITHOUT_REASON_TASK', r.id
FROM event_reviews r LEFT JOIN reason_notices n ON n.review_id=r.id
WHERE r.status='EXPIRED' AND n.id IS NULL
UNION ALL
SELECT 'PUBLISHED_VERSION_NOT_APPROVED', e.id
FROM events e WHERE e.status='PUBLISHED' AND e.version<>e.approved_event_version;
-- Polygon bounds, intersections, calendar-month cutoff, name/code and permissions
-- require service validation; this query only audits the listed invariants.
