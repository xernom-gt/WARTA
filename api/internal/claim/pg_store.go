package claim

import (
	"context"
	"strconv"

	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore reads location claims from PostgreSQL (migration M4). The author
// display name is joined per §7.2: it belongs to users, not to the claims
// table.
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

// ListByUser lists the caller's claims, newest first, optionally filtered by
// status. Pagination follows §10.4: default limit 20, clamped at 100.
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
		c := new(Claim)
		var status string
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.UserID, &c.AuthorDisplayName,
			&c.ProposedAddress, &c.AddressLine, &c.Kelurahan, &c.Kecamatan, &c.City,
			&c.Landmark, &c.ProposedPrecision, &c.Latitude, &c.Longitude,
			&c.DistanceFromProjectM, &c.ExifStatus, &c.ExifNotice, &status,
			&c.CreatedAt, &c.UpdatedAt, &c.DecidedAt); err != nil {
			return nil, err
		}
		c.Status = ClaimStatus(status)
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

// clampPage applies §10.4 pagination defaults (shared with the report store).
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