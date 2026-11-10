-- M9 Verification & Search Hardening
-- Source of truth:
--   docs/database/database-design.md §3.2, §7 (Indexing Strategy), §9.2 (M9).
--   docs/api/api-requirements.md §10.4 (Hybrid Search), §17.

-- 1. Trigram extension for typo-tolerant fallback search (§7, §10.4)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 2. Ensure indonesian text search config exists in standard Postgres environments
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'indonesian') THEN
        CREATE TEXT SEARCH CONFIGURATION indonesian (COPY = simple);
    END IF;
END $$;

-- 3. Generated search_vector on projects table (§3.2, §7)
ALTER TABLE projects
    ADD COLUMN search_vector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('indonesian',
            COALESCE(title, '') || ' ' ||
            COALESCE(satker, '') || ' ' ||
            COALESCE(category, '') || ' ' ||
            COALESCE(city, '')
        )
    ) STORED;

-- 4. GIN indexes for full-text search and trigram title matching (§7)
CREATE INDEX projects_search_vector_gin_idx ON projects USING GIN (search_vector);
CREATE INDEX projects_title_trgm_gin_idx    ON projects USING GIN (title gin_trgm_ops);
