-- Explicit LOCAL DEMO only. No login sessions, role grants, payments or real transfers.
-- Requires schema through 013 and public catalog seed 002. Do not run on production.
SET client_encoding = 'UTF8';
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM events WHERE id=970001 AND slug<>'local-ticket-sales-demo') THEN
  RAISE EXCEPTION 'Local demo ID is already occupied';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM organizations WHERE id=902001 AND status='APPROVED') THEN
  RAISE EXCEPTION 'Public catalog fixture 002 is required';
 END IF;
END $$;
INSERT INTO events(id,organization_id,created_by,category_id,title,slug,description,status,version,minimum_age,cover_image_url)
SELECT 970001,902001,900101,e.category_id,'[DEMO LOCAL] Kiểm thử bán vé',
 'local-ticket-sales-demo','Dữ liệu demo cá nhân. Hồ sơ duyệt là fixture, không phải tài khoản Admin vận hành. Không chuyển tiền thật trong bài kiểm thử.','DRAFT',0,18,e.publication_cover_image_url
FROM events e WHERE e.id=905001 ON CONFLICT DO NOTHING;
INSERT INTO seat_layouts(id,organization_id,event_id,venue_id,venue_version,version,status,geometry_json,bounds_snapshot,canvas_width,canvas_height,capacity_snapshot,frozen_at)
SELECT 970002,902001,970001,v.id,v.version,1,'FROZEN',jsonb_build_object('fixture','local-ticket-sales','stage',jsonb_build_object('x',0,'y',0,'width',10,'height',2)),v.bounds_json,v.canvas_width,v.canvas_height,v.max_capacity,clock_timestamp()
FROM venues v JOIN event_sessions s ON s.venue_id=v.id WHERE s.id=907001 ON CONFLICT DO NOTHING;
WITH tick AS MATERIALIZED(SELECT clock_timestamp() AS at)
INSERT INTO event_sessions(id,event_id,venue_id,layout_id,starts_at,ends_at,timezone,sale_opens_at,sale_closes_at,counter_opens_at,counter_closes_at,admission_opens_at,admission_closes_at)
SELECT 970003,970001,l.venue_id,l.id,t.at+interval '40 days',t.at+interval '40 days 4 hours',v.timezone,
 t.at-interval '1 day',t.at+interval '39 days',t.at+interval '40 days'-interval '3 hours',t.at+interval '40 days 1 hour',t.at+interval '40 days'-interval '2 hours',t.at+interval '40 days 4 hours'
FROM seat_layouts l JOIN venues v ON v.id=l.venue_id CROSS JOIN tick t WHERE l.id=970002 ON CONFLICT DO NOTHING;
INSERT INTO layout_sections(id,layout_id,code,name) VALUES(970005,970002,'DEMO','Demo local') ON CONFLICT DO NOTHING;
INSERT INTO layout_rows(id,section_id,layout_id,code) VALUES(970006,970005,970002,'A') ON CONFLICT DO NOTHING;
INSERT INTO seats(id,row_id,layout_id,number,map_x,map_y,width,height)
SELECT 971000+i,970006,970002,i::text,2+(i-1)*2,5,1,1 FROM generate_series(1,12) i ON CONFLICT DO NOTHING;
INSERT INTO ticket_types(id,session_id,code,name) VALUES(970007,970003,'DEMO','Vé demo 2.000 VND') ON CONFLICT DO NOTHING;
UPDATE event_sessions SET pricing_config=(SELECT jsonb_agg(jsonb_build_object('seatId',id::text,'ticketTypeId','970007','priceMinor','2000','currency','VND') ORDER BY id) FROM seats WHERE layout_id=970002)
WHERE id=970003 AND pricing_config IS NULL;
WITH review_tick AS MATERIALIZED(SELECT clock_timestamp() AS at)
INSERT INTO event_reviews(id,event_id,event_version,submitted_by,submitted_at,expires_at,earliest_session_starts_at,submission_cutoff_at,calendar_timezone,snapshot_json,status,decided_by,decided_at)
SELECT 970004,970001,0,900101,t.at,t.at+interval '15 days',s.starts_at,s.starts_at-interval '1 month',s.timezone,
 jsonb_build_object('fixture','LOCAL_DEMO_ONLY','eventId','local-ticket-sales-demo','sessionId',s.id::text,'minimumAge',18,'priceMinor','2000','seats',12),
 'APPROVED',900001,t.at FROM event_sessions s CROSS JOIN review_tick t WHERE s.id=970003 ON CONFLICT DO NOTHING;
UPDATE events SET status='PUBLISHED',approved_review_id=970004,approved_event_version=0,approval_status='APPROVED',
 public_id='local-ticket-sales-demo',display_name=title,publication_cover_image_url=cover_image_url,card_badge='DEMO LOCAL',
 admission_type='NUMBERED',catalog_status='ON_SALE',starting_price_minor=2000,currency='VND',published_at=clock_timestamp(),publication_created_at=clock_timestamp(),publication_updated_at=clock_timestamp()
WHERE id=970001 AND status='DRAFT' AND public_id IS NULL;
INSERT INTO session_seats(id,session_id,seat_id,layout_id,ticket_type_id,price_minor,currency)
SELECT 972000+(id-971000),970003,id,970002,970007,2000,'VND' FROM seats WHERE layout_id=970002 ON CONFLICT DO NOTHING;
-- Preserve rerun history: never reset status, money, deadlines, attendees or sold seats.
DO $$ DECLARE tab TEXT; seq TEXT; BEGIN
 FOREACH tab IN ARRAY ARRAY['events','seat_layouts','event_sessions','event_reviews','layout_sections','layout_rows','seats','ticket_types','session_seats'] LOOP
  seq:=pg_get_serial_sequence(tab,'id');
  EXECUTE format('SELECT setval(%L,GREATEST((SELECT last_value FROM %s),(SELECT max(id) FROM %I)),true)',seq,seq,tab);
 END LOOP;
END $$;
COMMIT;
