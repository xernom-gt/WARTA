-- Rollback of M9 Interim (reports soft delete).
DROP INDEX IF EXISTS reports_active_project_created_idx;
ALTER TABLE reports DROP COLUMN IF EXISTS deleted_at;
