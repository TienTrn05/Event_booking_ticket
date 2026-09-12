-- @organizer_id lấy từ actor đã xác thực; service kiểm tra sales.read_own.
-- @from_utc, @to_utc lọc thời điểm xác nhận booking, khoảng [from,to).
-- Báo cáo cohort booking; không phải báo cáo dòng tiền theo ngày hoàn.
-- Chỉ khoản được booking chọn để xác nhận là doanh thu bán vé.
-- Khoản nhận thừa/tiền muộn xuất hiện trong payment reconciliation riêng.
SELECT e.id AS event_id, e.title, b.currency,
       COUNT(*) AS confirmed_booking_count,
       SUM(p.amount_minor) AS gross_ticket_sales_minor,
       SUM(COALESCE(r.refunded_minor, 0)) AS refunded_minor,
       SUM(p.amount_minor - COALESCE(r.refunded_minor, 0)) AS net_ticket_sales_minor
FROM bookings AS b
JOIN event_sessions AS es ON es.id = b.session_id
JOIN events AS e ON e.id = es.event_id
JOIN payments AS p ON p.id = b.confirmed_payment_id AND p.booking_id = b.id
LEFT JOIN (
    SELECT payment_id, SUM(amount_minor) AS refunded_minor
    FROM refunds WHERE status = 'SUCCESS' GROUP BY payment_id
) AS r ON r.payment_id = p.id
WHERE e.organizer_id = @organizer_id
  AND b.status IN ('CONFIRMED','REFUNDED')
  AND b.confirmed_at >= @from_utc AND b.confirmed_at < @to_utc
GROUP BY e.id, e.title, b.currency
ORDER BY e.id, b.currency;
