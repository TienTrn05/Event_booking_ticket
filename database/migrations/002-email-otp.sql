-- ADR-021: review and back up before applying to an existing ADR-014/017 database.
-- Additive migration; existing Google users, identities and sessions are preserved.
SET client_encoding = 'UTF8';
SET TIME ZONE 'UTC';
BEGIN;
ALTER TABLE external_identities DROP CONSTRAINT ck_identity_provider;
ALTER TABLE external_identities ADD CONSTRAINT ck_identity_provider CHECK (provider IN ('GOOGLE','PHONE','EMAIL','COMPANY_EMAIL'));
ALTER TABLE external_identities DROP CONSTRAINT ck_identity_email;
ALTER TABLE external_identities ADD CONSTRAINT ck_identity_email CHECK (
  (provider='PHONE' AND email_canonical IS NULL AND email_verified_at IS NULL AND hosted_domain IS NULL)
  OR (provider IN ('EMAIL','COMPANY_EMAIL') AND email_canonical IS NOT NULL AND email_verified_at IS NOT NULL AND hosted_domain IS NULL AND subject=email_canonical)
  OR (provider='GOOGLE' AND (email_verified_at IS NULL OR email_canonical IS NOT NULL))
);
ALTER TABLE otp_challenges DROP CONSTRAINT ck_otp_channel;
ALTER TABLE otp_challenges ADD CONSTRAINT ck_otp_channel CHECK (channel IN ('PHONE','EMAIL','COMPANY_EMAIL'));
ALTER TABLE otp_challenges ADD COLUMN login_phone VARCHAR(16) NULL;
ALTER TABLE otp_challenges ADD COLUMN delivery_ready BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE otp_challenges ADD CONSTRAINT ck_otp_login_phone CHECK (login_phone IS NULL OR (channel='EMAIL' AND login_phone ~ '^\+[1-9][0-9]{7,14}$'));
CREATE TABLE phone_login_aliases (
  phone VARCHAR(16) PRIMARY KEY,
  email_identity_id BIGINT NOT NULL REFERENCES external_identities(id),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  CONSTRAINT ck_login_alias_phone CHECK (phone ~ '^\+[1-9][0-9]{7,14}$')
);
CREATE INDEX ix_login_alias_identity ON phone_login_aliases(email_identity_id);
CREATE INDEX ix_identity_google_email ON external_identities(email_canonical) WHERE provider='GOOGLE';
COMMIT;
-- Rollback: only before EMAIL identities/aliases/challenges are used. After use, retain
-- data and restore the application release with email OTP disabled; do not drop user data.
