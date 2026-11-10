-- M7 Rollback: Drop views, triggers, and indexes.

DROP TRIGGER IF EXISTS trigger_rollup_project_status ON reports;
DROP FUNCTION IF EXISTS rollup_project_status();

DROP TRIGGER IF EXISTS trigger_handle_verification_vote ON verification_votes;
DROP FUNCTION IF EXISTS handle_verification_vote();

DROP VIEW IF EXISTS view_project_catalog;
DROP VIEW IF EXISTS view_verification_queue;
DROP VIEW IF EXISTS view_project_locations;

DROP INDEX IF EXISTS verification_items_pending_queue_idx;
DROP INDEX IF EXISTS project_risk_flags_project_id_idx;
DROP INDEX IF EXISTS project_locations_project_id_idx;
DROP INDEX IF EXISTS project_tenders_project_id_idx;
DROP INDEX IF EXISTS project_years_fiscal_year_idx;
DROP INDEX IF EXISTS projects_city_idx;
DROP INDEX IF EXISTS projects_status_idx;
DROP INDEX IF EXISTS projects_category_idx;
