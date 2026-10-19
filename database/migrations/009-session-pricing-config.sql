-- Draft prices are configuration. Inventory is materialized only by review approval.
BEGIN;
ALTER TABLE event_sessions ADD COLUMN pricing_config JSONB NULL,
 ADD CONSTRAINT ck_session_pricing CHECK (pricing_config IS NULL OR jsonb_typeof(pricing_config)='array');
COMMIT;
