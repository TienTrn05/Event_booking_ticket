-- Reuse existing entities; no additional tables or role grants.
BEGIN;
ALTER TABLE event_change_requests ADD COLUMN event_version INTEGER,
 ADD COLUMN version INTEGER NOT NULL DEFAULT 0, ADD COLUMN snapshot_json JSONB,
 ADD COLUMN decision_reason VARCHAR(2000), DROP CONSTRAINT ck_event_change_type;
ALTER TABLE event_change_requests ADD CONSTRAINT ck_event_change_type
 CHECK(request_type IN ('CAPACITY','NEW_SALE_WAVE','SALES_CONFIG','RESUME_SALES','CONTENT')),
 ADD CONSTRAINT ck_event_content_snapshot CHECK(request_type<>'CONTENT' OR
  (event_version IS NOT NULL AND event_version>=0 AND snapshot_json IS NOT NULL AND jsonb_typeof(snapshot_json)='object'
   AND snapshot_json ?& ARRAY['title','description'] AND jsonb_typeof(snapshot_json->'title')='string'
   AND jsonb_typeof(snapshot_json->'description')='string' AND char_length(trim(snapshot_json->>'title')) BETWEEN 1 AND 180
   AND char_length(trim(snapshot_json->>'description')) BETWEEN 1 AND 10000)),
 ADD CONSTRAINT ck_event_change_version CHECK(version>=0);
CREATE UNIQUE INDEX uq_event_content_pending ON event_change_requests(event_id) WHERE request_type='CONTENT' AND status='PENDING';
ALTER TABLE events ADD COLUMN cancelled_by BIGINT REFERENCES users(id),
 ADD COLUMN cancelled_at TIMESTAMPTZ(6), ADD COLUMN cancellation_reason VARCHAR(2000),
 ADD CONSTRAINT ck_event_cancellation_metadata CHECK
 (num_nonnulls(cancelled_by,cancelled_at,cancellation_reason) IN (0,3)),
 ADD CONSTRAINT ck_event_cancellation_state CHECK(cancelled_at IS NULL OR status='CANCELLED');
ALTER TABLE notifications ADD COLUMN event_version INTEGER,
 DROP CONSTRAINT ck_notification_type, DROP CONSTRAINT ck_notification_target;
ALTER TABLE notifications ADD CONSTRAINT ck_notification_type CHECK(type IN
 ('REVIEW_APPROVED','REVIEW_REJECTED','REVIEW_EXPIRED','REASON_NOTICE','FOLLOWED_ORGANIZER_EVENT','EVENT_CANCELLED','EVENT_UPDATED')),
 ADD CONSTRAINT ck_notification_target CHECK (
  (type='FOLLOWED_ORGANIZER_EVENT' AND event_id IS NOT NULL AND review_id IS NULL AND reason_notice_id IS NULL AND event_version IS NULL) OR
  (type IN ('EVENT_CANCELLED','EVENT_UPDATED') AND event_id IS NOT NULL AND review_id IS NULL AND reason_notice_id IS NULL AND event_version IS NOT NULL) OR
  (type NOT IN ('FOLLOWED_ORGANIZER_EVENT','EVENT_CANCELLED','EVENT_UPDATED') AND review_id IS NOT NULL AND event_id IS NULL AND event_version IS NULL));
DROP INDEX uq_notification_event;
CREATE UNIQUE INDEX uq_notification_event ON notifications(recipient_user_id,type,event_id) WHERE event_id IS NOT NULL AND event_version IS NULL;
CREATE UNIQUE INDEX uq_notification_event_version ON notifications(recipient_user_id,type,event_id,event_version) WHERE event_version IS NOT NULL;
COMMIT;
