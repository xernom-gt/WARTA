-- M6 Additional Evidence: evidences and evidence media.
-- Source of truth:
--   docs/database/database-design.md §3.13, §3.14, §7, §9.2 (M6).

CREATE TABLE evidences (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id   UUID        NOT NULL REFERENCES reports (id) ON DELETE CASCADE,
    user_id     UUID        NOT NULL REFERENCES users (id),
    description TEXT        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE evidence_media (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    evidence_id     UUID          NOT NULL REFERENCES evidences (id) ON DELETE CASCADE,
    file_url        TEXT          NOT NULL,
    media_type      VARCHAR(20)   NOT NULL,
    exif_latitude   DECIMAL(9,6)  NULL,
    exif_longitude  DECIMAL(9,6)  NULL,
    exif_taken_at   TIMESTAMPTZ   NULL,
    is_geotag_valid BOOLEAN       NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX evidences_report_idx ON evidences (report_id);
CREATE INDEX evidences_user_idx   ON evidences (user_id);

CREATE TRIGGER evidences_set_updated_at
    BEFORE UPDATE ON evidences
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
