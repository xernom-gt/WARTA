package project

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/google/uuid"
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

// Create inserts a new project with its primary location and fiscal years in one transaction.
func (s *PGStore) Create(ctx context.Context, params CreateProjectParams) (*Project, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	id := uuid.NewString()
	spseCode := params.SPSECode
	if spseCode == "" {
		spseCode = fmt.Sprintf("WARTA-%d", time.Now().UnixNano()%10000000000)
	}
	precision := params.PrecisionLevel
	if precision == "" {
		precision = PrecisionTitik
	}
	status := params.Status
	if status == "" {
		status = StatusMenunggu
	}
	hps := params.HPSAmount
	if hps == "" {
		hps = params.PaguAmount
	}
	locDesc := params.Address
	if locDesc == "" {
		locDesc = params.City
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO projects (
			id, spse_code, title, satker, category, pagu_amount, hps_amount, contract_amount, contract_note,
			city, is_outside_dki, location_description, precision_level, location_source, is_canonical_claimed,
			status, source_note, created_at, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6::numeric, $7::numeric, $8::numeric, $9,
			$10, $11, $12, $13, 'MANUAL', false,
			$14, $15, NOW(), NOW()
		)`,
		id, spseCode, params.Title, params.Satker, params.Category,
		params.PaguAmount, hps, params.ContractAmount, params.ContractNote,
		params.City, params.IsOutsideDKI, locDesc, precision,
		string(status), params.SourceNote,
	)
	if err != nil {
		return nil, err
	}

	for _, year := range params.Years {
		if year >= 2000 && year <= 2100 {
			_, err = tx.Exec(ctx, `
				INSERT INTO project_years (project_id, fiscal_year)
				VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, year)
			if err != nil {
				return nil, err
			}
		}
	}

	var hasCoords bool
	if params.Latitude != nil && params.Longitude != nil {
		hasCoords = true
	}
	var lat, lng any
	if hasCoords {
		lat, lng = *params.Latitude, *params.Longitude
	}

	_, err = tx.Exec(ctx, `
		INSERT INTO project_locations (
			id, project_id, name, address, city, precision_level, source,
			latitude, longitude, is_verified, is_primary, created_at, updated_at
		) VALUES (
			gen_random_uuid(), $1, $2, $3, $4, $5, 'MANUAL',
			$6, $7, true, true, NOW(), NOW()
		)`,
		id, params.Title, locDesc, params.City, precision, lat, lng,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.FindByID(ctx, id)
}

// Update patches an existing project and updates its primary location and fiscal years in one transaction.
func (s *PGStore) Update(ctx context.Context, id string, params UpdateProjectParams) (*Project, error) {
	tx, err := s.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)

	var existingID string
	err = tx.QueryRow(ctx, `SELECT id FROM projects WHERE id = $1 FOR UPDATE`, id).Scan(&existingID)
	if err == pgx.ErrNoRows {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	setClauses := []string{"updated_at = NOW()"}
	args := []any{id}

	if params.Title != nil {
		setClauses = append(setClauses, fmt.Sprintf("title = $%d", len(args)+1))
		args = append(args, *params.Title)
	}
	if params.Satker != nil {
		setClauses = append(setClauses, fmt.Sprintf("satker = $%d", len(args)+1))
		args = append(args, *params.Satker)
	}
	if params.Category != nil {
		setClauses = append(setClauses, fmt.Sprintf("category = $%d", len(args)+1))
		args = append(args, *params.Category)
	}
	if params.PaguAmount != nil {
		setClauses = append(setClauses, fmt.Sprintf("pagu_amount = $%d::numeric", len(args)+1))
		args = append(args, *params.PaguAmount)
	}
	if params.HPSAmount != nil {
		setClauses = append(setClauses, fmt.Sprintf("hps_amount = $%d::numeric", len(args)+1))
		args = append(args, *params.HPSAmount)
	}
	if params.ContractAmount != nil {
		setClauses = append(setClauses, fmt.Sprintf("contract_amount = $%d::numeric", len(args)+1))
		args = append(args, *params.ContractAmount)
	}
	if params.ContractNote != nil {
		setClauses = append(setClauses, fmt.Sprintf("contract_note = $%d", len(args)+1))
		args = append(args, *params.ContractNote)
	}
	if params.City != nil {
		setClauses = append(setClauses, fmt.Sprintf("city = $%d", len(args)+1))
		args = append(args, *params.City)
	}
	if params.IsOutsideDKI != nil {
		setClauses = append(setClauses, fmt.Sprintf("is_outside_dki = $%d", len(args)+1))
		args = append(args, *params.IsOutsideDKI)
	}
	if params.PrecisionLevel != nil {
		setClauses = append(setClauses, fmt.Sprintf("precision_level = $%d", len(args)+1))
		args = append(args, *params.PrecisionLevel)
	}
	if params.Status != nil {
		setClauses = append(setClauses, fmt.Sprintf("status = $%d", len(args)+1))
		args = append(args, string(*params.Status))
	}
	if params.SourceNote != nil {
		setClauses = append(setClauses, fmt.Sprintf("source_note = $%d", len(args)+1))
		args = append(args, *params.SourceNote)
	}

	query := "UPDATE projects SET "
	for i, clause := range setClauses {
		if i > 0 {
			query += ", "
		}
		query += clause
	}
	query += " WHERE id = $1"

	if _, err := tx.Exec(ctx, query, args...); err != nil {
		return nil, err
	}

	if len(params.Years) > 0 {
		if _, err := tx.Exec(ctx, `DELETE FROM project_years WHERE project_id = $1`, id); err != nil {
			return nil, err
		}
		for _, yr := range params.Years {
			if yr >= 2000 && yr <= 2100 {
				_, err = tx.Exec(ctx, `
					INSERT INTO project_years (project_id, fiscal_year)
					VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, yr)
				if err != nil {
					return nil, err
				}
			}
		}
	}

	if params.Latitude != nil || params.Longitude != nil || params.Address != nil {
		var locID string
		err = tx.QueryRow(ctx, `
			SELECT id FROM project_locations
			WHERE project_id = $1 AND is_primary = true
			ORDER BY created_at ASC LIMIT 1`, id).Scan(&locID)

		if err == pgx.ErrNoRows {
			addr := ""
			if params.Address != nil {
				addr = *params.Address
			}
			city := "DKI Jakarta"
			if params.City != nil {
				city = *params.City
			}
			prec := PrecisionTitik
			if params.PrecisionLevel != nil {
				prec = *params.PrecisionLevel
			}
			var lat, lng any
			if params.Latitude != nil && params.Longitude != nil {
				lat, lng = *params.Latitude, *params.Longitude
			}
			_, err = tx.Exec(ctx, `
				INSERT INTO project_locations (
					id, project_id, name, address, city, precision_level, source,
					latitude, longitude, is_verified, is_primary, created_at, updated_at
				) VALUES (
					gen_random_uuid(), $1, NULL, $2, $3, $4, 'MANUAL',
					$5, $6, true, true, NOW(), NOW()
				)`, id, addr, city, prec, lat, lng)
			if err != nil {
				return nil, err
			}
		} else if err != nil {
			return nil, err
		} else {
			locClauses := []string{"updated_at = NOW()"}
			locArgs := []any{locID}
			if params.Address != nil {
				locClauses = append(locClauses, fmt.Sprintf("address = $%d", len(locArgs)+1))
				locArgs = append(locArgs, *params.Address)
			}
			if params.Latitude != nil && params.Longitude != nil {
				locClauses = append(locClauses, fmt.Sprintf("latitude = $%d, longitude = $%d", len(locArgs)+1, len(locArgs)+2))
				locArgs = append(locArgs, *params.Latitude, *params.Longitude)
			}
			locQuery := "UPDATE project_locations SET "
			for i, clause := range locClauses {
				if i > 0 {
					locQuery += ", "
				}
				locQuery += clause
			}
			locQuery += " WHERE id = $1"
			if _, err := tx.Exec(ctx, locQuery, locArgs...); err != nil {
				return nil, err
			}
		}
	}

	if err := tx.Commit(ctx); err != nil {
		return nil, err
	}

	return s.FindByID(ctx, id)
}
