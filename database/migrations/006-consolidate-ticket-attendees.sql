-- Reuse the existing per-ticket purchase row instead of a second 1:1 table.
-- Apply after 005, after backup. Recovery: restore the pre-006 backup.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE bookings, tickets, booking_items, ticket_attendees IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM ticket_attendees a JOIN booking_items bi ON bi.id=a.booking_item_id
             WHERE a.full_name IS DISTINCT FROM bi.attendee_name_snapshot) THEN
    RAISE EXCEPTION 'ATTENDEE_NAME_CONFLICT';
  END IF;
END $$;
ALTER TABLE booking_items
  ADD COLUMN attendee_date_of_birth DATE NULL,
  ADD COLUMN attendee_phone VARCHAR(16) NULL,
  ADD COLUMN cccd_ciphertext BYTEA NULL,
  ADD COLUMN cccd_mac BYTEA NULL,
  ADD COLUMN cccd_last_four CHAR(4) NULL,
  ADD COLUMN pii_key_version VARCHAR(32) NULL,
  ADD COLUMN cccd_purge_after TIMESTAMPTZ(6) NULL,
  ADD COLUMN cccd_purged_at TIMESTAMPTZ(6) NULL,
  ADD COLUMN identity_verified_at TIMESTAMPTZ(6) NULL,
  ADD COLUMN identity_verified_by BIGINT NULL REFERENCES users(id),
  ADD COLUMN updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6);
UPDATE booking_items bi SET
  attendee_date_of_birth=a.date_of_birth, attendee_phone=a.phone,
  cccd_ciphertext=a.cccd_ciphertext, cccd_mac=a.cccd_mac, cccd_last_four=a.cccd_last_four,
  pii_key_version=a.pii_key_version, cccd_purge_after=a.cccd_purge_after,
  cccd_purged_at=a.cccd_purged_at, identity_verified_at=a.identity_verified_at,
  identity_verified_by=a.identity_verified_by, updated_at=a.updated_at
FROM ticket_attendees a WHERE a.booking_item_id=bi.id;
ALTER TABLE booking_items
  ADD CONSTRAINT ck_item_attendee_details CHECK (
    (attendee_date_of_birth IS NULL AND attendee_phone IS NULL AND cccd_purge_after IS NULL
     AND cccd_ciphertext IS NULL AND cccd_mac IS NULL AND cccd_last_four IS NULL
     AND pii_key_version IS NULL AND cccd_purged_at IS NULL
     AND identity_verified_at IS NULL AND identity_verified_by IS NULL)
    OR (attendee_date_of_birth IS NOT NULL AND attendee_phone IS NOT NULL AND cccd_purge_after IS NOT NULL
        AND attendee_date_of_birth >= DATE '0001-01-01' AND attendee_phone ~ '^\+[1-9][0-9]{7,14}$'
        AND ((cccd_purged_at IS NULL AND cccd_ciphertext IS NOT NULL AND cccd_mac IS NOT NULL
              AND cccd_last_four IS NOT NULL AND pii_key_version IS NOT NULL)
          OR (cccd_purged_at IS NOT NULL AND cccd_ciphertext IS NULL AND cccd_mac IS NULL
              AND cccd_last_four IS NULL AND pii_key_version IS NULL)))),
  ADD CONSTRAINT ck_item_attendee_verified CHECK (
    (identity_verified_at IS NULL AND identity_verified_by IS NULL)
    OR (identity_verified_at IS NOT NULL AND identity_verified_by IS NOT NULL));
CREATE INDEX ix_item_pii_purge ON booking_items(cccd_purge_after, id)
  WHERE cccd_purged_at IS NULL AND cccd_purge_after IS NOT NULL;
CREATE TRIGGER trg_booking_items_updated_at BEFORE UPDATE ON booking_items
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE OR REPLACE FUNCTION require_booking_attendees() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='CONFIRMED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS(SELECT 1 FROM booking_items WHERE booking_id=NEW.id)
      OR EXISTS(SELECT 1 FROM booking_items bi
        JOIN event_sessions s ON s.id=bi.session_id JOIN venues v ON v.id=s.venue_id
        JOIN events e ON e.id=s.event_id WHERE bi.booking_id=NEW.id AND
          (bi.attendee_date_of_birth IS NULL OR bi.attendee_phone IS NULL OR bi.cccd_ciphertext IS NULL
           OR bi.cccd_purged_at IS NOT NULL OR bi.attendee_date_of_birth>CURRENT_DATE
           OR (e.minimum_age IS NOT NULL AND EXTRACT(YEAR FROM age((s.starts_at AT TIME ZONE v.timezone)::date,bi.attendee_date_of_birth))<e.minimum_age)))
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='ATTENDEE_CREDENTIALS_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION require_ticket_age_proof() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='USED' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS(
    SELECT 1 FROM booking_items bi JOIN event_sessions s ON s.id=bi.session_id JOIN venues v ON v.id=s.venue_id
      JOIN events e ON e.id=s.event_id WHERE bi.id=NEW.booking_item_id AND
      (bi.attendee_date_of_birth IS NULL OR bi.identity_verified_at IS NULL OR bi.cccd_ciphertext IS NULL
       OR bi.cccd_purged_at IS NOT NULL
       OR (e.minimum_age IS NOT NULL AND EXTRACT(YEAR FROM age((s.starts_at AT TIME ZONE v.timezone)::date,bi.attendee_date_of_birth))<e.minimum_age)))
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='ATTENDEE_IDENTITY_PROOF_REQUIRED'; END IF;
  RETURN NEW;
END $$;
DROP TABLE ticket_attendees;
ALTER TABLE events DROP COLUMN age_tag;
COMMIT;
