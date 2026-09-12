-- Truy vấn đọc dùng trong repository; bind @session_id từ route đã validate.
-- Snapshot không thay thế kiểm tra lại dưới khóa lúc giữ ghế.
-- @session_id không được đặt tự động vào một session có thật trong file mẫu.
SELECT ss.id AS session_seat_id, s.number, vr.code AS row_code,
       vs.code AS section_code, s.map_x, s.map_y,
       ss.price_minor, ss.currency,
       CASE WHEN ss.status = 'HELD' AND ss.hold_expires_at <= UTC_TIMESTAMP(6)
            THEN 'AVAILABLE_AFTER_CLEANUP' ELSE ss.status END AS availability,
       ss.version, UTC_TIMESTAMP(6) AS server_time
FROM session_seats AS ss
JOIN seats AS s ON s.id = ss.seat_id
JOIN venue_rows AS vr ON vr.id = s.row_id
JOIN venue_sections AS vs ON vs.id = vr.section_id
JOIN event_sessions AS es ON es.id = ss.session_id
JOIN events AS e ON e.id = es.event_id
WHERE ss.session_id = @session_id
  AND e.status = 'PUBLISHED' AND es.status = 'SCHEDULED'
ORDER BY vs.code, vr.code, s.number, ss.id;
