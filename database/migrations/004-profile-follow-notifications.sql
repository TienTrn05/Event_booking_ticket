-- ADR-023. Reviewed additive profile fields/follows and extension of review inbox.
-- Back up the selected database before applying. No public DOB/gender data.
BEGIN;
ALTER TABLE users ADD COLUMN gender VARCHAR(16) NULL,
  ADD COLUMN date_of_birth DATE NULL,
  ADD CONSTRAINT ck_users_gender CHECK (gender IN ('MALE','FEMALE','OTHER','UNDISCLOSED')),
  ADD CONSTRAINT ck_users_birth_date CHECK (date_of_birth >= DATE '0001-01-01');

CREATE TABLE organization_follows (
  user_id BIGINT NOT NULL REFERENCES users(id),
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  notifications_enabled_at TIMESTAMPTZ(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (user_id, organization_id),
  CONSTRAINT ck_follow_notifications CHECK ((notifications_enabled AND notifications_enabled_at IS NOT NULL)
    OR (NOT notifications_enabled AND notifications_enabled_at IS NULL))
);
CREATE INDEX ix_follows_organization ON organization_follows(organization_id,user_id);
CREATE TRIGGER trg_organization_follows_updated_at BEFORE UPDATE ON organization_follows
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE notifications ALTER COLUMN review_id DROP NOT NULL,
  ADD COLUMN event_id BIGINT NULL REFERENCES events(id),
  DROP CONSTRAINT ck_notification_type;
ALTER TABLE notifications ADD CONSTRAINT ck_notification_type
  CHECK (type IN ('REVIEW_APPROVED','REVIEW_REJECTED','REVIEW_EXPIRED','REASON_NOTICE','FOLLOWED_ORGANIZER_EVENT')),
  ADD CONSTRAINT ck_notification_target CHECK (
    (type='FOLLOWED_ORGANIZER_EVENT' AND event_id IS NOT NULL AND review_id IS NULL AND reason_notice_id IS NULL)
    OR (type<>'FOLLOWED_ORGANIZER_EVENT' AND review_id IS NOT NULL AND event_id IS NULL));
CREATE UNIQUE INDEX uq_notification_event ON notifications(recipient_user_id,type,event_id)
  WHERE event_id IS NOT NULL;
CREATE INDEX ix_notification_unread ON notifications(recipient_user_id,id) WHERE read_at IS NULL;

-- Deferred hooks examine the final state at transaction commit. Both event approval
-- and publication creation are covered; neither grants permission to publish.
CREATE FUNCTION enqueue_followed_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target_id BIGINT;
BEGIN
  IF TG_TABLE_NAME='events' THEN target_id := NEW.id; ELSE target_id := NEW.event_id; END IF;
  IF TG_OP='UPDATE' THEN
    IF TG_TABLE_NAME='events' THEN
      IF OLD.status IS NOT DISTINCT FROM NEW.status THEN RETURN NULL; END IF;
    ELSE
      IF OLD.published_at IS NOT DISTINCT FROM NEW.published_at THEN RETURN NULL; END IF;
    END IF;
  END IF;
  INSERT INTO outbox_messages(type,aggregate_type,aggregate_id,aggregate_version,dedupe_key,payload_minimal,available_at)
  SELECT 'FOLLOWED_ORGANIZER_EVENT','EVENT',e.id,e.version,'followed-event:'||e.id,
    jsonb_build_object('publishedAt',GREATEST(ep.published_at,clock_timestamp())),
    GREATEST(ep.published_at,clock_timestamp())
  FROM events e JOIN event_publications ep ON ep.event_id=e.id
    JOIN organizations o ON o.id=e.organization_id
  WHERE e.id=target_id AND e.status='PUBLISHED' AND o.status='APPROVED'
  ON CONFLICT(dedupe_key) DO NOTHING;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_followed_event_status AFTER INSERT OR UPDATE OF status ON events
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enqueue_followed_event();
CREATE CONSTRAINT TRIGGER trg_followed_event_publication AFTER INSERT OR UPDATE OF published_at ON event_publications
  DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enqueue_followed_event();
COMMIT;
-- Recovery: restore backup; existing review notifications and profile data remain intact.
