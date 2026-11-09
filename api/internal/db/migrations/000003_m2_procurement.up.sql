-- M2 Procurement: projects and their procurement-side children.
-- Source of truth:
--   docs/database/database-design.md §3.2-§3.6, §7 (indexes), §9.2 (M2).
--
-- search_vector is deliberately absent: per §9.2's implementation note it is
-- an M9 hardening addition for this repo, together with its GIN index.

CREATE TABLE projects (
    id                 UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
    spse_code          VARCHAR(32)    UNIQUE NOT NULL,
    title              VARCHAR(255)   NOT NULL,
    satker             VARCHAR(255)   NOT NULL,
    category           VARCHAR(100)   NOT NULL,
    pagu_amount        NUMERIC(20,2)  NOT NULL CHECK (pagu_amount >= 0),
    hps_amount         NUMERIC(20,2)  NOT NULL CHECK (hps_amount >= 0),
    contract_amount    NUMERIC(20,2)  NULL CHECK (contract_amount IS NULL OR contract_amount >= 0),
    contract_note      TEXT           NULL,
    city               VARCHAR(100)   NOT NULL,
    is_outside_dki     BOOLEAN        NOT NULL DEFAULT FALSE,
    location_description TEXT         NOT NULL,
    precision_level    VARCHAR(30)    NOT NULL,
    location_source    VARCHAR(20)    NOT NULL,
    is_canonical_claimed BOOLEAN      NOT NULL DEFAULT FALSE,
    precision_resolution_note TEXT    NULL,
    status             VARCHAR(30)    NOT NULL,
    source_note        TEXT           NULL,
    created_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

CREATE TABLE project_years (
    project_id  UUID     NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    fiscal_year SMALLINT NOT NULL CHECK (fiscal_year BETWEEN 2000 AND 2100),
    PRIMARY KEY (project_id, fiscal_year)
);

CREATE TABLE project_tenders (
    id         UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID          NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    spse_code  VARCHAR(32)   UNIQUE NOT NULL,
    status     VARCHAR(30)   NOT NULL,
    note       TEXT          NULL,
    created_at TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE TABLE project_locations (
    id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID          NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    name            VARCHAR(255)  NULL,
    address         TEXT          NOT NULL,
    city            VARCHAR(100)  NOT NULL,
    precision_level VARCHAR(30)   NOT NULL,
    source          VARCHAR(20)   NOT NULL,
    latitude        DECIMAL(9,6)  NULL,
    longitude       DECIMAL(9,6)  NULL,
    is_verified     BOOLEAN       NOT NULL DEFAULT FALSE,
    is_primary      BOOLEAN       NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    CHECK (latitude IS NULL AND longitude IS NULL
        OR latitude IS NOT NULL AND longitude IS NOT NULL)
);

-- §3.5: exactly one primary location per project.
CREATE UNIQUE INDEX project_locations_primary_idx
    ON project_locations (project_id)
    WHERE is_primary;

CREATE TABLE project_risk_flags (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id  UUID         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    code        VARCHAR(50)  NOT NULL,
    label       VARCHAR(255) NOT NULL,
    description TEXT         NOT NULL,
    level       VARCHAR(20)  NOT NULL,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- §3.6: at most one active flag per code on a project.
CREATE UNIQUE INDEX project_risk_flags_code_idx
    ON project_risk_flags (project_id, code);

CREATE TRIGGER projects_set_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER project_locations_set_updated_at
    BEFORE UPDATE ON project_locations
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
