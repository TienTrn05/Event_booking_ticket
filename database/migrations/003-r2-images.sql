-- ADR-022. Review and back up the selected database before applying.
-- Additive migration: no binary image data; URLs reference objects stored in R2.
BEGIN;
ALTER TABLE users ADD COLUMN avatar_url VARCHAR(1000) NULL;
ALTER TABLE events ADD COLUMN cover_image_url VARCHAR(1000) NULL;
COMMIT;
-- Recovery: restore backup, or revert application code and keep these nullable columns.
