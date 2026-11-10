-- M7 Read Models, Indexes, and Triggers
-- Source of truth:
--   docs/database/database-design.md §7 (Indexing Strategy), §8.6 (Status), §9.2 (M7), §10 (Read Models).
--   docs/api/api-requirements.md §3.2, §6.16, §10.

-- 1. Indexes from §7
CREATE INDEX projects_category_idx ON projects (category);
CREATE INDEX projects_status_idx   ON projects (status);
CREATE INDEX projects_city_idx     ON projects (city);

CREATE INDEX project_years_fiscal_year_idx   ON project_years (fiscal_year);
CREATE INDEX project_tenders_project_id_idx  ON project_tenders (project_id);
CREATE INDEX project_locations_project_id_idx ON project_locations (project_id);
CREATE INDEX project_risk_flags_project_id_idx ON project_risk_flags (project_id);

-- Partial index for active verification queue (§7)
CREATE INDEX verification_items_pending_queue_idx
    ON verification_items (status, created_at)
    WHERE status = 'menunggu';

-- 2. Read Models / Views (§10)
CREATE OR REPLACE VIEW view_project_locations AS
SELECT
    pl.id,
    pl.project_id,
    pl.name,
    pl.address,
    pl.city,
    pl.precision_level,
    pl.source,
    pl.latitude,
    pl.longitude,
    pl.is_verified,
    pl.is_primary,
    pl.created_at,
    pl.updated_at
FROM project_locations pl;

CREATE OR REPLACE VIEW view_verification_queue AS
SELECT
    vi.id,
    vi.project_id,
    vi.item_type,
    vi.report_id,
    vi.claim_id,
    vi.author_user_id,
    u.display_name AS author_display_name,
    vi.status,
    vi.target_votes,
    vi.votes_agree,
    vi.votes_disagree,
    vi.created_at,
    vi.resolved_at,
    r.category AS report_category,
    r.narrative AS report_narrative,
    r.proposed_address AS report_proposed_address,
    lc.proposed_address AS claim_proposed_address,
    lc.proposed_precision AS claim_proposed_precision
FROM verification_items vi
JOIN users u ON u.id = vi.author_user_id
LEFT JOIN reports r ON r.id = vi.report_id
LEFT JOIN location_claims lc ON lc.id = vi.claim_id;

CREATE OR REPLACE VIEW view_project_catalog AS
SELECT
    p.id,
    p.spse_code,
    p.title,
    p.satker,
    p.category,
    p.pagu_amount,
    p.hps_amount,
    p.contract_amount,
    p.contract_note,
    p.city,
    p.is_outside_dki,
    p.location_description,
    p.precision_level,
    p.location_source,
    p.is_canonical_claimed,
    p.status,
    p.created_at,
    p.updated_at,
    pl.address AS primary_address,
    pl.latitude AS primary_latitude,
    pl.longitude AS primary_longitude,
    COALESCE(rc.reports_count, 0) AS reports_count,
    COALESCE(vc.verifications_count, 0) AS verifications_count
FROM projects p
LEFT JOIN project_locations pl ON pl.project_id = p.id AND pl.is_primary = TRUE
LEFT JOIN (
    SELECT project_id, COUNT(*) AS reports_count
    FROM reports
    WHERE deleted_at IS NULL AND status != 'draft'
    GROUP BY project_id
) rc ON rc.project_id = p.id
LEFT JOIN (
    SELECT project_id, COUNT(*) AS verifications_count
    FROM verification_items
    GROUP BY project_id
) vc ON vc.project_id = p.id;

-- 3. Trigger: Vote counters & consensus resolution (§3.11, §3.12, §6.16)
CREATE OR REPLACE FUNCTION handle_verification_vote() RETURNS TRIGGER AS $$
DECLARE
    v_item RECORD;
    v_new_agree INT;
    v_new_disagree INT;
BEGIN
    SELECT 
        COUNT(*) FILTER (WHERE choice = 'setuju'),
        COUNT(*) FILTER (WHERE choice = 'tidak_setuju')
    INTO v_new_agree, v_new_disagree
    FROM verification_votes
    WHERE verification_item_id = NEW.verification_item_id;

    SELECT * INTO v_item FROM verification_items WHERE id = NEW.verification_item_id;

    IF v_new_agree >= v_item.target_votes AND v_item.status = 'menunggu' THEN
        IF v_item.item_type = 'klaim_lokasi' THEN
            UPDATE verification_items
            SET votes_agree = v_new_agree, votes_disagree = v_new_disagree,
                status = 'diterima', resolved_at = NOW()
            WHERE id = NEW.verification_item_id;

            UPDATE location_claims
            SET status = 'diterima', decided_at = NOW()
            WHERE id = v_item.claim_id;

            -- Demote previous primary location
            UPDATE project_locations
            SET is_primary = FALSE
            WHERE project_id = v_item.project_id AND is_primary = TRUE;

            -- Insert new primary location from accepted citizen claim
            INSERT INTO project_locations (
                project_id, name, address, city, precision_level, source, latitude, longitude, is_verified, is_primary
            )
            SELECT 
                lc.project_id, lc.landmark, lc.proposed_address, COALESCE(lc.city, p.city),
                lc.proposed_precision, 'warga', lc.latitude, lc.longitude, TRUE, TRUE
            FROM location_claims lc
            JOIN projects p ON p.id = lc.project_id
            WHERE lc.id = v_item.claim_id;

            UPDATE projects
            SET is_canonical_claimed = TRUE,
                precision_level = (SELECT proposed_precision FROM location_claims WHERE id = v_item.claim_id)
            WHERE id = v_item.project_id;
        ELSE
            UPDATE verification_items
            SET votes_agree = v_new_agree, votes_disagree = v_new_disagree,
                status = 'terverifikasi', resolved_at = NOW()
            WHERE id = NEW.verification_item_id;

            UPDATE reports
            SET status = 'terverifikasi'
            WHERE id = v_item.report_id;
        END IF;

    ELSIF v_new_disagree >= v_item.target_votes AND v_item.status = 'menunggu' THEN
        UPDATE verification_items
        SET votes_agree = v_new_agree, votes_disagree = v_new_disagree,
            status = 'ditolak', resolved_at = NOW()
        WHERE id = NEW.verification_item_id;

        IF v_item.item_type = 'klaim_lokasi' THEN
            UPDATE location_claims
            SET status = 'ditolak', decided_at = NOW()
            WHERE id = v_item.claim_id;
        ELSE
            UPDATE reports
            SET status = 'ditolak'
            WHERE id = v_item.report_id;
        END IF;
    ELSE
        UPDATE verification_items
        SET votes_agree = v_new_agree, votes_disagree = v_new_disagree
        WHERE id = NEW.verification_item_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_handle_verification_vote
AFTER INSERT ON verification_votes
FOR EACH ROW
EXECUTE FUNCTION handle_verification_vote();

-- 4. Trigger: Project status rollup from reports (§3.2 rule)
CREATE OR REPLACE FUNCTION rollup_project_status() RETURNS TRIGGER AS $$
DECLARE
    v_proj_id UUID;
    v_has_selesai BOOLEAN;
    v_has_terverifikasi BOOLEAN;
    v_total_submitted INT;
    v_total_ditolak INT;
    v_new_status VARCHAR(30);
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_proj_id := OLD.project_id;
    ELSE
        v_proj_id := NEW.project_id;
    END IF;

    SELECT
        BOOL_OR(status = 'selesai'),
        BOOL_OR(status = 'terverifikasi'),
        COUNT(*) FILTER (WHERE status != 'draft'),
        COUNT(*) FILTER (WHERE status = 'ditolak')
    INTO v_has_selesai, v_has_terverifikasi, v_total_submitted, v_total_ditolak
    FROM reports
    WHERE project_id = v_proj_id AND deleted_at IS NULL;

    IF v_has_selesai THEN
        v_new_status := 'selesai';
    ELSIF v_has_terverifikasi THEN
        v_new_status := 'terverifikasi';
    ELSIF v_total_submitted > 0 AND v_total_submitted = v_total_ditolak THEN
        v_new_status := 'ditolak';
    ELSE
        v_new_status := 'menunggu';
    END IF;

    UPDATE projects
    SET status = v_new_status
    WHERE id = v_proj_id AND status != v_new_status;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_rollup_project_status
AFTER INSERT OR UPDATE OF status, deleted_at OR DELETE ON reports
FOR EACH ROW
EXECUTE FUNCTION rollup_project_status();
