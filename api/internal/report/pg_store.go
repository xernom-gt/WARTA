package report

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore reads and writes reports in PostgreSQL (migrations M3, M5, M9).
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
			INSERT INTO verification_items (project_id, item_type, report_id, author_user_id, status, target_votes)
			VALUES ($1, 'laporan_kondisi', $2, $3, 'menunggu', 3)`,
			created.ProjectID, created.ID, created.UserID); err != nil {
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

// FindByID loads one active (non-soft-deleted) report with its author display
// name, media rows, and evidence count.
func (s *PGStore) FindByID(ctx context.Context, reportID string) (*Report, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+reportColumns+`
		FROM reports r
		JOIN users u ON u.id = r.user_id
		WHERE r.id = $1 AND r.deleted_at IS NULL`, reportID)
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
		userID    string
		lat, lng  *float64
		dist      *float64
	)
	err = tx.QueryRow(ctx, `
		SELECT status, project_id, user_id, latitude, longitude, distance_from_project
		FROM reports
		WHERE id = $1 AND deleted_at IS NULL
		FOR UPDATE`, reportID).Scan(&curStatus, &projectID, &userID, &lat, &lng, &dist)
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
		dist, err = lookupDistanceTx(ctx, tx, projectID, lat, lng)
		if err != nil {
			return nil, err
		}
	}

	ts := submittedAt.UTC()
	if _, err := tx.Exec(ctx, `
		UPDATE reports
		SET status = $2,
			submitted_at = $3,
			updated_at = $3,
			distance_from_project = $4
		WHERE id = $1`,
		reportID, string(StatusMenunggu), ts, dist); err != nil {
		return nil, err
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO verification_items (project_id, item_type, report_id, author_user_id, status, target_votes)
		VALUES ($1, 'laporan_kondisi', $2, $3, 'menunggu', 3)`,
		projectID, reportID, userID); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.FindByID(ctx, reportID)
}

// UpdateDraft applies partial edits to a draft report and recomputes
// distance_from_project when coordinates change (§6.13).
func (s *PGStore) UpdateDraft(ctx context.Context, reportID string, patch DraftPatch) (*Report, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var (
		curStatus    string
		projectID    string
		category     *string
		narrative    string
		proposedAddr *string
		lat, lng     *float64
		dist         *float64
	)
	err = tx.QueryRow(ctx, `
		SELECT status, project_id, category, narrative, proposed_address,
			latitude, longitude, distance_from_project
		FROM reports
		WHERE id = $1 AND deleted_at IS NULL
		FOR UPDATE`, reportID).Scan(
		&curStatus, &projectID, &category, &narrative, &proposedAddr,
		&lat, &lng, &dist,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if ReportStatus(curStatus) != StatusDraft {
		return nil, ErrNotDraft
	}

	if patch.SetCategory {
		category = patch.Category
	}
	if patch.SetNarrative {
		narrative = patch.Narrative
	}
	if patch.SetProposedAddress {
		proposedAddr = patch.ProposedAddress
	}
	if patch.SetCoordinates {
		lat = patch.Latitude
		lng = patch.Longitude
		if lat == nil || lng == nil {
			dist = nil
		} else {
			dist, err = lookupDistanceTx(ctx, tx, projectID, lat, lng)
			if err != nil {
				return nil, err
			}
		}
	}

	ts := patch.UpdatedAt.UTC()
	if ts.IsZero() {
		ts = time.Now().UTC()
	}
	if _, err := tx.Exec(ctx, `
		UPDATE reports
		SET category = $2,
			narrative = $3,
			proposed_address = $4,
			latitude = $5,
			longitude = $6,
			distance_from_project = $7,
			updated_at = $8
		WHERE id = $1`,
		reportID, category, narrative, proposedAddr, lat, lng, dist, ts); err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return s.FindByID(ctx, reportID)
}

// Delete hard-deletes a draft report (cascading to report_media) or
// soft-deletes a menunggu report and closes its verification item by setting
// resolved_at (§6.14).
func (s *PGStore) Delete(ctx context.Context, reportID string, deletedAt time.Time) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var curStatus string
	err = tx.QueryRow(ctx, `
		SELECT status
		FROM reports
		WHERE id = $1 AND deleted_at IS NULL
		FOR UPDATE`, reportID).Scan(&curStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	ts := deletedAt.UTC()
	if ts.IsZero() {
		ts = time.Now().UTC()
	}

	switch ReportStatus(curStatus) {
	case StatusDraft:
		if _, err := tx.Exec(ctx, `DELETE FROM reports WHERE id = $1`, reportID); err != nil {
			return err
		}
	case StatusMenunggu:
		if _, err := tx.Exec(ctx, `
			UPDATE reports
			SET deleted_at = $2, updated_at = $2
			WHERE id = $1`, reportID, ts); err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, `
			UPDATE verification_items
			SET resolved_at = $2
			WHERE report_id = $1 AND resolved_at IS NULL`, reportID, ts); err != nil {
			return err
		}
	default:
		return ErrDeleteLocked
	}

	return tx.Commit(ctx)
}

// CreateMedia inserts a report_media row at requestedSlot (or the lowest free
// slot 0..3 when requestedSlot is nil) inside a transaction (§6.15).
func (s *PGStore) CreateMedia(ctx context.Context, reportID string, m *Media, requestedSlot *int) (*Media, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var curStatus string
	err = tx.QueryRow(ctx, `
		SELECT status
		FROM reports
		WHERE id = $1 AND deleted_at IS NULL
		FOR UPDATE`, reportID).Scan(&curStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	rows, err := tx.Query(ctx, `
		SELECT sort_order
		FROM report_media
		WHERE report_id = $1
		ORDER BY sort_order ASC`, reportID)
	if err != nil {
		return nil, err
	}
	used := map[int]bool{}
	for rows.Next() {
		var slot int
		if err := rows.Scan(&slot); err != nil {
			rows.Close()
			return nil, err
		}
		used[slot] = true
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	slot, err := chooseMediaSlot(used, requestedSlot)
	if err != nil {
		return nil, err
	}

	created := *m
	created.ReportID = reportID
	created.SortOrder = slot
	err = tx.QueryRow(ctx, `
		INSERT INTO report_media (
			report_id, file_url, media_type,
			exif_latitude, exif_longitude, exif_taken_at, is_geotag_valid,
			sort_order
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`,
		reportID, created.FileURL, created.MediaType,
		created.ExifLatitude, created.ExifLongitude, created.ExifTakenAt,
		created.IsGeotagValid, created.SortOrder,
	).Scan(&created.ID, &created.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &created, nil
}

// DeleteMedia removes a report_media row while the parent report is still a
// draft and returns its file_url for storage cleanup (§6.19).
func (s *PGStore) DeleteMedia(ctx context.Context, reportID, mediaID string) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var curStatus string
	err = tx.QueryRow(ctx, `
		SELECT status
		FROM reports
		WHERE id = $1 AND deleted_at IS NULL
		FOR UPDATE`, reportID).Scan(&curStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}
	if ReportStatus(curStatus) != StatusDraft {
		return "", ErrNotDraft
	}

	var fileURL string
	err = tx.QueryRow(ctx, `
		DELETE FROM report_media
		WHERE id = $1 AND report_id = $2
		RETURNING file_url`, mediaID, reportID).Scan(&fileURL)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrMediaNotFound
		}
		return "", err
	}

	if err := tx.Commit(ctx); err != nil {
		return "", err
	}
	return fileURL, nil
}

func chooseMediaSlot(used map[int]bool, requested *int) (int, error) {
	if len(used) >= MaxReportPhotos {
		return 0, ErrPhotoLimitReached
	}
	if requested != nil {
		if used[*requested] {
			return 0, ErrSortOrderTaken
		}
		return *requested, nil
	}
	for slot := 0; slot < MaxReportPhotos; slot++ {
		if !used[slot] {
			return slot, nil
		}
	}
	return 0, ErrPhotoLimitReached
}

func lookupDistanceTx(ctx context.Context, tx pgx.Tx, projectID string, lat, lng *float64) (*float64, error) {
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
		return &d, nil
	}
	return nil, nil
}

// ListByUser lists the caller's active reports, newest first, optionally
// filtered by status, then joins each page's media rows (§7.1).
func (s *PGStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	where := ` WHERE r.user_id = $1 AND r.deleted_at IS NULL`
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
