package report

import (
	"context"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore reads reports from PostgreSQL (migration M3). The author display
// name and photo rows are joined per §7.1/§3.8: `author_display_name` comes
// from users, `media` from report_media, and `evidences_count` from evidences.
type PGStore struct {
	pool *pgxpool.Pool
}

// NewPGStore wraps an existing connection pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{pool: pool} }

// reportColumns are the projections the Report struct needs, ordered to
// match scanReport.
const reportColumns = `r.id, r.project_id, r.user_id, u.display_name,
	r.category, r.narrative, r.proposed_address, r.latitude, r.longitude,
	r.distance_from_project, r.exif_status, r.exif_notice, r.status,
	r.created_at, r.updated_at, r.submitted_at,
	(SELECT COUNT(*) FROM evidences e WHERE e.report_id = r.id)`

// ListByUser lists the caller's reports, newest first, optionally filtered
// by status, then joins each page's media rows (§7.1 media is required).
// Pagination follows §10.4: default limit 20, clamped at 100.
func (s *PGStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	where := ` WHERE r.user_id = $1`
	args := []any{userID}
	if filter.Status != nil {
		where += ` AND r.status = $2`
		args = append(args, string(*filter.Status))
	}

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM reports r`+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT `+reportColumns+`
		FROM reports r
		JOIN users u ON u.id = r.user_id`+where+`
		ORDER BY r.created_at DESC
		LIMIT $`+itoa(len(args)+1)+` OFFSET $`+itoa(len(args)+2),
		append(args, limit, offset)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	reports := make([]*Report, 0, limit)
	for rows.Next() {
		r, err := scanReport(rows)
		if err != nil {
			return nil, err
		}
		r.Media = []*Media{} // populated below if the page is non-empty
		reports = append(reports, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(reports) > 0 {
		if err := s.attachMedia(ctx, reports); err != nil {
			return nil, err
		}
	}

	return &ListResult{
		Data: reports,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(reports) < total,
		},
	}, nil
}

// attachMedia fetches every report_media row for the page's reports in one
// query, grouped in memory so pagination (not the fan-out) sets page size.
func (s *PGStore) attachMedia(ctx context.Context, reports []*Report) error {
	ids := make([]string, 0, len(reports))
	byID := make(map[string]*Report, len(reports))
	for _, r := range reports {
		ids = append(ids, r.ID)
		byID[r.ID] = r
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, report_id, file_url, media_type,
			exif_latitude, exif_longitude, exif_taken_at, is_geotag_valid,
			sort_order, created_at
		FROM report_media
		WHERE report_id = ANY($1::uuid[])
		ORDER BY sort_order ASC`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		m := new(Media)
		var sortOrder int
		if err := rows.Scan(&m.ID, &m.ReportID, &m.FileURL, &m.MediaType,
			&m.ExifLatitude, &m.ExifLongitude, &m.ExifTakenAt, &m.IsGeotagValid,
			&sortOrder, &m.CreatedAt); err != nil {
			return err
		}
		m.SortOrder = sortOrder
		if owner, ok := byID[m.ReportID]; ok {
			owner.Media = append(owner.Media, m)
		}
	}
	return rows.Err()
}

// scanReport fills a Report row from the reportColumns projections.
func scanReport(row pgx.Row) (*Report, error) {
	r := &Report{}
	var status string
	if err := row.Scan(&r.ID, &r.ProjectID, &r.UserID, &r.AuthorDisplayName,
		&r.Category, &r.Narrative, &r.ProposedAddress, &r.Latitude, &r.Longitude,
		&r.DistanceFromProjectM, &r.ExifStatus, &r.ExifNotice, &status,
		&r.CreatedAt, &r.UpdatedAt, &r.SubmittedAt, &r.EvidencesCount); err != nil {
		return nil, err
	}
	r.Status = ReportStatus(status)
	return r, nil
}

// clampPage applies §10.4 pagination defaults: page >= 1; limit default 20,
// clamped into 1..100 rather than rejected.
func clampPage(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit
}

// itoa is strconv.Itoa shorthand for building placeholder indexes.
func itoa(n int) string { return strconv.Itoa(n) }