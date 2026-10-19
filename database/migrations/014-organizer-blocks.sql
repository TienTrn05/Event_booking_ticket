-- Personal visibility preference, independent from following and account permissions.
BEGIN;
CREATE TABLE organization_blocks (
  user_id BIGINT NOT NULL REFERENCES users(id),
  organization_id BIGINT NOT NULL REFERENCES organizations(id),
  created_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY(user_id,organization_id)
);
CREATE INDEX ix_organization_blocks_organization ON organization_blocks(organization_id,user_id);
COMMIT;
