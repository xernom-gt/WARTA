-- M4 Location Claims: location claims and claim media.
-- Source of truth:
--   docs/database/database-design.md §3.9, §3.10, §7 (indexes), §9.2 (M4).

CREATE TABLE location_claims (
    id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id            UUID          NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    user_id               UUID          NOT NULL REFERENCES users (id),
    proposed_address      TEXT          NOT NULL,
    address_line          TEXT          NULL,
    kelurahan             VARCHAR(100)  NULL,
    kecamatan             VARCHAR(100)  NOT NULL,
    city                  VARCHAR(100)  NULL,
    landmark              VARCHAR(255)  NULL,
    proposed_precision    VARCHAR(30)   NOT NULL,
    latitude              DECIMAL(9,6)  NULL,
    longitude             DECIMAL(9,6)  NULL,
    distance_from_project DECIMAL(10,2) NULL,
    exif_status           VARCHAR(20)   NOT NULL,
    exif_notice           TEXT          NULL,
    status                VARCHAR(30)   NOT NULL,
    created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    decided_at            TIMESTAMPTZ   NULL
);

CREATE TABLE claim_media (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    claim_id        UUID          NOT NULL REFERENCES location_claims (id) ON DELETE CASCADE,
    file_url        TEXT          NOT NULL,
    media_type      VARCHAR(20)   NOT NULL,
    exif_latitude   DECIMAL(9,6)  NULL,
    exif_longitude  DECIMAL(9,6)  NULL,
    exif_taken_at   TIMESTAMPTZ   NULL,
    is_geotag_valid BOOLEAN       NULL,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX location_claims_project_idx ON location_claims (project_id);
CREATE INDEX location_claims_user_idx    ON location_claims (user_id);
CREATE INDEX location_claims_status_idx  ON location_claims (status);

CREATE TRIGGER location_claims_set_updated_at
    BEFORE UPDATE ON location_claims
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
