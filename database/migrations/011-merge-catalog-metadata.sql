-- Owner approved merging both 0..1 catalog extensions. Back up before applying.
-- No CASCADE: unexpected external dependencies abort rather than lose data.
BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE organizations, organization_profiles, events, event_publications IN ACCESS EXCLUSIVE MODE;
DROP TRIGGER trg_followed_event_status ON events;
DROP TRIGGER trg_followed_event_publication ON event_publications;
ALTER TABLE organizations DISABLE TRIGGER trg_organizations_updated_at;
ALTER TABLE events DISABLE TRIGGER trg_events_updated_at;

ALTER TABLE organizations
 ADD COLUMN public_id VARCHAR(80), ADD COLUMN avatar_url VARCHAR(1000),
 ADD COLUMN summary VARCHAR(1000), ADD COLUMN category_label VARCHAR(120),
 ADD COLUMN featured_rank SMALLINT,
 ADD COLUMN profile_created_at TIMESTAMPTZ(6), ADD COLUMN profile_updated_at TIMESTAMPTZ(6),
 ADD CONSTRAINT uq_organizations_public_id UNIQUE(public_id),
 ADD CONSTRAINT uq_organizations_featured_rank UNIQUE(featured_rank),
 ADD CONSTRAINT ck_organizations_public_metadata CHECK (
  (public_id IS NULL AND num_nonnulls(avatar_url,summary,category_label,featured_rank,profile_created_at,profile_updated_at)=0)
  OR (public_id IS NOT NULL AND num_nonnulls(avatar_url,summary,category_label,profile_created_at,profile_updated_at)=5
   AND char_length(trim(summary))>0 AND char_length(trim(category_label))>0));
UPDATE organizations o SET public_id=p.public_id,avatar_url=p.avatar_url,summary=p.summary,
 category_label=p.category_label,featured_rank=p.featured_rank,
 profile_created_at=p.created_at,profile_updated_at=p.updated_at
FROM organization_profiles p WHERE p.organization_id=o.id;

ALTER TABLE events
 ADD COLUMN public_id VARCHAR(80), ADD COLUMN display_name VARCHAR(180),
 ADD COLUMN publication_cover_image_url VARCHAR(1000), ADD COLUMN card_badge VARCHAR(80),
 ADD COLUMN admission_type VARCHAR(16), ADD COLUMN catalog_status VARCHAR(24),
 ADD COLUMN starting_price_minor BIGINT, ADD COLUMN currency CHAR(3),
 ADD COLUMN featured_rank SMALLINT, ADD COLUMN spotlight_rank SMALLINT,
 ADD COLUMN reopening_note VARCHAR(1000), ADD COLUMN published_at TIMESTAMPTZ(6),
 ADD COLUMN publication_created_at TIMESTAMPTZ(6), ADD COLUMN publication_updated_at TIMESTAMPTZ(6),
 ADD CONSTRAINT uq_events_public_id UNIQUE(public_id),
 ADD CONSTRAINT uq_events_featured_rank UNIQUE(featured_rank),
 ADD CONSTRAINT uq_events_spotlight_rank UNIQUE(spotlight_rank),
 ADD CONSTRAINT ck_events_public_metadata CHECK (
  (public_id IS NULL AND num_nonnulls(display_name,publication_cover_image_url,card_badge,admission_type,catalog_status,starting_price_minor,currency,featured_rank,spotlight_rank,reopening_note,published_at,publication_created_at,publication_updated_at)=0)
  OR (public_id IS NOT NULL AND num_nonnulls(display_name,publication_cover_image_url,admission_type,catalog_status,starting_price_minor,currency,published_at,publication_created_at,publication_updated_at)=9)),
 ADD CONSTRAINT ck_events_catalog_admission CHECK(admission_type IN ('NUMBERED','QUANTITY')),
 ADD CONSTRAINT ck_events_catalog_status CHECK(catalog_status IN ('ON_SALE','FEW_LEFT','SOLD_OUT','COMING_SOON')),
 ADD CONSTRAINT ck_events_catalog_price CHECK(starting_price_minor>=0),
 ADD CONSTRAINT ck_events_catalog_currency CHECK(currency=upper(currency) AND currency ~ '^[A-Z]{3}$');
UPDATE events e SET public_id=p.public_id,display_name=p.display_name,
 publication_cover_image_url=p.cover_image_url,card_badge=p.card_badge,
 admission_type=p.admission_type,catalog_status=p.catalog_status,
 starting_price_minor=p.starting_price_minor,currency=p.currency,
 featured_rank=p.featured_rank,spotlight_rank=p.spotlight_rank,reopening_note=p.reopening_note,
 published_at=p.published_at,publication_created_at=p.created_at,publication_updated_at=p.updated_at
FROM event_publications p WHERE p.event_id=e.id;

-- Verify every original field, including distinct draft/published covers and timestamps.
DO $$ BEGIN
 IF EXISTS (
  SELECT organization_id,public_id,avatar_url,summary,category_label,featured_rank,created_at,updated_at FROM organization_profiles
  EXCEPT SELECT id,public_id,avatar_url,summary,category_label,featured_rank,profile_created_at,profile_updated_at FROM organizations
 ) OR EXISTS (
  SELECT event_id,public_id,display_name,cover_image_url,card_badge,admission_type,catalog_status,starting_price_minor,currency,featured_rank,spotlight_rank,reopening_note,published_at,created_at,updated_at FROM event_publications
  EXCEPT SELECT id,public_id,display_name,publication_cover_image_url,card_badge,admission_type,catalog_status,starting_price_minor,currency,featured_rank,spotlight_rank,reopening_note,published_at,publication_created_at,publication_updated_at FROM events
 ) THEN RAISE EXCEPTION 'Catalog copy verification failed'; END IF;
END $$;
DROP TABLE organization_profiles;
DROP TABLE event_publications;
ALTER TABLE organizations ENABLE TRIGGER trg_organizations_updated_at;
ALTER TABLE events ENABLE TRIGGER trg_events_updated_at;

CREATE OR REPLACE FUNCTION enqueue_followed_event() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status IS NOT DISTINCT FROM NEW.status AND OLD.published_at IS NOT DISTINCT FROM NEW.published_at THEN RETURN NULL; END IF;
 END IF;
 INSERT INTO outbox_messages(type,aggregate_type,aggregate_id,aggregate_version,dedupe_key,payload_minimal,available_at)
 SELECT 'FOLLOWED_ORGANIZER_EVENT','EVENT',e.id,e.version,'followed-event:'||e.id,
  jsonb_build_object('publishedAt',GREATEST(e.published_at,clock_timestamp())),
  GREATEST(e.published_at,clock_timestamp())
 FROM events e JOIN organizations o ON o.id=e.organization_id
 WHERE e.id=NEW.id AND e.status='PUBLISHED' AND e.published_at IS NOT NULL AND o.status='APPROVED'
 ON CONFLICT(dedupe_key) DO NOTHING;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER trg_followed_event_status AFTER INSERT OR UPDATE OF status,published_at ON events
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION enqueue_followed_event();
COMMIT;
