-- Admin follow-up attributes for verification items
ALTER TABLE verification_items ADD COLUMN IF NOT EXISTS admin_status VARCHAR(30) NULL;
ALTER TABLE verification_items ADD COLUMN IF NOT EXISTS admin_note TEXT NULL;
CREATE INDEX IF NOT EXISTS verification_items_admin_status_idx ON verification_items (admin_status);
