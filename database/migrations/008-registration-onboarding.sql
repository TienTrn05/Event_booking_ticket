-- Reviewed registration state/preferences; preserve existing users, roles and history.
-- Back up before applying. New verified users complete onboarding before role grant.
BEGIN;
ALTER TABLE users
 ADD COLUMN registration_role VARCHAR(16) NULL,
 ADD COLUMN onboarding_completed_at TIMESTAMPTZ(6) NULL,
 ADD COLUMN favorite_categories VARCHAR(160)[] NOT NULL DEFAULT '{}',
 ADD COLUMN preferred_city VARCHAR(120) NULL,
 ADD CONSTRAINT ck_registration_role CHECK (registration_role IN ('CUSTOMER','ORGANIZER')),
 ADD CONSTRAINT ck_onboarding_complete CHECK (onboarding_completed_at IS NULL OR
   (registration_role IS NOT NULL AND gender IS NOT NULL AND date_of_birth IS NOT NULL)),
 ADD CONSTRAINT ck_user_categories CHECK (cardinality(favorite_categories)<=10);
-- Existing records remain pending until an explicit choice. Migration removes no role.
ALTER TABLE organizations RENAME COLUMN company_domain TO contact_domain;
ALTER TABLE organizations RENAME COLUMN company_identity_id TO applicant_identity_id;
ALTER TABLE organizations RENAME COLUMN company_identity_provider TO applicant_identity_provider;
ALTER TABLE organizations ALTER COLUMN contact_domain DROP NOT NULL,
 DROP CONSTRAINT ck_org_fields;
ALTER TABLE organizations ADD CONSTRAINT ck_org_fields CHECK (CHAR_LENGTH(TRIM(name))>0);
ALTER TABLE organizations DROP CONSTRAINT ck_org_company_provider;
ALTER TABLE organizations ADD CONSTRAINT ck_org_identity_provider CHECK (applicant_identity_provider IN ('GOOGLE','EMAIL','COMPANY_EMAIL'));
ALTER TABLE organization_memberships RENAME COLUMN company_identity_id TO member_identity_id;
ALTER TABLE organization_memberships RENAME COLUMN company_identity_provider TO member_identity_provider;
ALTER TABLE organization_memberships ALTER COLUMN approved_by DROP NOT NULL,
 ALTER COLUMN approved_at DROP NOT NULL,
 DROP CONSTRAINT ck_membership_provider,
 DROP CONSTRAINT ck_membership_status;
ALTER TABLE organization_memberships ADD CONSTRAINT ck_membership_provider CHECK (member_identity_provider IN ('GOOGLE','EMAIL','COMPANY_EMAIL')),
 ADD CONSTRAINT ck_membership_status CHECK (status IN ('PENDING','ACTIVE','REVOKED')),
 ADD CONSTRAINT ck_membership_approval CHECK ((status='PENDING' AND approved_by IS NULL AND approved_at IS NULL)
   OR (status IN ('ACTIVE','REVOKED') AND approved_by IS NOT NULL AND approved_at IS NOT NULL));
INSERT INTO role_permissions(role_id,permission_id)
 SELECT r.id,p.id FROM roles r CROSS JOIN permissions p WHERE r.code='ORGANIZER' AND p.code='organization.apply'
 ON CONFLICT DO NOTHING;
COMMIT;
