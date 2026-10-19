-- ADR-037: outdoor zones share the existing allocation/payment/ticket lifecycle.
BEGIN;
ALTER TABLE events ADD COLUMN ticketing_mode VARCHAR(16) NOT NULL DEFAULT 'NUMBERED' CHECK(ticketing_mode IN ('NUMBERED','QUANTITY'));
ALTER TABLE events DISABLE TRIGGER trg_events_updated_at;
UPDATE events SET ticketing_mode='QUANTITY' WHERE admission_type='QUANTITY';
ALTER TABLE events ENABLE TRIGGER trg_events_updated_at;
ALTER TABLE seat_layouts ADD COLUMN ticketing_mode VARCHAR(16) NOT NULL DEFAULT 'NUMBERED' CHECK(ticketing_mode IN ('NUMBERED','QUANTITY'));
ALTER TABLE layout_sections ADD COLUMN capacity INTEGER CHECK(capacity BETWEEN 1 AND 100000), ADD COLUMN geometry_json JSONB;
ALTER TABLE layout_sections ADD CONSTRAINT ck_zone_definition CHECK((capacity IS NULL AND geometry_json IS NULL) OR (capacity IS NOT NULL AND geometry_json IS NOT NULL AND jsonb_typeof(geometry_json)='object'));
ALTER TABLE session_seats ALTER COLUMN seat_id DROP NOT NULL;
ALTER TABLE session_seats ADD COLUMN section_id BIGINT, ADD COLUMN inventory_number INTEGER;
ALTER TABLE session_seats ADD CONSTRAINT fk_inventory_section FOREIGN KEY(section_id,layout_id) REFERENCES layout_sections(id,layout_id),
 ADD CONSTRAINT ck_inventory_kind CHECK((seat_id IS NOT NULL AND section_id IS NULL AND inventory_number IS NULL) OR (seat_id IS NULL AND section_id IS NOT NULL AND inventory_number IS NOT NULL AND inventory_number>0)),
 ADD CONSTRAINT uq_zone_inventory UNIQUE(session_id,section_id,inventory_number);
CREATE INDEX ix_inventory_zone_availability ON session_seats(session_id,section_id,status,id);
CREATE FUNCTION validate_zone_inventory() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE limit_count INTEGER; layout_mode VARCHAR(16);
BEGIN
 SELECT ticketing_mode INTO layout_mode FROM seat_layouts WHERE id=NEW.layout_id;
 IF NEW.section_id IS NOT NULL THEN
  SELECT capacity INTO limit_count FROM layout_sections WHERE id=NEW.section_id AND layout_id=NEW.layout_id;
  IF layout_mode<>'QUANTITY' OR limit_count IS NULL OR NEW.inventory_number>limit_count THEN RAISE EXCEPTION 'Invalid zone inventory' USING ERRCODE='23514'; END IF;
 ELSIF layout_mode<>'NUMBERED' THEN RAISE EXCEPTION 'Invalid numbered inventory' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_inventory_kind BEFORE INSERT OR UPDATE OF seat_id,section_id,inventory_number,layout_id ON session_seats FOR EACH ROW EXECUTE FUNCTION validate_zone_inventory();
COMMIT;
