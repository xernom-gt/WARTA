-- M3 Citizen Reports: reports and report media.
-- Source of truth:
--   docs/database/database-design.md §3.7, §3.8, §7 (indexes), §9.2 (M3).
-- reports.deleted_at is an M9 hardening addition (§9.2 note) and is absent
-- here on purpose.

CREATE TABLE reports (
    id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id           UUID          NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id              UUID          NOT NULL REFERENCES users (id),
    category             VARCHAR(30)   NULL,
    narrative            TEXT          NOT NULL,
    proposed_address     TEXT          NULL,
    latitude             DECIMAL(9,6)  NULL,
    longitude            DECIMAL(9,6)  NULL,
    distance_from_project DECIMAL(10,2) NULL,
    exif_status          VARCHAR(20)   NOT NULL,
    exif_notice          TEXT          NULL,
    status               VARCHAR(30)   NOT NULL,
    created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    submitted_at         TIMESTAMPTZ   NULL
);

CREATE TABLE report_media (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id       UUID          NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
    file_url        TEXT          NOT NULL,
    media_type      VARCHAR(20)   NOT NULL,
    exif_latitude   DECIMAL(9,6)  NULL,
    exif_longitude  DECIMAL(9,6)  NULL,
    exif_taken_at   TIMESTAMPTZ   NULL,
    is_geotag_valid BOOLEAN       NULL,
    sort_order      SMALLINT      NOT NULL CHECK (sort_order BETWEEN 0 AND 3),
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- §7: one row per (report, sort_order) keeps the 1-4 photo rule indexable.
CREATE UNIQUE INDEX report_media_sort_idx ON report_media (report_id, sort_order);

CREATE INDEX reports_project_created_idx ON reports (project_id, created_at);
CREATE INDEX reports_user_idx            ON reports (user_id);
CREATE INDEX reports_status_idx          ON reports (status);

CREATE TRIGGER reports_set_updated_at
    BEFORE UPDATE ON reports
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
