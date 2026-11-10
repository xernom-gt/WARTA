-- M9 Rollback: Drop search indexes and search_vector column.

DROP INDEX IF EXISTS projects_title_trgm_gin_idx;
DROP INDEX IF EXISTS projects_search_vector_gin_idx;
ALTER TABLE projects DROP COLUMN IF EXISTS search_vector;
