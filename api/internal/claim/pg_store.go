package claim

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore reads and writes location claims from PostgreSQL.
type PGStore struct {
	pool *pgxpool.Pool
}

// NewPGStore wraps an existing connection pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{pool: pool} }

const claimColumns = `c.id, c.project_id, c.user_id, u.display_name,
	c.proposed_address, c.address_line, c.kelurahan, c.kecamatan, c.city,
	c.landmark, c.proposed_precision, c.latitude, c.longitude,
	c.distance_from_project, c.exif_status, c.exif_notice, c.status,
	c.created_at, c.updated_at, c.decided_at`

// ListByUser lists the caller's claims, newest first, optionally filtered by status.
func (s *PGStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	where := ` WHERE c.user_id = $1`
	args := []any{userID}
	if filter.Status != nil {
		where += ` AND c.status = $2`
		args = append(args, string(*filter.Status))
	}

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM location_claims c`+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT `+claimColumns+`
		FROM location_claims c
		JOIN users u ON u.id = c.user_id`+where+`
		ORDER BY c.created_at DESC
		LIMIT $`+itoa(len(args)+1)+` OFFSET $`+itoa(len(args)+2),
		append(args, limit, offset)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	claims := make([]*Claim, 0, limit)
	for rows.Next() {
		c, err := scanClaim(rows)
		if err != nil {
			return nil, err
		}
		claims = append(claims, c)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListResult{
		Data: claims,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(claims) < total,
		},
	}, nil
}

// Create inserts a new location claim, computes distance, and enqueues to verification_items.
func (s *PGStore) Create(ctx context.Context, projectID, userID string, input CreateClaimInput) (*Claim, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// 1. Check if project exists and if it already has an accepted claim (or is_canonical_claimed)
	var hasAccepted bool
	err = tx.QueryRow(ctx, `
		SELECT (p.is_canonical_claimed OR EXISTS (
			SELECT 1 FROM location_claims lc WHERE lc.project_id = p.id AND lc.status = 'diterima'
		))
		FROM projects p WHERE p.id = $1
	`, projectID).Scan(&hasAccepted)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	if hasAccepted {
		return nil, ErrProjectHasAcceptedClaim
	}

	// 2. Fetch primary location of project to compute distance_from_project
	var pLat, pLon *float64
	_ = tx.QueryRow(ctx, `
		SELECT latitude, longitude FROM project_locations
		WHERE project_id = $1 AND is_primary = true
		LIMIT 1
	`, projectID).Scan(&pLat, &pLon)

	var distM *float64
	if input.Latitude != nil && input.Longitude != nil && pLat != nil && pLon != nil {
		d := HaversineDistanceM(*pLat, *pLon, *input.Latitude, *input.Longitude)
		distM = &d
	}

	// 3. Insert claim row
	var claimID string
	var createdAt, updatedAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO location_claims (
			project_id, user_id, proposed_address, address_line, kelurahan,
			kecamatan, city, landmark, proposed_precision, latitude, longitude,
			distance_from_project, exif_status, exif_notice, status
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'missing', NULL, 'menunggu'
		)
		RETURNING id, created_at, updated_at
	`, projectID, userID, input.ProposedAddress, input.AddressLine, input.Kelurahan,
		input.Kecamatan, input.City, input.Landmark, input.ProposedPrecision,
		input.Latitude, input.Longitude, distM,
	).Scan(&claimID, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}

	// 4. Create verification_items row (item_type = klaim_lokasi)
	_, err = tx.Exec(ctx, `
		INSERT INTO verification_items (
			project_id, item_type, claim_id, author_user_id, status, target_votes
		) VALUES (
			$1, 'klaim_lokasi', $2, $3, 'menunggu', 3
		)
	`, projectID, claimID, userID)
	if err != nil {
		return nil, fmt.Errorf("enqueue verification item: %w", err)
	}

	// 5. Fetch author display name
	var authorDisplayName string
	_ = tx.QueryRow(ctx, `SELECT display_name FROM users WHERE id = $1`, userID).Scan(&authorDisplayName)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return &Claim{
		ID:                   claimID,
		ProjectID:            projectID,
		UserID:               userID,
		AuthorDisplayName:    authorDisplayName,
		ProposedAddress:      input.ProposedAddress,
		AddressLine:          input.AddressLine,
		Kelurahan:            input.Kelurahan,
		Kecamatan:            input.Kecamatan,
		City:                 input.City,
		Landmark:             input.Landmark,
		ProposedPrecision:    input.ProposedPrecision,
		Latitude:             input.Latitude,
		Longitude:            input.Longitude,
		DistanceFromProjectM: distM,
		ExifStatus:           "missing",
		Status:               StatusMenunggu,
		CreatedAt:            createdAt,
		UpdatedAt:            updatedAt,
	}, nil
}

// GetByID returns a single claim by its ID.
func (s *PGStore) GetByID(ctx context.Context, claimID string) (*Claim, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+claimColumns+`
		FROM location_claims c
		JOIN users u ON u.id = c.user_id
		WHERE c.id = $1`, claimID)

	c, err := scanClaim(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}
	return c, nil
}

// GetMedia fetches the single photo attached to a claim.
func (s *PGStore) GetMedia(ctx context.Context, claimID string) (*Media, error) {
	var m Media
	err := s.pool.QueryRow(ctx, `
		SELECT id, claim_id, file_url, media_type, exif_latitude, exif_longitude,
		       exif_taken_at, is_geotag_valid, created_at
		FROM claim_media WHERE claim_id = $1 LIMIT 1
	`, claimID).Scan(
		&m.ID, &m.ClaimID, &m.FileURL, &m.MediaType, &m.ExifLatitude, &m.ExifLongitude,
		&m.ExifTakenAt, &m.IsGeotagValid, &m.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrMediaNotFound
		}
		return nil, err
	}
	return &m, nil
}

// AddMedia inserts a single photo row for a claim. Max 1 photo.
func (s *PGStore) AddMedia(ctx context.Context, claimID string, m *Media) (*Media, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	// Ensure claim exists and has status menunggu
	var status string
	err = tx.QueryRow(ctx, `SELECT status FROM location_claims WHERE id = $1`, claimID).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, err
	}

	// Check existing photo
	var count int
	if err := tx.QueryRow(ctx, `SELECT COUNT(*) FROM claim_media WHERE claim_id = $1`, claimID).Scan(&count); err != nil {
		return nil, err
	}
	if count >= 1 {
		return nil, ErrPhotoLimitExceeded
	}

	var newID string
	var createdAt time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO claim_media (
			claim_id, file_url, media_type, exif_latitude, exif_longitude, exif_taken_at, is_geotag_valid
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7
		)
		RETURNING id, created_at
	`, claimID, m.FileURL, m.MediaType, m.ExifLatitude, m.ExifLongitude, m.ExifTakenAt, m.IsGeotagValid).Scan(&newID, &createdAt)
	if err != nil {
		return nil, err
	}

	// Update exif status on location_claims
	exifStatus := "missing"
	if m.IsGeotagValid != nil && *m.IsGeotagValid {
		exifStatus = "valid"
	}
	_, _ = tx.Exec(ctx, `UPDATE location_claims SET exif_status = $1 WHERE id = $2`, exifStatus, claimID)

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	m.ID = newID
	m.ClaimID = claimID
	m.CreatedAt = createdAt
	return m, nil
}

// DeleteMedia deletes the photo for a claim. Only allowed while claim is menunggu.
func (s *PGStore) DeleteMedia(ctx context.Context, claimID, mediaID string) error {
	var status string
	err := s.pool.QueryRow(ctx, `SELECT status FROM location_claims WHERE id = $1`, claimID).Scan(&status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}
	if status != string(StatusMenunggu) {
		return ErrInvalidClaimState
	}

	res, err := s.pool.Exec(ctx, `DELETE FROM claim_media WHERE id = $1 AND claim_id = $2`, mediaID, claimID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrMediaNotFound
	}
	return nil
}

// AcceptClaim executes the acceptance transition:
// 1. Sets claim status to diterima and decided_at to NOW().
// 2. Creates or promotes project's primary location with source = warga.
// 3. Demotes previous primary location to is_primary = false.
// 4. Sets project.is_canonical_claimed = true.
// 5. Closes verification item with status = diterima.
func (s *PGStore) AcceptClaim(ctx context.Context, claimID string) error {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	var c Claim
	var status string
	err = tx.QueryRow(ctx, `
		SELECT id, project_id, proposed_address, proposed_precision, latitude, longitude, status
		FROM location_claims WHERE id = $1 FOR UPDATE
	`, claimID).Scan(&c.ID, &c.ProjectID, &c.ProposedAddress, &c.ProposedPrecision, &c.Latitude, &c.Longitude, &status)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return ErrNotFound
		}
		return err
	}

	// Check if project already has an accepted claim
	var existsAccepted bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM location_claims WHERE project_id = $1 AND status = 'diterima' AND id <> $2
		)
	`, c.ProjectID, c.ID).Scan(&existsAccepted)
	if err != nil {
		return err
	}
	if existsAccepted {
		return ErrProjectHasAcceptedClaim
	}

	now := time.Now().UTC()

	// 1. Demote old primary locations
	_, err = tx.Exec(ctx, `
		UPDATE project_locations SET is_primary = false, updated_at = $1
		WHERE project_id = $2 AND is_primary = true
	`, now, c.ProjectID)
	if err != nil {
		return err
	}

	// 2. Insert new primary location from accepted claim
	_, err = tx.Exec(ctx, `
		INSERT INTO project_locations (
			project_id, name, address, city, precision_level, source,
			latitude, longitude, is_verified, is_primary, created_at, updated_at
		) VALUES (
			$1, NULL, $2, (SELECT city FROM projects WHERE id = $1), $3, 'warga',
			$4, $5, true, true, $6, $6
		)
	`, c.ProjectID, c.ProposedAddress, c.ProposedPrecision, c.Latitude, c.Longitude, now)
	if err != nil {
		return err
	}

	// 3. Update project canonical claimed flag
	_, err = tx.Exec(ctx, `
		UPDATE projects SET is_canonical_claimed = true, updated_at = $1 WHERE id = $2
	`, now, c.ProjectID)
	if err != nil {
		return err
	}

	// 4. Update claim status
	_, err = tx.Exec(ctx, `
		UPDATE location_claims SET status = 'diterima', decided_at = $1, updated_at = $1 WHERE id = $2
	`, now, c.ID)
	if err != nil {
		return err
	}

	// 5. Update verification item
	_, err = tx.Exec(ctx, `
		UPDATE verification_items SET status = 'diterima', resolved_at = $1 WHERE claim_id = $2
	`, now, c.ID)
	if err != nil {
		return err
	}

	return tx.Commit(ctx)
}

func scanClaim(row pgx.Row) (*Claim, error) {
	c := new(Claim)
	var status string
	if err := row.Scan(&c.ID, &c.ProjectID, &c.UserID, &c.AuthorDisplayName,
		&c.ProposedAddress, &c.AddressLine, &c.Kelurahan, &c.Kecamatan, &c.City,
		&c.Landmark, &c.ProposedPrecision, &c.Latitude, &c.Longitude,
		&c.DistanceFromProjectM, &c.ExifStatus, &c.ExifNotice, &status,
		&c.CreatedAt, &c.UpdatedAt, &c.DecidedAt); err != nil {
		return nil, err
	}
	c.Status = ClaimStatus(status)
	return c, nil
}

// clampPage applies §10.4 pagination defaults.
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
