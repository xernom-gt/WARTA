package verification

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/middleware"
	"warta.com/api/internal/token"
)

func newFullTestApp(queueStore QueueStore, voteStore Store, manager *token.Manager) *fiber.App {
	h := NewHandler(queueStore, voteStore)
	app := fiber.New()
	app.Use(middleware.RequestID())

	v1 := app.Group("/api/v1")
	v1.Get("/verification-items", h.ListQueue)
	v1.Get("/verification-items/:item_id", h.GetItem)
	v1.Get("/verification-items/:item_id/votes", h.ListVotes)
	v1.Post("/verification-items/:item_id/votes", middleware.Bearer(manager, nil), h.CastVote)

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
		VotesAgree:           0,
		VotesDisagree:        0,
		TargetVotes:          3,
		Voters:               []string{},
		Status:               status,
		CreatedAt:            createdAt,
	}
}

// TestListVotes_History verifies GET /verification-items/:item_id/votes with pagination and ordering.
func TestListVotes_History(t *testing.T) {
	queueStore := NewMemoryQueueStore()
	voteStore := NewMemoryStore()
	voteStore.BindQueueStore(queueStore)
	manager := token.NewManager("test-secret-01234567890123456789", time.Hour)
	app := newFullTestApp(queueStore, voteStore, manager)

	itemID := "00000000-0000-0000-0000-000000000099"
	it := sampleQueueItem(itemID, time.Now().UTC(), true, ItemStatusMenunggu, ItemTypeLaporanKondisi)
	queueStore.Seed(it)

	// Cast 2 votes
	tok1, _ := manager.Sign("user-1")
	tok2, _ := manager.Sign("user-2")

	body1, _ := json.Marshal(CastVoteRequest{Choice: "setuju"})
	req1 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body1))
	req1.Header.Set("Authorization", "Bearer "+tok1)
	req1.Header.Set("Content-Type", "application/json")
	resp1, _ := app.Test(req1)
	resp1.Body.Close()

	body2, _ := json.Marshal(CastVoteRequest{Choice: "tidak_setuju"})
	req2 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body2))
	req2.Header.Set("Authorization", "Bearer "+tok2)
	req2.Header.Set("Content-Type", "application/json")
	resp2, _ := app.Test(req2)
	resp2.Body.Close()

	// GET vote history
	reqList := httptest.NewRequest(http.MethodGet, "/api/v1/verification-items/"+itemID+"/votes", nil)
	respList, err := app.Test(reqList)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer respList.Body.Close()

	if respList.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d", respList.StatusCode)
	}

	body, _ := io.ReadAll(respList.Body)
	var res ItemVoteListResult
	_ = json.Unmarshal(body, &res)

	if len(res.Data) != 2 || res.Meta.Total != 2 {
		t.Fatalf("expected 2 votes, got %d (total: %d)", len(res.Data), res.Meta.Total)
	}

	if res.Data[0].Choice != ChoiceSetuju || res.Data[1].Choice != ChoiceTidakSetuju {
		t.Errorf("expected choices [setuju, tidak_setuju], got [%s, %s]", res.Data[0].Choice, res.Data[1].Choice)
	}
}

// TestCastVote_SelfVoteAndDuplicateAndResolution verifies voting rules & consensus resolution.
func TestCastVote_SelfVoteAndDuplicateAndResolution(t *testing.T) {
	queueStore := NewMemoryQueueStore()
	voteStore := NewMemoryStore()
	voteStore.BindQueueStore(queueStore)
	manager := token.NewManager("test-secret-01234567890123456789", time.Hour)
	app := newFullTestApp(queueStore, voteStore, manager)

	itemID := "00000000-0000-0000-0000-000000000099"
	authorID := "author-01"
	it := sampleQueueItem(itemID, time.Now().UTC(), true, ItemStatusMenunggu, ItemTypeLaporanKondisi)
	it.AuthorUserID = authorID
	queueStore.Seed(it)

	// 1. Author tries to vote -> 403 Forbidden
	authorTok, _ := manager.Sign(authorID)
	body, _ := json.Marshal(CastVoteRequest{Choice: "setuju"})
	reqAuthor := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body))
	reqAuthor.Header.Set("Authorization", "Bearer "+authorTok)
	reqAuthor.Header.Set("Content-Type", "application/json")
	respAuthor, _ := app.Test(reqAuthor)
	respAuthor.Body.Close()

	if respAuthor.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for author self-vote, got %d", respAuthor.StatusCode)
	}

	// 2. Citizen 1 votes -> 201 Created
	c1Tok, _ := manager.Sign("citizen-01")
	reqC1 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body))
	reqC1.Header.Set("Authorization", "Bearer "+c1Tok)
	reqC1.Header.Set("Content-Type", "application/json")
	respC1, _ := app.Test(reqC1)
	respC1.Body.Close()

	if respC1.StatusCode != http.StatusCreated {
		t.Errorf("expected 201 Created, got %d", respC1.StatusCode)
	}

	// 3. Citizen 1 votes again -> 409 Conflict (duplicate)
	reqDup := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body))
	reqDup.Header.Set("Authorization", "Bearer "+c1Tok)
	reqDup.Header.Set("Content-Type", "application/json")
	respDup, _ := app.Test(reqDup)
	respDup.Body.Close()

	if respDup.StatusCode != http.StatusConflict {
		t.Errorf("expected 409 Conflict for duplicate vote, got %d", respDup.StatusCode)
	}

	// 4. Citizen 2 and Citizen 3 vote setuju -> Reach target_votes (3) -> Resolve item to terverifikasi
	c2Tok, _ := manager.Sign("citizen-02")
	c3Tok, _ := manager.Sign("citizen-03")

	reqC2 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body))
	reqC2.Header.Set("Authorization", "Bearer "+c2Tok)
	reqC2.Header.Set("Content-Type", "application/json")
	respC2, _ := app.Test(reqC2)
	respC2.Body.Close()

	reqC3 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body))
	reqC3.Header.Set("Authorization", "Bearer "+c3Tok)
	reqC3.Header.Set("Content-Type", "application/json")
	respC3, _ := app.Test(reqC3)
	respC3.Body.Close()

	// Check item status in queueStore
	updatedItem, _ := queueStore.GetItemByID(nil, itemID)
	if updatedItem.Status != ItemStatusTerverifikasi {
		t.Errorf("expected item status 'terverifikasi', got '%s'", updatedItem.Status)
	}
	if updatedItem.ResolvedAt == nil {
		t.Errorf("expected resolved_at to be populated")
	}

	// 5. Citizen 4 tries to vote on already resolved item -> 409 Conflict
	c4Tok, _ := manager.Sign("citizen-04")
	reqC4 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body))
	reqC4.Header.Set("Authorization", "Bearer "+c4Tok)
	reqC4.Header.Set("Content-Type", "application/json")
	respC4, _ := app.Test(reqC4)
	respC4.Body.Close()

	if respC4.StatusCode != http.StatusConflict {
		t.Errorf("expected 409 Conflict for voting on resolved item, got %d", respC4.StatusCode)
	}
}

// TestVoteEdgeCases_LockoutRules comprehensively tests the edge cases in Task 4:
// - exact error codes: self_vote_forbidden (403), already_voted (409), item_resolved (409)
// - unresolved-to-resolved transition upon disagree threshold reaching target_votes -> status "ditolak"
// - immutable vote behavior: votes cannot be modified or replaced
// - rejection of votes once resolved as ditolak
func TestVoteEdgeCases_LockoutRules(t *testing.T) {
	queueStore := NewMemoryQueueStore()
	voteStore := NewMemoryStore()
	voteStore.BindQueueStore(queueStore)
	manager := token.NewManager("edge-case-secret-0123456789012345", time.Hour)
	app := newFullTestApp(queueStore, voteStore, manager)

	itemID := "00000000-0000-0000-0000-000000000088"
	authorID := "author-88"
	it := sampleQueueItem(itemID, time.Now().UTC(), true, ItemStatusMenunggu, ItemTypeLaporanKondisi)
	it.AuthorUserID = authorID
	queueStore.Seed(it)

	// Case 1: Self-vote returns 403 with code "self_vote_forbidden"
	authorTok, _ := manager.Sign(authorID)
	body, _ := json.Marshal(CastVoteRequest{Choice: "setuju"})
	reqSelf := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(body))
	reqSelf.Header.Set("Authorization", "Bearer "+authorTok)
	reqSelf.Header.Set("Content-Type", "application/json")
	respSelf, err := app.Test(reqSelf)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer respSelf.Body.Close()

	if respSelf.StatusCode != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden, got %d", respSelf.StatusCode)
	}
	var errSelf struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.NewDecoder(respSelf.Body).Decode(&errSelf)
	if errSelf.Error.Code != "self_vote_forbidden" {
		t.Errorf("expected error code 'self_vote_forbidden', got '%s'", errSelf.Error.Code)
	}

	// Case 2: Citizen votes tidak_setuju
	voter1Tok, _ := manager.Sign("voter-1")
	bodyDisagree, _ := json.Marshal(CastVoteRequest{Choice: "tidak_setuju"})
	reqV1 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(bodyDisagree))
	reqV1.Header.Set("Authorization", "Bearer "+voter1Tok)
	reqV1.Header.Set("Content-Type", "application/json")
	respV1, _ := app.Test(reqV1)
	respV1.Body.Close()
	if respV1.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created for voter 1, got %d", respV1.StatusCode)
	}

	// Case 3: Duplicate vote returns 409 with code "already_voted"
	reqDup := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(bodyDisagree))
	reqDup.Header.Set("Authorization", "Bearer "+voter1Tok)
	reqDup.Header.Set("Content-Type", "application/json")
	respDup, _ := app.Test(reqDup)
	defer respDup.Body.Close()

	if respDup.StatusCode != http.StatusConflict {
		t.Errorf("expected 409 Conflict, got %d", respDup.StatusCode)
	}
	var errDup struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	_ = json.NewDecoder(respDup.Body).Decode(&errDup)
	if errDup.Error.Code != "already_voted" {
		t.Errorf("expected error code 'already_voted', got '%s'", errDup.Error.Code)
	}

	// Case 4: Voter 2 & Voter 3 vote tidak_setuju -> reaching target_votes (3)
	// Item transitions to "ditolak"
	voter2Tok, _ := manager.Sign("voter-2")
	voter3Tok, _ := manager.Sign("voter-3")

	reqV2 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(bodyDisagree))
	reqV2.Header.Set("Authorization", "Bearer "+voter2Tok)
	reqV2.Header.Set("Content-Type", "application/json")
	respV2, _ := app.Test(reqV2)
	respV2.Body.Close()

	reqV3 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(bodyDisagree))
	reqV3.Header.Set("Authorization", "Bearer "+voter3Tok)
	reqV3.Header.Set("Content-Type", "application/json")
	respV3, _ := app.Test(reqV3)
	respV3.Body.Close()

	// Verify item is now resolved as "ditolak" with resolved_at set
	resolvedItem, _ := queueStore.GetItemByID(nil, itemID)
	if resolvedItem.Status != ItemStatusDitolak {
		t.Errorf("expected item status 'ditolak', got '%s'", resolvedItem.Status)
	}
	if resolvedItem.ResolvedAt == nil {
		t.Errorf("expected resolved_at to be populated")
	}

	// Case 5: Voting on the resolved item (status ditolak) returns 409 with code "item_resolved"
	voter4Tok, _ := manager.Sign("voter-4")
	reqV4 := httptest.NewRequest(http.MethodPost, "/api/v1/verification-items/"+itemID+"/votes", bytes.NewReader(bodyDisagree))
	reqV4.Header.Set("Authorization", "Bearer "+voter4Tok)
	reqV4.Header.Set("Content-Type", "application/json")
	respV4, _ := app.Test(reqV4)
	defer respV4.Body.Close()

	if respV4.StatusCode != http.StatusConflict {
		t.Errorf("expected 409 Conflict for resolved item, got %d", respV4.StatusCode)
	}
	var errResolved struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	_ = json.NewDecoder(respV4.Body).Decode(&errResolved)
	if errResolved.Error.Code != "item_resolved" {
		t.Errorf("expected error code 'item_resolved', got '%s'", errResolved.Error.Code)
	}
}
