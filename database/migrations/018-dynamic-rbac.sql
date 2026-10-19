-- ADR-040: additive role administration. Back up before applying to an existing DB.
-- No UserRole grants; rbac.manage is granted only to the existing system ADMIN role.
BEGIN;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM roles WHERE code NOT IN ('CUSTOMER','ORGANIZER','ADMIN')) THEN
  RAISE EXCEPTION 'Review existing custom roles before migration 018';
 END IF;
END $$;
ALTER TABLE roles ADD COLUMN base_role VARCHAR(16),
 ADD COLUMN description VARCHAR(500) NOT NULL DEFAULT '',
 ADD COLUMN status VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
 ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
UPDATE roles SET base_role=code;
ALTER TABLE roles ALTER COLUMN base_role SET NOT NULL;
ALTER TABLE roles ADD CONSTRAINT ck_roles_base CHECK(base_role IN ('CUSTOMER','ORGANIZER','ADMIN')),
 ADD CONSTRAINT ck_roles_status CHECK(status IN ('ACTIVE','ARCHIVED')),
 ADD CONSTRAINT ck_roles_version CHECK(version>=0),
 ADD CONSTRAINT ck_roles_system CHECK(code NOT IN ('CUSTOMER','ORGANIZER','ADMIN') OR (base_role=code AND status='ACTIVE'));
ALTER TABLE users ADD COLUMN roles_version INTEGER NOT NULL DEFAULT 0,
 ADD CONSTRAINT ck_users_roles_version CHECK(roles_version>=0);
-- Keep existing idempotent reference seeds compatible (they insert code/name).
CREATE FUNCTION rbac_default_base_role() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.base_role IS NULL AND NEW.code IN ('CUSTOMER','ORGANIZER','ADMIN') THEN NEW.base_role=NEW.code; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tr_rbac_default_base_role BEFORE INSERT ON roles
 FOR EACH ROW EXECUTE FUNCTION rbac_default_base_role();
INSERT INTO roles(code,name,base_role)
 SELECT v.code,v.name,v.code FROM (VALUES
 ('CUSTOMER','Khách mua vé'),('ORGANIZER','Đại diện tổ chức'),('ADMIN','Quản trị viên')) v(code,name)
 WHERE NOT EXISTS(SELECT 1 FROM roles r WHERE r.code=v.code);
INSERT INTO permissions(code,description) VALUES('rbac.manage','Admin quản trị role, cấp và thu hồi quyền có xác thực lại và audit') ON CONFLICT(code) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='ADMIN' AND p.code='rbac.manage'
ON CONFLICT DO NOTHING;

-- Keep assignment preconditions valid even when a system role is removed later.
-- API enforces audience, immutable system roles, last Admin and self-change policy.
CREATE FUNCTION rbac_assignment_changed() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 UPDATE users SET roles_version=roles_version+1 WHERE id=COALESCE(NEW.user_id,OLD.user_id);
 IF TG_OP='UPDATE' AND OLD.user_id<>NEW.user_id THEN
  UPDATE users SET roles_version=roles_version+1 WHERE id=OLD.user_id;
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER tr_rbac_assignment_version AFTER INSERT OR UPDATE OR DELETE ON user_roles
 FOR EACH ROW EXECUTE FUNCTION rbac_assignment_changed();
CREATE FUNCTION rbac_active_role_guard() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='user_roles' THEN
  PERFORM 1 FROM roles WHERE id=NEW.role_id AND status='ACTIVE' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cannot assign an archived role' USING ERRCODE='23514'; END IF;
 ELSE
  IF NEW.status='ARCHIVED' AND EXISTS(SELECT 1 FROM user_roles WHERE role_id=NEW.id) THEN
   RAISE EXCEPTION 'Revoke assignments before archiving a role' USING ERRCODE='23514';
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER tr_rbac_active_assignment BEFORE INSERT OR UPDATE ON user_roles
 FOR EACH ROW EXECUTE FUNCTION rbac_active_role_guard();
CREATE TRIGGER tr_rbac_role_archive BEFORE UPDATE ON roles
 FOR EACH ROW EXECUTE FUNCTION rbac_active_role_guard();
CREATE FUNCTION dynamic_rbac_installed() RETURNS BOOLEAN LANGUAGE sql IMMUTABLE AS $$ SELECT TRUE $$;
COMMIT;
