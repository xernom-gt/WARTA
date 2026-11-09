-- M9 Interim (reports soft delete): adds deleted_at for pending report withdrawal.
-- Source of truth:
--   docs/database/database-design.md §3.7, §7 (partial index), §9.2 (M9).
--   docs/api/api-requirements.md §6.14, §17.

ALTER TABLE reports
    ADD COLUMN deleted_at TIMESTAMPTZ NULL;

CREATE INDEX reports_active_project_created_idx
    ON reports (project_id, created_at)
    WHERE deleted_at IS NULL;
