-- Chỉ đọc cho service đã kiểm tra event.review; không tự quyết định/expire.
-- Phiếu DRAFT tiếp tục xuất hiện kể cả khi hồ sơ không còn PENDING.
SELECT r.id AS review_id,r.event_id,e.title,r.event_version,r.status,
       r.submitted_at,r.expires_at,n.id AS reason_notice_id,n.status AS notice_status,
       CASE WHEN r.status='PENDING' AND r.expires_at<=UTC_TIMESTAMP(6)
            THEN 'EXPIRY_DUE' WHEN n.status='DRAFT' THEN 'REASON_REQUIRED'
            ELSE 'REVIEW_REQUIRED' END AS work_type
FROM event_reviews r JOIN events e ON e.id=r.event_id
LEFT JOIN reason_notices n ON n.review_id=r.id
WHERE r.status='PENDING' OR n.status='DRAFT'
ORDER BY r.expires_at,r.id;
