// Package project models the canonical procurement catalog (§3.2-§3.6).
// This milestone exposes the public read surface:
//
//	GET /projects                      catalog with filters, sort, ETag
//	GET /projects/map                  lightweight pins for a viewport (bbox)
//	GET /projects/{id}                 detail with embedded children
//	GET /projects/{id}/tenders         tender history ascending
//	GET /projects/{id}/locations       primary + sub-locations
//	GET /projects/{id}/risk-flags      active risk indicators
//	GET /projects/{id}/reports         submitted reports (reports store)
//	GET /projects/{id}/location-claims claims (claims store)
//	GET /projects/{id}/verification-items queue items (verification store)
//
// Writes arrive with later milestones; the catalog is import-sourced, so
// this package only reads (TASK.md §Projects).
package project

import (
	"context"
	"errors"
	"time"
)

// Status is one of the project statuses (§3.2 allowed values).
type Status string

// Valid Status values.
const (
	StatusMenunggu     Status = "menunggu"
	StatusTerverifikasi Status = "terverifikasi"
	StatusDitolak      Status = "ditolak"
	StatusSelesai      Status = "selesai"
)

// ParseStatus maps a raw query value onto a Status, reporting validity so
// handlers can render 422 for unknown values (§10.3).
func ParseStatus(raw string) (Status, bool) {
	switch Status(raw) {
	case StatusMenunggu, StatusTerverifikasi, StatusDitolak, StatusSelesai:
		return Status(raw), true
	default:
		return "", false
	}
}

// Precision levels (§3.2 allowed values).
const (
	PrecisionKabKota    = "kabupaten/kota"
	PrecisionKecamatan  = "kecamatan"
	PrecisionDesa       = "desa/kelurahan"
	PrecisionAlamatRuas = "alamat/ruas"
	PrecisionTitik      = "titik"
)

// ParsePrecision maps a raw query value onto a precision level.
func ParsePrecision(raw string) (string, bool) {
	switch raw {
	case PrecisionKabKota, PrecisionKecamatan, PrecisionDesa, PrecisionAlamatRuas, PrecisionTitik:
		return raw, true
	default:
		return "", false
	}
}

// SortKey is one explicit ordering of the catalog (openapi ProjectSort).
type SortKey string

// Valid SortKey values. SortCreatedDesc is the documented default.
const (
	SortTitleAsc     SortKey = "title"
	SortCreatedDesc  SortKey = "-created_at"
	SortPaguAsc      SortKey = "pagu_amount"
	SortPaguDesc     SortKey = "-pagu_amount"
	defaultSort      SortKey = SortCreatedDesc
)

// ParseSort maps a raw query value onto a SortKey, defaulting empty to
// "-created_at" and reporting rejection-worthy unknowns (§10.3).
func ParseSort(raw string) (SortKey, bool) {
	if raw == "" {
		return defaultSort, true
	}
	switch SortKey(raw) {
	case SortTitleAsc, SortCreatedDesc, SortPaguAsc, SortPaguDesc:
		return SortKey(raw), true
	default:
		return "", false
	}
}

// Project is the projects row (§3.2) plus read-time aggregates. Money stays
// a decimal string straight from NUMERIC(20,2); it is never parsed to float
// (api-guidelines §3.4).
type Project struct {
	ID                      string
	SPSECode                string
	Title                   string
	Satker                  string
	Category                string
	PaguAmount              string
	HPSAmount               string
	ContractAmount          *string
	ContractNote            *string
	City                    string
	IsOutsideDKI            bool
	PrecisionLevel          string
	LocationSource          string
	IsCanonicalClaimed      bool
	PrecisionResolutionNote *string
	Status                  Status
	SourceNote              *string
	CreatedAt               time.Time
	UpdatedAt               time.Time

	// Read-time joins (§12.2 derived: recomputed on every read, never stored).
	Years             []int
	ReportsCount      int
	VerificationsCount int
	IsRetender        bool // a failed tender exists (§6.7)
}

// Tender is a row of project_tenders (§3.4).
type Tender struct {
	ID        string
	ProjectID string
	SPSECode  string
	Status    string
	Note      *string
	CreatedAt time.Time
}

// Location is a row of project_locations (§3.5). Latitude/longitude are
// either both present or both null (§6.10).
type Location struct {
	ID             string
	ProjectID      string
	Name           *string
	Address        string
	City           string
	PrecisionLevel string
	Source         string
	Latitude       *float64
	Longitude      *float64
	IsVerified     bool
	IsPrimary      bool
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// RiskFlag is a row of project_risk_flags (§3.6).
type RiskFlag struct {
	ID          string
	ProjectID   string
	Code        string
	Label       string
	Description string
	Level       string
	CreatedAt   time.Time
}

// MapPin is the lightweight pin projection of GET /projects/map (§6.8).
type MapPin struct {
	ID             string   `json:"id"`
	Title          string   `json:"title"`
	Latitude       *float64 `json:"latitude"`
	Longitude      *float64 `json:"longitude"`
	PrecisionLevel string   `json:"precision_level"`
	Status         Status   `json:"status"`
	Category       string   `json:"category"`
}

// ErrNotFound is returned by lookups when no row matches.
var ErrNotFound = errors.New("project: not found")

// ListFilter carries the parsed query parameters of GET /projects (§6.6).
// Nil pointers mean "filter absent"; Sort defaults to -created_at.
type ListFilter struct {
	Q             *string
	Category      *string
	City          *string
	Status        *Status
	Year          *int
	Precision     *string
	IsOutsideDKI  *bool
	IsRetender    *bool
	Sort          SortKey
	Page          int
	Limit         int
}

// MapFilter carries the parsed query parameters of GET /projects/map (§6.8).
// The bbox is required and pre-validated by the handler.
type MapFilter struct {
	MinLng, MinLat, MaxLng, MaxLat float64
	Status                         *Status
	Category                       *string
}

// Meta is the pagination envelope (openapi Meta, §3.2 collection shape).
type Meta struct {
	Page    int  `json:"page"`
	Limit   int  `json:"limit"`
	Total   int  `json:"total"`
	HasNext bool `json:"has_next"`
}

// ListResult is one catalog page plus its pagination metadata.
type ListResult struct {
	Data []*Project `json:"data"`
	Meta Meta       `json:"meta"`
}

// Store reads the projects domain. Writes arrive with the import milestone
// and extend this interface.
type Store interface {
	// List returns one filtered, sorted catalog page.
	List(ctx context.Context, filter ListFilter) (*ListResult, error)
	// FindByID returns one project with its read-time aggregates populated.
	FindByID(ctx context.Context, id string) (*Project, error)
	// MapPins returns pins inside a viewport for GET /projects/map.
	MapPins(ctx context.Context, filter MapFilter) ([]*MapPin, error)
	// ListTenders returns the tender history, created_at ascending (§6.9).
	ListTenders(ctx context.Context, projectID string) ([]*Tender, error)
	// ListLocations returns primary + sub-locations, primary first (§6.10).
	ListLocations(ctx context.Context, projectID string) ([]*Location, error)
	// ListRiskFlags returns active flags, creation order (§6.11).
	ListRiskFlags(ctx context.Context, projectID string) ([]*RiskFlag, error)
}
