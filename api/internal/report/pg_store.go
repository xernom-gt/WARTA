package report

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore reads and writes reports in PostgreSQL (migrations M3, M5).
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

// Create inserts a new report row and optionally enqueues its verification item
// inside a single transaction (§6.11).
func (s *PGStore) Create(ctx context.Context, r *Report, enqueue bool) (*Report, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var projLat, projLng *float64
	err = tx.QueryRow(ctx, `
		SELECT pl.latitude, pl.longitude
		FROM projects p
		LEFT JOIN project_locations pl ON pl.project_id = p.id AND pl.is_primary = TRUE
		WHERE p.id = $1
		LIMIT 1`, r.ProjectID).Scan(&projLat, &projLng)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrProjectNotFound
		}
		return nil, err
	}

	var dist *float64
	if r.Latitude != nil && r.Longitude != nil && projLat != nil && projLng != nil {
		d := HaversineMeters(*r.Latitude, *r.Longitude, *projLat, *projLng)
		dist = &d
	}

	created := *r
	created.DistanceFromProjectM = dist
	if created.ExifStatus == "" {
		created.ExifStatus = ExifMissing
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO reports (
			project_id, user_id, category, narrative, proposed_address,
			latitude, longitude, distance_from_project, exif_status, exif_notice,
			status, submitted_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		RETURNING id, created_at, updated_at, submitted_at`,
		created.ProjectID, created.UserID, created.Category, created.Narrative,
		created.ProposedAddress, created.Latitude, created.Longitude,
		created.DistanceFromProjectM, created.ExifStatus, created.ExifNotice,
		string(created.Status), created.SubmittedAt,
	).Scan(&created.ID, &created.CreatedAt, &created.UpdatedAt, &created.SubmittedAt)
	if err != nil {
		return nil, err
	}

	if enqueue {
		if _, err := tx.Exec(ctx, `
			INSERT INTO verification_items (item_type, report_id, status, target_votes)
			VALUES ('laporan_kondisi', $1, 'menunggu', 3)`, created.ID); err != nil {
			return nil, err
		}
	}

	if created.AuthorDisplayName == "" {
		if err := tx.QueryRow(ctx,
			`SELECT display_name FROM users WHERE id = $1`, created.UserID,
		).Scan(&created.AuthorDisplayName); err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	created.Media = []*Media{}
	created.EvidencesCount = 0
	return &created, nil
}

// FindByID loads one report with its author display name, media rows, and
// evidence count.
func (s *PGStore) FindByID(ctx context.Context, reportID string) (*Report, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+reportColumns+`
		FROM reports r
		JOIN users u ON u.id = r.user_id
		WHERE r.id = $1`, reportID)
	r, err := scanReport(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	r.Media = []*Media{}
	if err := s.attachMedia(ctx, []*Report{r}); err != nil {
		return nil, err
	}
	return r, nil
}

// Submit transitions a draft report to menunggu and inserts its
// laporan_kondisi verification_items row in one transaction (§6.12).
func (s *PGStore) Submit(ctx context.Context, reportID string, submittedAt time.Time) (*Report, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		curStatus string
		projectID string
		lat, lng  *float64
		dist      *float64
	)
	err = tx.QueryRow(ctx, `
		SELECT status, project_id, latitude, longitude, distance_from_project
		FROM reports
		WHERE id = $1
		FOR UPDATE`, reportID).Scan(&curStatus, &projectID, &lat, &lng, &dist)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if ReportStatus(curStatus) != StatusDraft {
		return nil, ErrNotDraft
	}

	if dist == nil && lat != nil && lng != nil {
		var projLat, projLng *float64
		err := tx.QueryRow(ctx, `
			SELECT latitude, longitude
			FROM project_locations
			WHERE project_id = $1 AND is_primary = TRUE
			LIMIT 1`, projectID).Scan(&projLat, &projLng)
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
		if projLat != nil && projLng != nil {
			d := HaversineMeters(*lat, *lng, *projLat, *projLng)
			dist = &d
		}
	}

	if _, err := tx.Exec(ctx, `
		UPDATE reports
		SET status = $2,
			submitted_at = $3,
			updated_at = $3,
			distance_from_project = $4
		WHERE id = $1`,
		reportID, string(StatusMenunggu), submittedAt.UTC(), dist); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO verification_items (item_type, report_id, status, target_votes)
		VALUES ('laporan_kondisi', $1, 'menunggu', 3)`, reportID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.FindByID(ctx, reportID)
}

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
		r.Media = []*Media{}
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
