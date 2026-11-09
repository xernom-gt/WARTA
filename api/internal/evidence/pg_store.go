package evidence

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore reads and writes evidence rows in PostgreSQL (migration M6).
type PGStore struct {
	pool *pgxpool.Pool
}

// NewPGStore wraps an existing database connection pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{pool: pool} }

const evidenceColumns = `e.id, e.report_id, e.user_id, u.display_name,
	e.description, e.created_at, e.updated_at`

// ListByReport returns a page of evidence submissions for reportID, newest first.
func (s *PGStore) ListByReport(ctx context.Context, reportID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	var reportExists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM reports WHERE id = $1 AND deleted_at IS NULL)`, reportID).Scan(&reportExists)
	if err != nil {
		return nil, err
	}
	if !reportExists {
		return nil, ErrReportNotFound
	}

	var total int
	if err := s.pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM evidences WHERE report_id = $1`, reportID).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx, `
		SELECT `+evidenceColumns+`
		FROM evidences e
		JOIN users u ON u.id = e.user_id
		WHERE e.report_id = $1
		ORDER BY e.created_at DESC
		LIMIT $2 OFFSET $3`, reportID, limit, offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]*Evidence, 0, limit)
	for rows.Next() {
		ev, err := scanEvidence(rows)
		if err != nil {
			return nil, err
		}
		ev.Media = []*Media{}
		items = append(items, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(items) > 0 {
		if err := s.attachMedia(ctx, items); err != nil {
			return nil, err
		}
	}

	return &ListResult{
		Data: items,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(items) < total,
		},
	}, nil
}

// Create inserts an evidence row. Verifies parent report exists and is active.
// Does NOT create a verification item (§6.18).
func (s *PGStore) Create(ctx context.Context, ev *Evidence) (*Evidence, error) {
	var reportExists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM reports WHERE id = $1 AND deleted_at IS NULL)`, ev.ReportID).Scan(&reportExists)
	if err != nil {
		return nil, err
	}
	if !reportExists {
		return nil, ErrReportNotFound
	}

	now := time.Now().UTC()
	created := *ev
	if created.CreatedAt.IsZero() {
		created.CreatedAt = now
	}
	if created.UpdatedAt.IsZero() {
		created.UpdatedAt = created.CreatedAt
	}

	err = s.pool.QueryRow(ctx, `
		INSERT INTO evidences (report_id, user_id, description, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at, updated_at`,
		created.ReportID, created.UserID, created.Description, created.CreatedAt, created.UpdatedAt,
	).Scan(&created.ID, &created.CreatedAt, &created.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if created.AuthorDisplayName == "" {
		if err := s.pool.QueryRow(ctx, `
			SELECT display_name FROM users WHERE id = $1`, created.UserID).Scan(&created.AuthorDisplayName); err != nil {
			return nil, err
		}
	}

	created.Media = []*Media{}
	return &created, nil
}

// FindByID returns a single evidence entry with its author display name and media rows.
func (s *PGStore) FindByID(ctx context.Context, evidenceID string) (*Evidence, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT `+evidenceColumns+`
		FROM evidences e
		JOIN users u ON u.id = e.user_id
		WHERE e.id = $1`, evidenceID)
	ev, err := scanEvidence(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	ev.Media = []*Media{}
	if err := s.attachMedia(ctx, []*Evidence{ev}); err != nil {
		return nil, err
	}
	return ev, nil
}

// ListMedia lists photos attached to evidenceID.
func (s *PGStore) ListMedia(ctx context.Context, evidenceID string) ([]*Media, error) {
	var exists bool
	if err := s.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM evidences WHERE id = $1)`, evidenceID).Scan(&exists); err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, evidence_id, file_url, media_type, exif_latitude, exif_longitude,
			exif_taken_at, is_geotag_valid, created_at
		FROM evidence_media
		WHERE evidence_id = $1
		ORDER BY created_at ASC`, evidenceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var media []*Media
	for rows.Next() {
		m := new(Media)
		if err := rows.Scan(&m.ID, &m.EvidenceID, &m.FileURL, &m.MediaType,
			&m.ExifLatitude, &m.ExifLongitude, &m.ExifTakenAt, &m.IsGeotagValid,
			&m.CreatedAt); err != nil {
			return nil, err
		}
		media = append(media, m)
	}
	return media, rows.Err()
}

// CreateMedia adds an evidence photo while enforcing the 8-photo limit.
func (s *PGStore) CreateMedia(ctx context.Context, evidenceID string, m *Media) (*Media, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var count int
	err = tx.QueryRow(ctx, `
		SELECT COUNT(*)
		FROM evidence_media
		WHERE evidence_id = $1`, evidenceID).Scan(&count)
	if err != nil {
		return nil, err
	}
	if count >= MaxEvidencePhotos {
		return nil, ErrPhotoLimitReached
	}

	var exists bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM evidences WHERE id = $1 FOR UPDATE)`, evidenceID).Scan(&exists)
	if err != nil {
		return nil, err
	}
	if !exists {
		return nil, ErrNotFound
	}

	created := *m
	created.EvidenceID = evidenceID
	if created.CreatedAt.IsZero() {
		created.CreatedAt = time.Now().UTC()
	}

	err = tx.QueryRow(ctx, `
		INSERT INTO evidence_media (
			evidence_id, file_url, media_type, exif_latitude, exif_longitude,
			exif_taken_at, is_geotag_valid, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at`,
		created.EvidenceID, created.FileURL, created.MediaType,
		created.ExifLatitude, created.ExifLongitude, created.ExifTakenAt,
		created.IsGeotagValid, created.CreatedAt,
	).Scan(&created.ID, &created.CreatedAt)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}
	return &created, nil
}

// DeleteMedia deletes an evidence photo if the parent report is not yet reviewed (consensus).
func (s *PGStore) DeleteMedia(ctx context.Context, evidenceID, mediaID string) (string, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var reportStatus string
	err = tx.QueryRow(ctx, `
		SELECT r.status
		FROM evidences e
		JOIN reports r ON r.id = e.report_id
		WHERE e.id = $1
		FOR UPDATE OF e`, evidenceID).Scan(&reportStatus)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrNotFound
		}
		return "", err
	}

	switch reportStatus {
	case "terverifikasi", "ditolak", "selesai":
		return "", ErrDeleteLocked
	}

	var fileURL string
	err = tx.QueryRow(ctx, `
		DELETE FROM evidence_media
		WHERE id = $1 AND evidence_id = $2
		RETURNING file_url`, mediaID, evidenceID).Scan(&fileURL)
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

func (s *PGStore) attachMedia(ctx context.Context, items []*Evidence) error {
	ids := make([]string, 0, len(items))
	byID := make(map[string]*Evidence, len(items))
	for _, ev := range items {
		ids = append(ids, ev.ID)
		byID[ev.ID] = ev
	}

	rows, err := s.pool.Query(ctx, `
		SELECT id, evidence_id, file_url, media_type, exif_latitude, exif_longitude,
			exif_taken_at, is_geotag_valid, created_at
		FROM evidence_media
		WHERE evidence_id = ANY($1::uuid[])
		ORDER BY created_at ASC`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		m := new(Media)
		if err := rows.Scan(&m.ID, &m.EvidenceID, &m.FileURL, &m.MediaType,
			&m.ExifLatitude, &m.ExifLongitude, &m.ExifTakenAt, &m.IsGeotagValid,
			&m.CreatedAt); err != nil {
			return err
		}
		if owner, ok := byID[m.EvidenceID]; ok {
			owner.Media = append(owner.Media, m)
		}
	}
	return rows.Err()
}

func scanEvidence(row pgx.Row) (*Evidence, error) {
	e := &Evidence{}
	if err := row.Scan(&e.ID, &e.ReportID, &e.UserID, &e.AuthorDisplayName,
		&e.Description, &e.CreatedAt, &e.UpdatedAt); err != nil {
		return nil, err
	}
	return e, nil
}

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

func itoa(n int) string { return strconv.Itoa(n) }
