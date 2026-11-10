package verification

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGQueueStore implements QueueStore using PostgreSQL.
type PGQueueStore struct {
	pool *pgxpool.Pool
}

// NewPGQueueStore wraps a pgx connection pool.
func NewPGQueueStore(pool *pgxpool.Pool) *PGQueueStore {
	return &PGQueueStore{pool: pool}
}

// ListQueue queries verification items joined to projects, authors, reports, and claims.
// Filters out deactivated authors (u.is_active = false) and withdrawn reports (r.deleted_at IS NOT NULL).
// Default sorting: vi.created_at ASC (§10.3 oldest first).
func (s *PGQueueStore) ListQueue(ctx context.Context, filter QueueFilter) (*QueueResult, error) {
	page, limit := ClampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	whereClauses := []string{
		"u.is_active = true",
		"(r.deleted_at IS NULL OR r.id IS NULL)",
	}
	args := []any{}
	argIdx := 1

	if filter.Status != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("vi.status = $%d", argIdx))
		args = append(args, string(*filter.Status))
		argIdx++
	}

	if filter.ItemType != nil {
		whereClauses = append(whereClauses, fmt.Sprintf("vi.item_type = $%d", argIdx))
		args = append(args, string(*filter.ItemType))
		argIdx++
	}

	if filter.ProjectID != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("vi.project_id = $%d", argIdx))
		args = append(args, filter.ProjectID)
		argIdx++
	}

	whereSQL := " WHERE " + strings.Join(whereClauses, " AND ")

	countQuery := `
		SELECT COUNT(*)
		FROM verification_items vi
		JOIN users u ON u.id = vi.author_user_id
		LEFT JOIN reports r ON r.id = vi.report_id
	` + whereSQL

	var total int
	if err := s.pool.QueryRow(ctx, countQuery, args...).Scan(&total); err != nil {
		return nil, fmt.Errorf("queue count query: %w", err)
	}

	selectQuery := fmt.Sprintf(`
		SELECT
			vi.id, vi.project_id, p.title, p.spse_code, p.satker, p.pagu_amount::text,
			vi.item_type, vi.report_id, vi.claim_id,
			vi.author_user_id, u.display_name, u.is_active,
			COALESCE(r.category, NULL) AS category,
			COALESCE(r.narrative, lc.landmark) AS narrative,
			COALESCE(r.proposed_address, lc.proposed_address) AS proposed_address,
			lc.proposed_precision,
			COALESCE(r.latitude, lc.latitude) AS latitude,
			COALESCE(r.longitude, lc.longitude) AS longitude,
			COALESCE(r.distance_from_project, lc.distance_from_project) AS distance_from_project,
			COALESCE(r.exif_status, lc.exif_status, 'missing') AS exif_status,
			COALESCE(r.exif_notice, lc.exif_notice) AS exif_notice,
			COALESCE(
				(SELECT rm.file_url FROM report_media rm WHERE rm.report_id = r.id ORDER BY rm.sort_order ASC LIMIT 1),
				(SELECT cm.file_url FROM claim_media cm WHERE cm.claim_id = lc.id LIMIT 1)
			) AS photo_url,
			vi.votes_agree, vi.votes_disagree, vi.target_votes,
			COALESCE(
				(SELECT array_agg(vu.display_name ORDER BY vv.created_at ASC)
				 FROM verification_votes vv
				 JOIN users vu ON vu.id = vv.user_id
				 WHERE vv.verification_item_id = vi.id),
				ARRAY[]::varchar[]
			) AS voters,
			vi.status, vi.created_at, vi.resolved_at
		FROM verification_items vi
		JOIN projects p ON p.id = vi.project_id
		JOIN users u ON u.id = vi.author_user_id
		LEFT JOIN reports r ON r.id = vi.report_id
		LEFT JOIN location_claims lc ON lc.id = vi.claim_id
		%s
		ORDER BY vi.created_at ASC, vi.id ASC
		LIMIT $%d OFFSET $%d
	`, whereSQL, argIdx, argIdx+1)

	args = append(args, limit, offset)

	rows, err := s.pool.Query(ctx, selectQuery, args...)
	if err != nil {
		return nil, fmt.Errorf("queue query: %w", err)
	}
	defer rows.Close()

	items := make([]ItemView, 0, limit)
	for rows.Next() {
		var it VerificationItem
		var statusStr string
		var voters []string

		err := rows.Scan(
			&it.ID, &it.ProjectID, &it.ProjectTitle, &it.SPSECode, &it.Satker, &it.PaguAmount,
			&it.ItemType, &it.ReportID, &it.ClaimID,
			&it.AuthorUserID, &it.AuthorDisplayName, &it.AuthorIsActive,
			&it.Category,
			&it.Narrative,
			&it.ProposedAddress,
			&it.ProposedPrecision,
			&it.Latitude,
			&it.Longitude,
			&it.DistanceFromProjectM,
			&it.ExifStatus,
			&it.ExifNotice,
			&it.PhotoURL,
			&it.VotesAgree, &it.VotesDisagree, &it.TargetVotes,
			&voters,
			&statusStr, &it.CreatedAt, &it.ResolvedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("scan queue item: %w", err)
		}
		it.Status = ItemStatus(statusStr)
		it.Voters = voters
		items = append(items, it.View())
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &QueueResult{
		Data: items,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(items) < total,
		},
	}, nil
}

// GetItemByID returns one verification item by ID with full fields.
func (s *PGQueueStore) GetItemByID(ctx context.Context, itemID string) (*VerificationItem, error) {
	query := `
		SELECT
			vi.id, vi.project_id, p.title, p.spse_code, p.satker, p.pagu_amount::text,
			vi.item_type, vi.report_id, vi.claim_id,
			vi.author_user_id, u.display_name, u.is_active,
			COALESCE(r.category, NULL) AS category,
			COALESCE(r.narrative, lc.landmark) AS narrative,
			COALESCE(r.proposed_address, lc.proposed_address) AS proposed_address,
			lc.proposed_precision,
			COALESCE(r.latitude, lc.latitude) AS latitude,
			COALESCE(r.longitude, lc.longitude) AS longitude,
			COALESCE(r.distance_from_project, lc.distance_from_project) AS distance_from_project,
			COALESCE(r.exif_status, lc.exif_status, 'missing') AS exif_status,
			COALESCE(r.exif_notice, lc.exif_notice) AS exif_notice,
			COALESCE(
				(SELECT rm.file_url FROM report_media rm WHERE rm.report_id = r.id ORDER BY rm.sort_order ASC LIMIT 1),
				(SELECT cm.file_url FROM claim_media cm WHERE cm.claim_id = lc.id LIMIT 1)
			) AS photo_url,
			vi.votes_agree, vi.votes_disagree, vi.target_votes,
			COALESCE(
				(SELECT array_agg(vu.display_name ORDER BY vv.created_at ASC)
				 FROM verification_votes vv
				 JOIN users vu ON vu.id = vv.user_id
				 WHERE vv.verification_item_id = vi.id),
				ARRAY[]::varchar[]
			) AS voters,
			vi.status, vi.created_at, vi.resolved_at
		FROM verification_items vi
		JOIN projects p ON p.id = vi.project_id
		JOIN users u ON u.id = vi.author_user_id
		LEFT JOIN reports r ON r.id = vi.report_id
		LEFT JOIN location_claims lc ON lc.id = vi.claim_id
		WHERE vi.id = $1
	`

	var it VerificationItem
	var statusStr string
	var voters []string

	err := s.pool.QueryRow(ctx, query, itemID).Scan(
		&it.ID, &it.ProjectID, &it.ProjectTitle, &it.SPSECode, &it.Satker, &it.PaguAmount,
		&it.ItemType, &it.ReportID, &it.ClaimID,
		&it.AuthorUserID, &it.AuthorDisplayName, &it.AuthorIsActive,
		&it.Category,
		&it.Narrative,
		&it.ProposedAddress,
		&it.ProposedPrecision,
		&it.Latitude,
		&it.Longitude,
		&it.DistanceFromProjectM,
		&it.ExifStatus,
		&it.ExifNotice,
		&it.PhotoURL,
		&it.VotesAgree, &it.VotesDisagree, &it.TargetVotes,
		&voters,
		&statusStr, &it.CreatedAt, &it.ResolvedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrItemNotFound
		}
		return nil, err
	}

	it.Status = ItemStatus(statusStr)
	it.Voters = voters
	return &it, nil
}

