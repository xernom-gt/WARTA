DROP INDEX IF EXISTS verification_items_admin_status_idx;
ALTER TABLE verification_items DROP COLUMN IF EXISTS admin_note;
ALTER TABLE verification_items DROP COLUMN IF EXISTS admin_status;
