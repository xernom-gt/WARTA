package project

import (
	"context"
	"strconv"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore reads the project catalog from PostgreSQL (migration M2 plus the
// M9 search columns). Money stays a decimal string: NUMERIC(20,2) is cast to
// text in the projection and never parsed to float (api-guidelines §3.4).
type PGStore struct {
	pool *pgxpool.Pool
}

// NewPGStore wraps an existing connection pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{pool: pool} }

// projectColumns are the projections a Project row needs, ordered to match
// scanProject. The three trailing projections are read-time aggregates
// (§12.2: recomputed on every read, never stored).
const projectColumns = `p.id, p.title, p.spse_code, p.satker, p.category, p.city,
	p.pagu_amount::text, p.hps_amount::text, p.contract_amount::text,
	p.is_outside_dki, p.precision_level, p.location_source, p.is_canonical_claimed,
	p.precision_resolution_note, p.status, p.source_note, p.contract_note,
	p.created_at, p.updated_at,
	(SELECT COUNT(*) FROM reports r
		WHERE r.project_id = p.id AND r.status <> 'draft') AS reports_count,
	(SELECT COUNT(*) FROM verification_items vi
		WHERE vi.project_id = p.id) AS verifications_count,
	EXISTS (SELECT 1 FROM project_tenders pt
		WHERE pt.project_id = p.id AND pt.status = 'gagal') AS is_retender`

// List returns one filtered, sorted catalog page (§6.6). Search results use
// hybrid relevance ranking (openapi SearchQuery): full-text ts_rank_cd over
// the generated search_vector plus the pg_trgm similarity fallback, so both
// word matches and partial/typo terms surface; unfiltered pages follow the
// requested sort key.
func (s *PGStore) List(ctx context.Context, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	where, args := buildListWhere(filter)
	order := buildOrder(filter)

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM projects p `+where, args...).Scan(&total); err != nil {
		return nil, err
	}

	rows, err := s.pool.Query(ctx,
		`SELECT `+projectColumns+`
		FROM projects p`+where+`
		`+order+`
		LIMIT $`+itoa(len(args)+1)+` OFFSET $`+itoa(len(args)+2),
		append(args, limit, offset)...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := make([]*Project, 0, limit)
	for rows.Next() {
		p, err := scanProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(projects) > 0 {
		if err := s.attachYears(ctx, projects); err != nil {
			return nil, err
		}
	}

	return &ListResult{
		Data: projects,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(projects) < total,
		},
	}, nil
}

// buildListWhere assembles the catalog WHERE clause and bind arguments in
// parameter order (§6.6 filters).
func buildListWhere(filter ListFilter) (string, []any) {
	where := ` WHERE 1 = 1`
	args := []any{}
	if filter.Q != nil {
		where += ` AND (p.search_vector @@ websearch_to_tsquery('indonesian', $` +
			itoa(len(args)+1) + `) OR p.title % $` + itoa(len(args)+1) + `)`
		args = append(args, *filter.Q)
	}
	if filter.Category != nil {
		where += ` AND p.category = $` + itoa(len(args)+1)
		args = append(args, *filter.Category)
	}
	if filter.City != nil {
		where += ` AND p.city = $` + itoa(len(args)+1)
		args = append(args, *filter.City)
	}
	if filter.Status != nil {
		where += ` AND p.status = $` + itoa(len(args)+1)
		args = append(args, string(*filter.Status))
	}
	if filter.Year != nil {
		where += ` AND EXISTS (SELECT 1 FROM project_years py
			WHERE py.project_id = p.id AND py.fiscal_year = $` + itoa(len(args)+1) + `)`
		args = append(args, *filter.Year)
	}
	if filter.Precision != nil {
		where += ` AND p.precision_level = $` + itoa(len(args)+1)
		args = append(args, *filter.Precision)
	}
	if filter.IsOutsideDKI != nil {
		where += ` AND p.is_outside_dki = $` + itoa(len(args)+1)
		args = append(args, *filter.IsOutsideDKI)
	}
	if filter.IsRetender != nil {
		where += ` AND EXISTS (SELECT 1 FROM project_tenders pt
			WHERE pt.project_id = p.id AND pt.status = 'gagal') = $` + itoa(len(args)+1)
		args = append(args, *filter.IsRetender)
	}
	return where, args
}

// buildOrder picks the catalog ordering (§6.6 sort enum).
func buildOrder(filter ListFilter) string {
	switch filter.Sort {
	case SortTitleAsc:
		return `ORDER BY p.title ASC, p.id ASC`
	case SortPaguAsc:
		return `ORDER BY p.pagu_amount ASC, p.id ASC`
	case SortPaguDesc:
		return `ORDER BY p.pagu_amount DESC, p.id ASC`
	default: // SortCreatedDesc
		return `ORDER BY p.created_at DESC, p.id ASC`
	}
}

// FindByID returns one project with read-time aggregates; ErrNotFound when
// the row is missing (§10: unknown well-formed UUIDs map to 404).
func (s *PGStore) FindByID(ctx context.Context, id string) (*Project, error) {
	row := s.pool.QueryRow(ctx,
		`SELECT `+projectColumns+`
		FROM projects p
		WHERE p.id = $1`, id)

	p, err := scanProject(row)
	switch {
	case err == pgx.ErrNoRows:
		return nil, ErrNotFound
	case err != nil:
		return nil, err
	}

	if err := s.attachYears(ctx, []*Project{p}); err != nil {
		return nil, err
	}
	return p, nil
}

// MapPins returns lightweight pins for a viewport (§6.8): a pin needs its
// primary location's coordinates, so coord-less projects are naturally
// excluded by the join; the bbox comparison is inclusive.
func (s *PGStore) MapPins(ctx context.Context, filter MapFilter) ([]*MapPin, error) {
	where := ` WHERE l.is_primary AND l.latitude BETWEEN $1 AND $2
		AND l.longitude BETWEEN $3 AND $4`
	args := []any{filter.MinLat, filter.MaxLat, filter.MinLng, filter.MaxLng}
	if filter.Status != nil {
		where += ` AND p.status = $5`
		args = append(args, string(*filter.Status))
	}
	if filter.Category != nil {
		where += ` AND p.category = $6`
		args = append(args, *filter.Category)
	}

	rows, err := s.pool.Query(ctx, `
		SELECT p.id, p.title, l.latitude, l.longitude,
			p.precision_level, p.status, p.category
		FROM projects p
		JOIN project_locations l ON l.project_id = p.id`+where+`
		ORDER BY p.title ASC, p.id ASC`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	pins := []*MapPin{}
	for rows.Next() {
		pin := &MapPin{}
		var status string
		if err := rows.Scan(&pin.ID, &pin.Title, &pin.Latitude, &pin.Longitude,
			&pin.PrecisionLevel, &status, &pin.Category); err != nil {
			return nil, err
		}
		pin.Status = Status(status)
		pins = append(pins, pin)
	}
	return pins, rows.Err()
}

// ListTenders returns the tender history, created_at ascending (§6.9).
func (s *PGStore) ListTenders(ctx context.Context, projectID string) ([]*Tender, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, spse_code, status, note, created_at
		FROM project_tenders
		WHERE project_id = $1
		ORDER BY created_at ASC, id ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	tenders := []*Tender{}
	for rows.Next() {
		t := &Tender{}
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.SPSECode, &t.Status,
			&t.Note, &t.CreatedAt); err != nil {
			return nil, err
		}
		tenders = append(tenders, t)
	}
	return tenders, rows.Err()
}

// ListLocations returns primary + sub-locations, primary first (§6.10).
func (s *PGStore) ListLocations(ctx context.Context, projectID string) ([]*Location, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, name, address, city, precision_level, source,
			latitude, longitude, is_verified, is_primary, created_at, updated_at
		FROM project_locations
		WHERE project_id = $1
		ORDER BY is_primary DESC, created_at ASC, id ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	locations := []*Location{}
	for rows.Next() {
		l := &Location{}
		if err := rows.Scan(&l.ID, &l.ProjectID, &l.Name, &l.Address, &l.City,
			&l.PrecisionLevel, &l.Source, &l.Latitude, &l.Longitude,
			&l.IsVerified, &l.IsPrimary, &l.CreatedAt, &l.UpdatedAt); err != nil {
			return nil, err
		}
		locations = append(locations, l)
	}
	return locations, rows.Err()
}

// ListRiskFlags returns active flags, creation order (§6.11).
func (s *PGStore) ListRiskFlags(ctx context.Context, projectID string) ([]*RiskFlag, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT id, project_id, code, label, description, level, created_at
		FROM project_risk_flags
		WHERE project_id = $1
		ORDER BY created_at ASC, id ASC`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	flags := []*RiskFlag{}
	for rows.Next() {
		f := &RiskFlag{}
		if err := rows.Scan(&f.ID, &f.ProjectID, &f.Code, &f.Label,
			&f.Description, &f.Level, &f.CreatedAt); err != nil {
			return nil, err
		}
		flags = append(flags, f)
	}
	return flags, rows.Err()
}

// attachYears fetches every project_years row for the page's projects in one
// query, grouped in memory so pagination (not the fan-out) sets page size.
func (s *PGStore) attachYears(ctx context.Context, projects []*Project) error {
	ids := make([]string, 0, len(projects))
	byID := make(map[string]*Project, len(projects))
	for _, p := range projects {
		ids = append(ids, p.ID)
		byID[p.ID] = p
	}

	rows, err := s.pool.Query(ctx, `
		SELECT project_id, fiscal_year
		FROM project_years
		WHERE project_id = ANY($1::uuid[])
		ORDER BY project_id, fiscal_year ASC`, ids)
	if err != nil {
		return err
	}
	defer rows.Close()

	for rows.Next() {
		var projectID string
		var year int16
		if err := rows.Scan(&projectID, &year); err != nil {
			return err
		}
		if p, ok := byID[projectID]; ok {
			p.Years = append(p.Years, int(year))
		}
	}
	return rows.Err()
}

// scanProject fills a Project row from the projectColumns projections.
func scanProject(row pgx.Row) (*Project, error) {
	p := &Project{}
	var status string
	if err := row.Scan(&p.ID, &p.Title, &p.SPSECode, &p.Satker, &p.Category,
		&p.City, &p.PaguAmount, &p.HPSAmount, &p.ContractAmount,
		&p.IsOutsideDKI, &p.PrecisionLevel, &p.LocationSource,
		&p.IsCanonicalClaimed, &p.PrecisionResolutionNote, &status,
		&p.SourceNote, &p.ContractNote, &p.CreatedAt, &p.UpdatedAt,
		&p.ReportsCount, &p.VerificationsCount, &p.IsRetender); err != nil {
		return nil, err
	}
	p.Status = Status(status)
	return p, nil
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
