package verification

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

func newTestApp(queueStore QueueStore, voteStore Store) *fiber.App {
	h := NewHandler(queueStore, voteStore)
	app := fiber.New()
	app.Use(middleware.RequestID())

	v1 := app.Group("/api/v1")
	v1.Get("/verification-items", h.ListQueue)
	v1.Get("/verification-items/:item_id", h.GetItem)

	return app
}

func sampleQueueItem(id string, createdAt time.Time, authorIsActive bool, status ItemStatus, itemType ItemType) *VerificationItem {
	reportID := "rep-" + id
	category := "fisik_rusak"
	narrative := "Papan nama proyek tidak ditemukan di lokasi cor jalan."
	address := "Jl. Lapangan Banteng Barat No. 34"
	photo := "https://storage.warta.id/reports/photo1.jpg"
	lat := -6.1702
	lon := 106.8341
	dist := 12.5

	return &VerificationItem{
		ID:                   id,
		ProjectID:            "00000000-0000-0000-0000-000000000001",
		ProjectTitle:         "Pemeliharaan Jalan Lapangan Banteng",
		SPSECode:             "40123999",
		Satker:               "Dinas Bina Marga",
		PaguAmount:           "1500000000.00",
		ItemType:             string(itemType),
		ReportID:             &reportID,
		AuthorUserID:         "u-" + id,
		AuthorDisplayName:    "warga_" + id,
		AuthorIsActive:       authorIsActive,
		Category:             &category,
		Narrative:            &narrative,
		ProposedAddress:      &address,
		Latitude:             &lat,
		Longitude:            &lon,
		DistanceFromProjectM: &dist,
		ExifStatus:           "valid",
		PhotoURL:             &photo,
		VotesAgree:           1,
		VotesDisagree:        0,
		TargetVotes:          3,
		Voters:               []string{"voter1"},
		Status:               status,
		CreatedAt:            createdAt,
	}
}

// TestListQueue_DefaultSortingAndActiveRule verifies created_at ASC order and deactivated author exclusion.
func TestListQueue_DefaultSortingAndActiveRule(t *testing.T) {
	queueStore := NewMemoryQueueStore()
	t1 := time.Date(2026, 1, 1, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 1, 2, 10, 0, 0, 0, time.UTC)
	t3 := time.Date(2026, 1, 3, 10, 0, 0, 0, time.UTC)

	// item1: older (active)
	// item2: newer (active)
	// item3: middle (deactivated author -> must be excluded)
	item1 := sampleQueueItem("item-1", t1, true, ItemStatusMenunggu, ItemTypeLaporanKondisi)
	item2 := sampleQueueItem("item-2", t3, true, ItemStatusMenunggu, ItemTypeLaporanKondisi)
	item3 := sampleQueueItem("item-3", t2, false, ItemStatusMenunggu, ItemTypeLaporanKondisi) // inactive!

	queueStore.Seed(item2, item1, item3) // seeded unsorted
	app := newTestApp(queueStore, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/verification-items", nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	body, _ := io.ReadAll(resp.Body)
	var res QueueResult
	_ = json.Unmarshal(body, &res)

	// Item 3 must be excluded -> only 2 items
	if len(res.Data) != 2 {
		t.Fatalf("expected 2 items, got %d", len(res.Data))
	}

	// Must be sorted oldest first (created_at ASC)
	if res.Data[0].ID != "item-1" || res.Data[1].ID != "item-2" {
		t.Errorf("expected [item-1, item-2] ordered ASC, got [%s, %s]", res.Data[0].ID, res.Data[1].ID)
	}

	// Check category_label derived formatting
	if res.Data[0].CategoryLabel == nil || *res.Data[0].CategoryLabel != "Fisik Rusak" {
		t.Errorf("expected CategoryLabel 'Fisik Rusak', got %v", res.Data[0].CategoryLabel)
	}
}

// TestListQueue_Filters verifies filtering by status and item_type.
func TestListQueue_Filters(t *testing.T) {
	queueStore := NewMemoryQueueStore()
	t0 := time.Now().UTC()

	it1 := sampleQueueItem("it-1", t0, true, ItemStatusMenunggu, ItemTypeLaporanKondisi)
	it2 := sampleQueueItem("it-2", t0, true, ItemStatusTerverifikasi, ItemTypeLaporanKondisi)
	it3 := sampleQueueItem("it-3", t0, true, ItemStatusMenunggu, ItemTypeKlaimLokasi)

	queueStore.Seed(it1, it2, it3)
	app := newTestApp(queueStore, nil)

	// Filter by status=terverifikasi
	req1 := httptest.NewRequest(http.MethodGet, "/api/v1/verification-items?status=terverifikasi", nil)
	resp1, _ := app.Test(req1)
	defer resp1.Body.Close()
	var res1 QueueResult
	body1, _ := io.ReadAll(resp1.Body)
	_ = json.Unmarshal(body1, &res1)
	if len(res1.Data) != 1 || res1.Data[0].ID != "it-2" {
		t.Errorf("expected 1 item with ID it-2, got %d", len(res1.Data))
	}

	// Filter by item_type=klaim_lokasi
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/verification-items?item_type=klaim_lokasi", nil)
	resp2, _ := app.Test(req2)
	defer resp2.Body.Close()
	var res2 QueueResult
	body2, _ := io.ReadAll(resp2.Body)
	_ = json.Unmarshal(body2, &res2)
	if len(res2.Data) != 1 || res2.Data[0].ID != "it-3" {
		t.Errorf("expected 1 item with ID it-3, got %d", len(res2.Data))
	}
}

// TestGetVerificationItem_Detail verifies item detail endpoint.
func TestGetVerificationItem_Detail(t *testing.T) {
	queueStore := NewMemoryQueueStore()
	itemID := "00000000-0000-0000-0000-000000000099"
	it := sampleQueueItem(itemID, time.Now().UTC(), true, ItemStatusMenunggu, ItemTypeLaporanKondisi)
	queueStore.Seed(it)

	app := newTestApp(queueStore, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/verification-items/"+itemID, nil)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", resp.StatusCode)
	}

	var res struct {
		Data ItemView `json:"data"`
	}
	body, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(body, &res)

	if res.Data.ID != itemID {
		t.Errorf("expected ID %s, got %s", itemID, res.Data.ID)
	}
	if res.Data.VotesAgree != 1 || res.Data.TargetVotes != 3 {
		t.Errorf("vote count mismatch: agree=%d, target=%d", res.Data.VotesAgree, res.Data.TargetVotes)
	}
	if len(res.Data.Voters) != 1 || res.Data.Voters[0] != "voter1" {
		t.Errorf("voters mismatch: %v", res.Data.Voters)
	}
}
