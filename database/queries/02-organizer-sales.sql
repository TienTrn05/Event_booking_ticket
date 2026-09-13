-- @organization_id/@actor_user_id/@identity_id lấy từ phiên công ty đã xác thực.
-- Service kiểm tra sales.read_own, domain công ty và scope; SQL không tự xác thực JWT.
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
WHERE e.organization_id = @organization_id
  AND EXISTS (
      SELECT 1 FROM organization_memberships m
      JOIN organizations o ON o.id=m.organization_id AND o.status='APPROVED'
      JOIN external_identities i ON i.id=m.company_identity_id AND i.user_id=m.user_id
      JOIN users u ON u.id=m.user_id AND u.status='ACTIVE'
      WHERE m.organization_id=e.organization_id AND m.user_id=@actor_user_id
        AND m.status='ACTIVE' AND i.id=@identity_id AND i.revoked_at IS NULL
        AND i.email_verified_at IS NOT NULL
  )
  AND b.status IN ('CONFIRMED','REFUNDED')
  AND b.confirmed_at >= @from_utc AND b.confirmed_at < @to_utc
GROUP BY e.id, e.title, b.currency
ORDER BY e.id, b.currency;
