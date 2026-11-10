package project

import (
	"warta.com/api/internal/httpx"
	"warta.com/api/internal/labels"
)

// DerivedView is the derived sub-object (openapi ProjectDerived, §3.7):
// read-only labels recomputed on every read, never accepted on write.
type DerivedView struct {
	PaguCompact    string  `json:"pagu_compact"`
	PaguFull       string  `json:"pagu_full"`
	HPSCompact     string  `json:"hps_compact"`
	HPSFull        string  `json:"hps_full"`
	KontrakCompact *string `json:"kontrak_compact"`
	KontrakFull    *string `json:"kontrak_full"`
	PrecisionBadge string  `json:"precision_badge"`
}

// ProjectSummaryView is the JSON shape of one catalog row (openapi
// ProjectSummary, §6.6). contract_amount is the exact decimal string or
// json null when unpublished — never "0.00" (§3.5).
type ProjectSummaryView struct {
	ID                 string       `json:"id"`
	Title              string       `json:"title"`
	SPSECode           string       `json:"spse_code"`
	Satker             string       `json:"satker"`
	Category           string       `json:"category"`
	City               string       `json:"city"`
	PaguAmount         string       `json:"pagu_amount"`
	HPSAmount          string       `json:"hps_amount"`
	ContractAmount     *string      `json:"contract_amount"`
	ContractAvailable  bool         `json:"contract_available"`
	Years              []int        `json:"years"`
	PrecisionLevel     string       `json:"precision_level"`
	LocationSource     string       `json:"location_source"`
	IsCanonicalClaimed bool         `json:"is_canonical_claimed"`
	IsOutsideDKI       bool         `json:"is_outside_dki"`
	IsRetender         bool         `json:"is_retender"`
	ReportsCount       int          `json:"reports_count"`
	VerificationsCount int          `json:"verifications_count"`
	Status             Status       `json:"status"`
	Derived            DerivedView  `json:"derived"`
}

// ProjectDetailView is the JSON shape of GET /projects/{id} (openapi
// ProjectDetail, §6.7): the summary plus contract_note, the embedded primary
// location, precision resolution/source notes, and the child collections.
type ProjectDetailView struct {
	ProjectSummaryView
	ContractNote     *string            `json:"contract_note"`
	PrecisionNote    *string            `json:"precision_resolution_note"`
	SourceNote       *string            `json:"source_note"`
	Location         *LocationSummaryView `json:"location"`
	Tenders          []TenderView       `json:"tenders"`
	SubLocations     []SubLocationView  `json:"sub_locations"`
	RiskFlags        []RiskFlagView     `json:"risk_flags"`
}

// derived renders the §12.2 label set for a project row. contract fields
// follow §3.5: a null contract_amount yields kontrak_* null and
// contract_available false — never "0.00".
func (p *Project) derived() DerivedView {
	d := DerivedView{
		PaguCompact:    labels.RupiahCompact(p.PaguAmount),
		PaguFull:       labels.RupiahFull(p.PaguAmount),
		HPSCompact:     labels.RupiahCompact(p.HPSAmount),
		HPSFull:        labels.RupiahFull(p.HPSAmount),
		PrecisionBadge: labels.PrecisionBadge(p.PrecisionLevel),
	}
	if p.ContractAmount != nil {
		compact := labels.RupiahCompact(*p.ContractAmount)
		full := labels.RupiahFull(*p.ContractAmount)
		d.KontrakCompact = &compact
		d.KontrakFull = &full
	}
	return d
}

// SummaryView renders the catalog-row shape.
func (p *Project) SummaryView() ProjectSummaryView {
	return ProjectSummaryView{
		ID:                 p.ID,
		Title:              p.Title,
		SPSECode:           p.SPSECode,
		Satker:             p.Satker,
		Category:           p.Category,
		City:               p.City,
		PaguAmount:         p.PaguAmount,
		HPSAmount:          p.HPSAmount,
		ContractAmount:     p.ContractAmount,
		ContractAvailable:  p.ContractAmount != nil,
		Years:              p.years(),
		PrecisionLevel:     p.PrecisionLevel,
		LocationSource:     p.LocationSource,
		IsCanonicalClaimed: p.IsCanonicalClaimed,
		IsOutsideDKI:       p.IsOutsideDKI,
		IsRetender:         p.IsRetender,
		ReportsCount:       p.ReportsCount,
		VerificationsCount: p.VerificationsCount,
		Status:             p.Status,
		Derived:            p.derived(),
	}
}

// years guarantees [] over null for empty year sets (§12.3).
func (p *Project) years() []int {
	if p.Years == nil {
		return []int{}
	}
	return p.Years
}

// LocationSummaryView is the JSON shape of the embedded primary location
// (openapi ProjectLocationSummary). is_canonical_claimed mirrors the owning
// project's flag per §6.7's example.
type LocationSummaryView struct {
	Address            string   `json:"address"`
	City               string   `json:"city"`
	PrecisionLevel     string   `json:"precision_level"`
	Source             string   `json:"source"`
	IsCanonicalClaimed bool     `json:"is_canonical_claimed"`
	Latitude           *float64 `json:"latitude"`
	Longitude          *float64 `json:"longitude"`
}

// TenderView is the JSON shape of a tender row (§6.9).
type TenderView struct {
	ID        string  `json:"id"`
	SPSECode  string  `json:"spse_code"`
	Status    string  `json:"status"`
	Note      *string `json:"note"`
	CreatedAt string  `json:"created_at"`
}

// SubLocationView is the JSON shape of a detail-embedded sub-location
// (openapi SubLocation). Note the boolean renders as `verified`.
type SubLocationView struct {
	ID      string `json:"id"`
	Name    *string `json:"name"`
	Address string `json:"address"`
	City    string `json:"city"`
	Verified bool  `json:"verified"`
}

// RiskFlagView is the JSON shape of a risk flag (§6.7/§6.11).
type RiskFlagView struct {
	Code        string `json:"code"`
	Label       string `json:"label"`
	Level       string `json:"level"`
	Description string `json:"description"`
}

// tenderView renders one tender row.
func tenderView(t *Tender) TenderView {
	return TenderView{
		ID:        t.ID,
		SPSECode:  t.SPSECode,
		Status:    t.Status,
		Note:      t.Note,
		CreatedAt: httpx.ISO8601(t.CreatedAt),
	}
}

// locationSummaryView renders the primary location; coord-less locations
// serialize latitude/longitude as null (§6.8 allows either shape).
func locationSummaryView(l *Location, canonicalClaimed bool) LocationSummaryView {
	return LocationSummaryView{
		Address:            l.Address,
		City:               l.City,
		PrecisionLevel:     l.PrecisionLevel,
		Source:             l.Source,
		IsCanonicalClaimed: canonicalClaimed,
		Latitude:           l.Latitude,
		Longitude:          l.Longitude,
	}
}

// subLocationView renders one non-primary location.
func subLocationView(l *Location) SubLocationView {
	return SubLocationView{
		ID:       l.ID,
		Name:     l.Name,
		Address:  l.Address,
		City:     l.City,
		Verified: l.IsVerified,
	}
}

// riskFlagView renders one risk flag row (no id — the flag is keyed by code,
// §3.6 one active flag per code per project).
func riskFlagView(f *RiskFlag) RiskFlagView {
	return RiskFlagView{Code: f.Code, Label: f.Label, Level: f.Level, Description: f.Description}
}

// ProjectLocations is the response payload for GET /projects/{project_id}/locations.
type ProjectLocations struct {
	PrimaryLocationID *string        `json:"primary_location_id"`
	Locations         []LocationView `json:"locations"`
}

// LocationView is one item in ProjectLocations.locations.
type LocationView struct {
	ID             string   `json:"id"`
	Name           *string  `json:"name"`
	Address        string   `json:"address"`
	City           string   `json:"city"`
	PrecisionLevel string   `json:"precision_level"`
	Source         string   `json:"source"`
	Latitude       *float64 `json:"latitude"`
	Longitude      *float64 `json:"longitude"`
	IsVerified     bool     `json:"is_verified"`
	IsPrimary      bool     `json:"is_primary"`
}

func locationView(l *Location) LocationView {
	return LocationView{
		ID:             l.ID,
		Name:           l.Name,
		Address:        l.Address,
		City:           l.City,
		PrecisionLevel: l.PrecisionLevel,
		Source:         l.Source,
		Latitude:       l.Latitude,
		Longitude:      l.Longitude,
		IsVerified:     l.IsVerified,
		IsPrimary:      l.IsPrimary,
	}
}
