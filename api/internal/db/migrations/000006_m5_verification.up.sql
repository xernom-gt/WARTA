-- M5 Verification: the unified queue and its votes.
-- Source of truth:
--   docs/database/database-design.md §3.11, §3.12, §7 (indexes), §9.2 (M5).
-- Created after reports and claims exist (§9.3 rule 4).

CREATE TABLE verification_items (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         UUID         NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
    item_type          VARCHAR(30)  NOT NULL,
    report_id          UUID         NULL REFERENCES reports (id) ON DELETE CASCADE,
    claim_id           UUID         NULL REFERENCES location_claims (id) ON DELETE CASCADE,
    author_user_id     UUID         NOT NULL REFERENCES users (id),
    status             VARCHAR(30)  NOT NULL,
    target_votes       SMALLINT     NOT NULL DEFAULT 3 CHECK (target_votes >= 1),
    votes_agree        INTEGER      NOT NULL DEFAULT 0 CHECK (votes_agree >= 0),
    votes_disagree     INTEGER      NOT NULL DEFAULT 0 CHECK (votes_disagree >= 0),
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    resolved_at        TIMESTAMPTZ  NULL,
    -- §3.11: exactly one subject, and item_type must match it.
    CHECK (
        (report_id IS NOT NULL AND claim_id IS NULL AND item_type = 'laporan_kondisi')
        OR
        (report_id IS NULL AND claim_id IS NOT NULL AND item_type = 'klaim_lokasi')
    )
);

CREATE TABLE verification_votes (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    verification_item_id UUID        NOT NULL REFERENCES verification_items (id) ON DELETE CASCADE,
    user_id              UUID        NOT NULL REFERENCES users (id),
    choice               VARCHAR(20) NOT NULL,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- §3.12: a constrained (item, subject) uniqueness and one vote per voter.
CREATE UNIQUE INDEX verification_items_report_idx ON verification_items (report_id);
CREATE UNIQUE INDEX verification_items_claim_idx  ON verification_items (claim_id);
CREATE UNIQUE INDEX verification_votes_once_idx
    ON verification_votes (verification_item_id, user_id);

CREATE INDEX verification_items_project_idx ON verification_items (project_id);
CREATE INDEX verification_items_status_idx  ON verification_items (status);
CREATE INDEX verification_votes_item_idx    ON verification_votes (verification_item_id);
CREATE INDEX verification_votes_user_idx    ON verification_votes (user_id, created_at);
