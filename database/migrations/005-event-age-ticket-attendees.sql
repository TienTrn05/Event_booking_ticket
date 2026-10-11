-- ADR-023: minimum age at the session's venue-local date; per-ticket self-declared
-- attendee data, CCCD encrypted, checked against physical ID at admission.
-- Back up before applying. No age integer or identity-document photos are stored.
BEGIN;
ALTER TABLE events ADD COLUMN minimum_age SMALLINT NULL,
  ADD COLUMN age_tag VARCHAR(8) GENERATED ALWAYS AS
    (CASE WHEN minimum_age IS NULL THEN NULL ELSE minimum_age::text||'+' END) STORED,
  ADD CONSTRAINT ck_event_minimum_age CHECK (minimum_age BETWEEN 1 AND 32767);
CREATE TABLE ticket_attendees (
  booking_item_id BIGINT PRIMARY KEY REFERENCES booking_items(id),
  full_name VARCHAR(200) NOT NULL,
  date_of_birth DATE NOT NULL,
  phone VARCHAR(16) NOT NULL,
  cccd_ciphertext BYTEA NULL,
  cccd_mac BYTEA NULL,
  cccd_last_four CHAR(4) NULL,
  pii_key_version VARCHAR(32) NULL,
  cccd_purge_after TIMESTAMPTZ(6) NOT NULL,
  cccd_purged_at TIMESTAMPTZ(6) NULL,
  identity_verified_at TIMESTAMPTZ(6) NULL,
  identity_verified_by BIGINT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  updated_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT ck_attendee_name CHECK (char_length(trim(full_name))>0),
  CONSTRAINT ck_attendee_birth CHECK (date_of_birth>=DATE '0001-01-01'),
  CONSTRAINT ck_attendee_phone CHECK (phone ~ '^\+[1-9][0-9]{7,14}$'),
  CONSTRAINT ck_attendee_pii CHECK (
    (cccd_purged_at IS NULL AND cccd_ciphertext IS NOT NULL AND cccd_mac IS NOT NULL AND cccd_last_four IS NOT NULL AND pii_key_version IS NOT NULL)
    OR (cccd_purged_at IS NOT NULL AND cccd_ciphertext IS NULL AND cccd_mac IS NULL AND cccd_last_four IS NULL AND pii_key_version IS NULL)),
  CONSTRAINT ck_attendee_verified CHECK ((identity_verified_at IS NULL AND identity_verified_by IS NULL)
    OR (identity_verified_at IS NOT NULL AND identity_verified_by IS NOT NULL))
);
CREATE INDEX ix_attendee_pii_purge ON ticket_attendees(cccd_purge_after) WHERE cccd_purged_at IS NULL;
CREATE TRIGGER trg_ticket_attendees_updated_at BEFORE UPDATE ON ticket_attendees
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Future payment/ticket implementations cannot confirm a new purchase or admit
-- an attendee without the required credentials, even if a service omits a check.
CREATE FUNCTION require_booking_attendees() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='CONFIRMED' AND OLD.status IS DISTINCT FROM NEW.status THEN
    IF NOT EXISTS(SELECT 1 FROM booking_items WHERE booking_id=NEW.id)
      OR EXISTS(SELECT 1 FROM booking_items bi LEFT JOIN ticket_attendees a ON a.booking_item_id=bi.id
        JOIN event_sessions s ON s.id=bi.session_id JOIN venues v ON v.id=s.venue_id
        JOIN events e ON e.id=s.event_id WHERE bi.booking_id=NEW.id AND
          (a.booking_item_id IS NULL OR a.cccd_purged_at IS NOT NULL OR a.date_of_birth>CURRENT_DATE
           OR a.full_name<>bi.attendee_name_snapshot
           OR (e.minimum_age IS NOT NULL AND EXTRACT(YEAR FROM age((s.starts_at AT TIME ZONE v.timezone)::date,a.date_of_birth))<e.minimum_age)))
    THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='ATTENDEE_CREDENTIALS_REQUIRED'; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_booking_attendees BEFORE UPDATE OF status ON bookings
  FOR EACH ROW EXECUTE FUNCTION require_booking_attendees();
CREATE FUNCTION require_ticket_age_proof() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status='USED' AND OLD.status IS DISTINCT FROM NEW.status AND EXISTS(
    SELECT 1 FROM booking_items bi JOIN event_sessions s ON s.id=bi.session_id JOIN venues v ON v.id=s.venue_id
      JOIN events e ON e.id=s.event_id LEFT JOIN ticket_attendees a ON a.booking_item_id=bi.id
    WHERE bi.id=NEW.booking_item_id AND
      (a.booking_item_id IS NULL OR a.identity_verified_at IS NULL OR a.cccd_purged_at IS NOT NULL
       OR (e.minimum_age IS NOT NULL AND EXTRACT(YEAR FROM age((s.starts_at AT TIME ZONE v.timezone)::date,a.date_of_birth))<e.minimum_age)))
  THEN RAISE EXCEPTION USING ERRCODE='23514',MESSAGE='ATTENDEE_IDENTITY_PROOF_REQUIRED'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_ticket_age_proof BEFORE UPDATE OF status ON tickets
  FOR EACH ROW EXECUTE FUNCTION require_ticket_age_proof();
COMMIT;
-- Recovery: restore backup. Do not drop ticket/booking history or retain raw CCCD logs.
