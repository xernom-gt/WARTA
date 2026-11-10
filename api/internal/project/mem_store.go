package project

import (
	"context"
	"sort"
	"strings"
	"sync"
)

// MemoryStore is the in-memory Store used by handler tests. Seed installs a
// project with its children; report/verification counts live in maps because
// PostgreSQL fills them with correlated subqueries.
type MemoryStore struct {
	mu                 sync.Mutex
	projects           []*Project
	tenders            map[string][]*Tender
	locations          map[string][]*Location
	riskFlags          map[string][]*RiskFlag
	reportsCount       map[string]int
	verificationsCount map[string]int
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		projects:           []*Project{},
		tenders:            map[string][]*Tender{},
		locations:          map[string][]*Location{},
		riskFlags:          map[string][]*RiskFlag{},
		reportsCount:       map[string]int{},
		verificationsCount: map[string]int{},
	}
}

// Seed installs one project fixture with its years, tenders, locations, and
// risk flags (§3.2-§3.6). Submitted-report and verification counts are
// injected because those rows live in the reports/verification packages.
func (s *MemoryStore) Seed(p *Project, years []int, tenders []*Tender,
	locations []*Location, flags []*RiskFlag, reports, verifications int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	cp := *p
	cp.Years = append([]int(nil), years...)
	s.projects = append(s.projects, &cp)
	s.tenders[p.ID] = append([]*Tender(nil), tenders...)
	s.locations[p.ID] = append([]*Location(nil), locations...)
	s.riskFlags[p.ID] = append([]*RiskFlag(nil), flags...)
	s.reportsCount[p.ID] = reports
	s.verificationsCount[p.ID] = verifications
}

// fill recomputes the read-time aggregates of a snapshot copy (§3.7: derived
// fields are recomputed on every read, never stored).
func (s *MemoryStore) fill(p *Project) *Project {
	cp := *p
	cp.ReportsCount = s.reportsCount[p.ID]
	cp.VerificationsCount = s.verificationsCount[p.ID]
	cp.IsRetender = false
	for _, t := range s.tenders[p.ID] {
		if t.Status == "gagal" {
			cp.IsRetender = true
			break
		}
	}
	return &cp
}

// List mirrors the query store: filters, search, sort, §10.4 clamped
// pagination. Relevance ranking is a PostgreSQL concern, so search results
// keep the sort-key order here.
func (s *MemoryStore) List(ctx context.Context, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)

	s.mu.Lock()
	defer s.mu.Unlock()

	mine := make([]*Project, 0, len(s.projects))
	for _, p := range s.projects {
		cp := s.fill(p)
		if !matchFilter(cp, filter) {
			continue
		}
		mine = append(mine, cp)
	}
	if filter.Q == nil {
		sortProjects(mine, filter.Sort)
	}

	result := &ListResult{
		Data: []*Project{},
		Meta: Meta{Page: page, Limit: limit, Total: len(mine)},
	}
	offset := (page - 1) * limit
	if offset >= len(mine) {
		return result, nil
	}
	end := offset + limit
	if end > len(mine) {
		end = len(mine)
	}
	result.Data = mine[offset:end]
	result.Meta.HasNext = end < len(mine)
	return result, nil
}

// FindByID fetches with read-time aggregates; ErrNotFound for unknown ids.
func (s *MemoryStore) FindByID(ctx context.Context, id string) (*Project, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, p := range s.projects {
		if p.ID == id {
			return s.fill(p), nil
		}
	}
	return nil, ErrNotFound
}

// MapPins returns pins whose primary coordinates fall inside the bbox
// (§6.8). Coordinate-less projects can never sit inside a viewport, so they
// are skipped exactly like the SQL join does.
func (s *MemoryStore) MapPins(ctx context.Context, filter MapFilter) ([]*MapPin, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	pins := []*MapPin{}
	for _, p := range s.projects {
		if filter.Status != nil && p.Status != *filter.Status {
			continue
		}
		if filter.Category != nil && p.Category != *filter.Category {
			continue
		}
		var primary *Location
		for _, l := range s.locations[p.ID] {
			if l.IsPrimary {
				primary = l
				break
			}
		}
		if primary == nil || primary.Latitude == nil || primary.Longitude == nil {
			continue
		}
		if !insideBBox(primary.Latitude, primary.Longitude, filter) {
			continue
		}
		pins = append(pins, &MapPin{
			ID:             p.ID,
			Title:          p.Title,
			Latitude:       primary.Latitude,
			Longitude:      primary.Longitude,
			PrecisionLevel: p.PrecisionLevel,
			Status:         p.Status,
			Category:       p.Category,
		})
	}
	sort.Slice(pins, func(i, j int) bool {
		return pins[i].Title < pins[j].Title
	})
	return pins, nil
}

// insideBBox tests lat/lng against the inclusive viewport rectangle.
func insideBBox(lat, lng *float64, f MapFilter) bool {
	return *lat >= f.MinLat && *lat <= f.MaxLat &&
		*lng >= f.MinLng && *lng <= f.MaxLng
}

// ListTenders mirrors the query store: created_at ascending (§6.9).
func (s *MemoryStore) ListTenders(ctx context.Context, projectID string) ([]*Tender, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows := append([]*Tender(nil), s.tenders[projectID]...)
	sort.Slice(rows, func(i, j int) bool {
		return rows[i].CreatedAt.Before(rows[j].CreatedAt)
	})
	return rows, nil
}

// ListLocations mirrors the query store: primary first, then insertion order.
func (s *MemoryStore) ListLocations(ctx context.Context, projectID string) ([]*Location, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows := append([]*Location(nil), s.locations[projectID]...)
	sort.SliceStable(rows, func(i, j int) bool { return rows[i].IsPrimary && !rows[j].IsPrimary })
	return rows, nil
}

// ListRiskFlags mirrors the query store: creation order (stable seed order).
func (s *MemoryStore) ListRiskFlags(ctx context.Context, projectID string) ([]*RiskFlag, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	rows := append([]*RiskFlag(nil), s.riskFlags[projectID]...)
	return rows, nil
}

// matchFilter implements the same WHERE conditions as the PG store.
func matchFilter(p *Project, f ListFilter) bool {
	if f.Q != nil && !containsFold(searchableText(p), *f.Q) {
		return false
	}
	if f.Category != nil && p.Category != *f.Category {
		return false
	}
	if f.City != nil && p.City != *f.City {
		return false
	}
	if f.Status != nil && p.Status != *f.Status {
		return false
	}
	if f.Year != nil && !hasYear(p, *f.Year) {
		return false
	}
	if f.Precision != nil && p.PrecisionLevel != *f.Precision {
		return false
	}
	if f.IsOutsideDKI != nil && p.IsOutsideDKI != *f.IsOutsideDKI {
		return false
	}
	if f.IsRetender != nil && p.IsRetender != *f.IsRetender {
		return false
	}
	return true
}

// searchableText joins the four full-text columns (§3.2 search_vector).
func searchableText(p *Project) string {
	return p.Title + " " + p.Satker + " " + p.Category + " " + p.City
}

// hasYear reports membership in the project's year set.
func hasYear(p *Project, year int) bool {
	for _, y := range p.Years {
		if y == year {
			return true
		}
	}
	return false
}

// containsFold is the case-insensitive substring test standing in for the
// hybrid full-text + trigram search of PostgreSQL.
func containsFold(haystack, needle string) bool {
	return strings.Contains(strings.ToLower(haystack), strings.ToLower(needle))
}

// sortProjects applies the §6.6 sort keys; the catalog default is
// -created_at (newest first) with a stable id tiebreak.
func sortProjects(rows []*Project, key SortKey) {
	switch key {
	case SortTitleAsc:
		sort.SliceStable(rows, func(i, j int) bool { return rows[i].Title < rows[j].Title })
	case SortPaguAsc:
		sort.SliceStable(rows, func(i, j int) bool {
			if rows[i].PaguAmount != rows[j].PaguAmount {
				return amountLess(rows[i].PaguAmount, rows[j].PaguAmount)
			}
			return rows[i].ID < rows[j].ID
		})
	case SortPaguDesc:
		sort.SliceStable(rows, func(i, j int) bool {
			if rows[i].PaguAmount != rows[j].PaguAmount {
				return amountLess(rows[j].PaguAmount, rows[i].PaguAmount)
			}
			return rows[i].ID < rows[j].ID
		})
	default: // SortCreatedDesc
		sort.SliceStable(rows, func(i, j int) bool {
			if !rows[i].CreatedAt.Equal(rows[j].CreatedAt) {
				return rows[i].CreatedAt.After(rows[j].CreatedAt)
			}
			return rows[i].ID < rows[j].ID
		})
	}
}

// amountLess orders two exact decimal amounts numerically. NUMERIC(20,2)
// renders with a fixed two-digit fraction, so padding both integer parts to
// equal width makes lexicographic order exact (no float involved).
func amountLess(a, b string) bool {
	ia, oa := decimalParts(a)
	ib, ob := decimalParts(b)
	if ia == ib {
		return oa < ob
	}
	return ia < ib
}

// decimalParts splits "516020000000.00" into zero-padded, equal-length
// integer and fraction texts, safe to compare as strings.
func decimalParts(v string) (string, string) {
	frac := "00"
	dot := strings.IndexByte(v, '.')
	if dot >= 0 {
		frac = v[dot+1:]
		for len(frac) < 2 {
			frac += "0"
		}
		frac = frac[:2]
	}
	intPart := v
	if dot >= 0 {
		intPart = v[:dot]
	}
	for len(intPart) < 20 {
		intPart = "0" + intPart
	}
	return intPart, frac
}
