package project

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"


	"warta.com/api/internal/middleware"
)

func newTestApp(store Store) *fiber.App {
	h := NewHandler(store)
	app := fiber.New()
	app.Use(middleware.RequestID())
	v1 := app.Group("/api/v1")
	v1.Get("/projects", h.ListProjects)
	v1.Get("/projects/map", h.ListProjectMapPins)
	v1.Get("/projects/:id", h.GetProject)
	v1.Get("/projects/:id/tenders", h.ListProjectTenders)
	v1.Get("/projects/:id/locations", h.ListProjectLocations)
	v1.Get("/projects/:id/risk-flags", h.ListProjectRiskFlags)
	v1.Get("/projects/:id/reports", h.ListProjectReports)
	v1.Get("/projects/:id/location-claims", h.ListProjectClaims)
	v1.Get("/projects/:id/verification-items", h.ListProjectItems)
	return app
}

func sampleProject(id string, contract *string) *Project {
	return &Project{
		ID:                 id,
		Title:              "Pembangunan Jembatan Kali Anyar",
		SPSECode:           "SPSE-1001",
		Satker:             "Dinas Bina Marga",
		Category:           "Jalan & Jembatan",
		City:               "Jakarta Timur",
		PaguAmount:         "516020000000.00",
		HPSAmount:          "516020000000.00",
		ContractAmount:     contract,
		PrecisionLevel:     "kecamatan",
		LocationSource:     "SPSE",
		IsCanonicalClaimed: false,
		Status:             StatusMenunggu,
		CreatedAt:          time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
		UpdatedAt:          time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC),
	}
}

// TestDataIntegrity_UnpublishedContract verifies that unpublished contracts
// keep contract_amount null, contract_available false, and derived kontrak_* null.
func TestDataIntegrity_UnpublishedContract(t *testing.T) {
	p := sampleProject("p-1", nil)
	summary := p.SummaryView()

	if summary.ContractAmount != nil {
		t.Errorf("expected ContractAmount to be nil, got %v", *summary.ContractAmount)
	}
	if summary.ContractAvailable != false {
		t.Errorf("expected ContractAvailable to be false, got true")
	}
	if summary.Derived.KontrakCompact != nil {
		t.Errorf("expected Derived.KontrakCompact to be nil, got %v", *summary.Derived.KontrakCompact)
	}
	if summary.Derived.KontrakFull != nil {
		t.Errorf("expected Derived.KontrakFull to be nil, got %v", *summary.Derived.KontrakFull)
	}
}

// TestDataIntegrity_PublishedContract verifies published contracts format rupiah correctly.
func TestDataIntegrity_PublishedContract(t *testing.T) {
	amount := "500000000000.00"
	p := sampleProject("p-1", &amount)
	summary := p.SummaryView()

	if summary.ContractAmount == nil || *summary.ContractAmount != amount {
		t.Errorf("expected ContractAmount %s", amount)
	}
	if summary.ContractAvailable != true {
		t.Errorf("expected ContractAvailable true")
	}
	if summary.Derived.KontrakCompact == nil || *summary.Derived.KontrakCompact != "Rp500 miliar" {
		t.Errorf("expected 'Rp500 miliar', got %v", summary.Derived.KontrakCompact)
	}
	if summary.Derived.KontrakFull == nil || *summary.Derived.KontrakFull != "Rp500.000.000.000" {
		t.Errorf("expected 'Rp500.000.000.000', got %v", summary.Derived.KontrakFull)
	}
}

// TestDataIntegrity_YearsArrayRule verifies empty years returns [] and not json null.
func TestDataIntegrity_YearsArrayRule(t *testing.T) {
	p := sampleProject("p-1", nil)
	p.Years = nil

	summary := p.SummaryView()
	bytes, err := json.Marshal(summary)
	if err != nil {
		t.Fatalf("marshal failed: %v", err)
	}

	var raw map[string]any
	_ = json.Unmarshal(bytes, &raw)
	yearsVal, exists := raw["years"]
	if !exists || yearsVal == nil {
		t.Fatalf("years must be serialized as array, got: %v", yearsVal)
	}
	arr, ok := yearsVal.([]any)
	if !ok || len(arr) != 0 {
		t.Fatalf("expected empty array [], got %v", arr)
	}
}

// TestDataIntegrity_IsRetenderRule verifies is_retender flag based on failed tenders.
func TestDataIntegrity_IsRetenderRule(t *testing.T) {
	store := NewMemoryStore()
	p := sampleProject("00000000-0000-0000-0000-000000000001", nil)

	// 1. Without failed tender -> is_retender = false
	tenders1 := []*Tender{
		{ID: "t-1", ProjectID: p.ID, SPSECode: "SPSE-1", Status: "selesai"},
	}
	store.Seed(p, []int{2025}, tenders1, nil, nil, 3, 5)

	res, err := store.List(nil, ListFilter{})
	if err != nil {
		t.Fatalf("store.List failed: %v", err)
	}
	if len(res.Data) != 1 || res.Data[0].IsRetender != false {
		t.Errorf("expected is_retender false, got %v", res.Data[0].IsRetender)
	}

	// 2. With failed tender -> is_retender = true
	store2 := NewMemoryStore()
	tenders2 := []*Tender{
		{ID: "t-1", ProjectID: p.ID, SPSECode: "SPSE-1", Status: "gagal"},
	}
	store2.Seed(p, []int{2025}, tenders2, nil, nil, 3, 5)

	res2, err := store2.List(nil, ListFilter{})
	if err != nil {
		t.Fatalf("store2.List failed: %v", err)
	}
	if len(res2.Data) != 1 || res2.Data[0].IsRetender != true {
		t.Errorf("expected is_retender true, got %v", res2.Data[0].IsRetender)
	}
}

// TestHandler_ListProjects_ETag verifies ETag and 304 handling.
func TestHandler_ListProjects_ETag(t *testing.T) {
	store := NewMemoryStore()
	p := sampleProject("00000000-0000-0000-0000-000000000001", nil)
	store.Seed(p, []int{2025, 2026}, nil, nil, nil, 2, 4)

	app := newTestApp(store)

	req1 := httptest.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	resp1, err := app.Test(req1)
	if err != nil {
		t.Fatalf("GET /projects failed: %v", err)
	}
	defer resp1.Body.Close()

	if resp1.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp1.StatusCode)
	}

	etag := resp1.Header.Get("ETag")
	if etag == "" {
		t.Fatal("expected ETag header")
	}

	// Conditional GET
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/projects", nil)
	req2.Header.Set("If-None-Match", etag)
	resp2, err := app.Test(req2)
	if err != nil {
		t.Fatalf("conditional GET failed: %v", err)
	}
	defer resp2.Body.Close()

	if resp2.StatusCode != http.StatusNotModified {
		t.Fatalf("expected 304 Not Modified, got %d", resp2.StatusCode)
	}
}

// TestHandler_GetProjectDetail verifies project detail embedding.
func TestHandler_GetProjectDetail(t *testing.T) {
	store := NewMemoryStore()
	pID := "00000000-0000-0000-0000-000000000001"
	p := sampleProject(pID, nil)

	primaryLoc := &Location{
		ID:             "loc-1",
		ProjectID:      pID,
		Address:        "Jl. Raya No. 1",
		City:           "Jakarta Timur",
		PrecisionLevel: "kecamatan",
		Source:         "SPSE",
		IsPrimary:      true,
	}
	subLoc := &Location{
		ID:             "loc-2",
		ProjectID:      pID,
		Address:        "Jl. Sub No. 2",
		City:           "Jakarta Timur",
		PrecisionLevel: "titik",
		Source:         "warga",
		IsPrimary:      false,
		IsVerified:     true,
	}

	flag := &RiskFlag{
		ProjectID:   pID,
		Code:        "CONTRACT_MISSING",
		Label:       "Kontrak Belum Terbit",
		Level:       "sedang",
		Description: "Data kontrak belum dipublikasikan",
	}

	store.Seed(p, []int{2025}, nil, []*Location{primaryLoc, subLoc}, []*RiskFlag{flag}, 2, 4)
	app := newTestApp(store)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/projects/"+pID, nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("GET /projects/:id failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var env struct {
		Data ProjectDetailView `json:"data"`
	}
	if err := json.Unmarshal(body, &env); err != nil {
		t.Fatalf("failed to decode detail JSON: %v", err)
	}

	if env.Data.ID != pID {
		t.Errorf("expected ID %s, got %s", pID, env.Data.ID)
	}
	if env.Data.Location == nil || env.Data.Location.Address != "Jl. Raya No. 1" {
		t.Errorf("primary location mismatch: %v", env.Data.Location)
	}
	if len(env.Data.SubLocations) != 1 || env.Data.SubLocations[0].Address != "Jl. Sub No. 2" {
		t.Errorf("sub-locations mismatch: %v", env.Data.SubLocations)
	}
	if len(env.Data.RiskFlags) != 1 || env.Data.RiskFlags[0].Code != "CONTRACT_MISSING" {
		t.Errorf("risk flags mismatch: %v", env.Data.RiskFlags)
	}
	if env.Data.Derived.PrecisionBadge != "Kecamatan" {
		t.Errorf("expected PrecisionBadge 'Kecamatan', got '%s'", env.Data.Derived.PrecisionBadge)
	}
}

