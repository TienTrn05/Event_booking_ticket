-- ADR-036: public event search projection; durable jobs reuse the existing outbox.
BEGIN;
CREATE FUNCTION enqueue_search_event(target_id BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE revision INTEGER;
BEGIN
 SELECT version INTO revision FROM events WHERE id=target_id;
 INSERT INTO outbox_messages(type,aggregate_type,aggregate_id,aggregate_version,dedupe_key,payload_minimal,available_at)
 VALUES('SEARCH_EVENT_SYNC','EVENT',target_id,COALESCE(revision,0),
   'search-event:'||target_id||':'||pg_current_xact_id()::text,'{}'::jsonb,clock_timestamp())
 ON CONFLICT(dedupe_key) DO NOTHING;
END; $$;
CREATE FUNCTION search_event_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN PERFORM enqueue_search_event(OLD.id); RETURN OLD; END IF;
 PERFORM enqueue_search_event(NEW.id); RETURN NEW;
END; $$;
CREATE TRIGGER trg_search_event AFTER INSERT OR DELETE OR UPDATE OF title,display_name,description,status,published_at,organization_id,category_id ON events
 FOR EACH ROW EXECUTE FUNCTION search_event_changed();
CREATE FUNCTION search_session_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN PERFORM enqueue_search_event(OLD.event_id); RETURN OLD; END IF;
 PERFORM enqueue_search_event(NEW.event_id);
 IF TG_OP='UPDATE' AND OLD.event_id<>NEW.event_id THEN PERFORM enqueue_search_event(OLD.event_id); END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_search_session AFTER INSERT OR DELETE OR UPDATE OF event_id,venue_id,starts_at,ends_at,status ON event_sessions
 FOR EACH ROW EXECUTE FUNCTION search_session_changed();
CREATE FUNCTION search_organization_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target BIGINT;
BEGIN
 FOR target IN SELECT id FROM events WHERE organization_id=NEW.id ORDER BY id LOOP PERFORM enqueue_search_event(target); END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_search_organization AFTER UPDATE OF name,status,public_id ON organizations
 FOR EACH ROW EXECUTE FUNCTION search_organization_changed();
CREATE FUNCTION search_venue_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target BIGINT;
BEGIN
 FOR target IN SELECT DISTINCT event_id FROM event_sessions WHERE venue_id=NEW.id ORDER BY event_id LOOP PERFORM enqueue_search_event(target); END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_search_venue AFTER UPDATE OF name,city ON venues
 FOR EACH ROW EXECUTE FUNCTION search_venue_changed();
CREATE FUNCTION search_category_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE target BIGINT;
BEGIN
 FOR target IN SELECT id FROM events WHERE category_id=NEW.id ORDER BY id LOOP PERFORM enqueue_search_event(target); END LOOP;
 RETURN NEW;
END; $$;
CREATE TRIGGER trg_search_category AFTER UPDATE OF slug ON event_categories
 FOR EACH ROW EXECUTE FUNCTION search_category_changed();
SELECT enqueue_search_event(id) FROM events ORDER BY id;
COMMIT;
