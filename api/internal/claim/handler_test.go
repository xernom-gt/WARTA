package claim

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/token"
)

func newTestApp(store Store, manager *token.Manager) *fiber.App {
	h := NewHandler(store)
	app := fiber.New()
	app.Use(middleware.RequestID())

	v1 := app.Group("/api/v1")
	v1.Post("/projects/:project_id/location-claims", middleware.Bearer(manager, nil), h.CreateClaim)
	v1.Get("/location-claims/:claim_id", h.GetClaim)
	v1.Get("/location-claims/:claim_id/media", h.GetClaimMedia)
	v1.Post("/location-claims/:claim_id/media", middleware.Bearer(manager, nil), h.UploadClaimMedia)
	v1.Delete("/location-claims/:claim_id/media/:media_id", middleware.Bearer(manager, nil), h.DeleteClaimMedia)

	return app
}

// TestCreateLocationClaim_Success verifies claim creation with distance calculation and address rule.
func TestCreateLocationClaim_Success(t *testing.T) {
	store := NewMemoryStore()
	manager := token.NewManager("test-secret-key-1234567890123456", time.Hour)
	app := newTestApp(store, manager)

	projectID := "00000000-0000-0000-0000-000000000001"
	userID := "00000000-0000-0000-0000-000000000099"
	tok, _ := manager.Issue(userID)

	// Set primary coords of project: Monas ~ (-6.1754, 106.8272)
	store.SetProjectPrimaryCoords(projectID, -6.1754, 106.8272)

	addrLine := "Jl. Medan Merdeka Barat No. 1"
	lat := -6.1760
	lon := 106.8270

	body, _ := json.Marshal(CreateClaimInput{
		ProposedAddress:   "Jl. Medan Merdeka Barat No. 1, Gambir",
		AddressLine:       &addrLine,
		Kecamatan:         "Gambir",
		ProposedPrecision: "alamat/ruas",
		Latitude:          &lat,
		Longitude:         &lon,
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/"+projectID+"/location-claims", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 201 Created, got %d: %s", resp.StatusCode, string(respBody))
	}

	locHeader := resp.Header.Get("Location")
	if locHeader == "" {
		t.Errorf("expected Location header in 201 response")
	}

	var res struct {
		Data ClaimView `json:"data"`
	}
	resBytes, _ := io.ReadAll(resp.Body)
	_ = json.Unmarshal(resBytes, &res)

	if res.Data.Status != StatusMenunggu {
		t.Errorf("expected status 'menunggu', got '%s'", res.Data.Status)
	}
	if res.Data.DistanceFromProjectM == nil || *res.Data.DistanceFromProjectM <= 0 {
		t.Errorf("expected positive distance_from_project_m, got %v", res.Data.DistanceFromProjectM)
	}
}

// TestCreateLocationClaim_AddressLineException verifies kecamatan precision doesn't require address_line.
func TestCreateLocationClaim_AddressLineException(t *testing.T) {
	store := NewMemoryStore()
	manager := token.NewManager("test-secret-key-1234567890123456", time.Hour)
	app := newTestApp(store, manager)

	projectID := "00000000-0000-0000-0000-000000000001"
	tok, _ := manager.Issue("user-1")

	// Proposed precision = kecamatan, address_line is omitted -> should succeed
	body, _ := json.Marshal(CreateClaimInput{
		ProposedAddress:   "Kecamatan Gambir",
		Kecamatan:         "Gambir",
		ProposedPrecision: "kecamatan",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/"+projectID+"/location-claims", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", resp.StatusCode)
	}
}

// TestCreateLocationClaim_ConflictWhenAlreadyAccepted verifies 409 when project already has accepted claim.
func TestCreateLocationClaim_ConflictWhenAlreadyAccepted(t *testing.T) {
	store := NewMemoryStore()
	manager := token.NewManager("test-secret-key-1234567890123456", time.Hour)
	app := newTestApp(store, manager)

	projectID := "00000000-0000-0000-0000-000000000001"
	tok, _ := manager.Issue("user-1")

	// Seed existing accepted claim
	store.Seed(&Claim{
		ID:        "claim-old",
		ProjectID: projectID,
		UserID:    "user-old",
		Status:    StatusDiterima,
	})

	body, _ := json.Marshal(CreateClaimInput{
		ProposedAddress:   "Kecamatan Gambir",
		Kecamatan:         "Gambir",
		ProposedPrecision: "kecamatan",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/"+projectID+"/location-claims", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict, got %d", resp.StatusCode)
	}
}

// TestLocationClaimMedia_OnePhotoRuleAndDeletion verifies 1-photo limit and menunggu-only deletion.
func TestLocationClaimMedia_OnePhotoRuleAndDeletion(t *testing.T) {
	store := NewMemoryStore()
	manager := token.NewManager("test-secret-key-1234567890123456", time.Hour)
	app := newTestApp(store, manager)

	authorID := "00000000-0000-0000-0000-000000000001"
	otherID := "00000000-0000-0000-0000-000000000002"
	authorTok, _ := manager.Issue(authorID)
	otherTok, _ := manager.Issue(otherID)

	claimID := "00000000-0000-0000-0000-000000000099"
	store.Seed(&Claim{
		ID:        claimID,
		ProjectID: "p-1",
		UserID:    authorID,
		Status:    StatusMenunggu,
	})

	// 1. Upload photo as author
	bodyBuf := &bytes.Buffer{}
	mpWriter := multipart.NewWriter(bodyBuf)
	part, _ := mpWriter.CreateFormFile("file", "board.jpg")
	part.Write([]byte("fake-jpeg-content"))
	mpWriter.Close()

	reqUpload := httptest.NewRequest(http.MethodPost, "/api/v1/location-claims/"+claimID+"/media", bodyBuf)
	reqUpload.Header.Set("Authorization", "Bearer "+authorTok)
	reqUpload.Header.Set("Content-Type", mpWriter.FormDataContentType())

	respUpload, err := app.Test(reqUpload)
	if err != nil {
		t.Fatalf("upload request failed: %v", err)
	}
	defer respUpload.Body.Close()

	if respUpload.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 Created, got %d", respUpload.StatusCode)
	}

	var resMedia struct {
		Data MediaView `json:"data"`
	}
	_ = json.NewDecoder(respUpload.Body).Decode(&resMedia)
	mediaID := resMedia.Data.ID

	// 2. Second photo should return 409 (One-photo rule)
	bodyBuf2 := &bytes.Buffer{}
	mpWriter2 := multipart.NewWriter(bodyBuf2)
	part2, _ := mpWriter2.CreateFormFile("file", "board2.jpg")
	part2.Write([]byte("fake-jpeg-content-2"))
	mpWriter2.Close()

	reqUpload2 := httptest.NewRequest(http.MethodPost, "/api/v1/location-claims/"+claimID+"/media", bodyBuf2)
	reqUpload2.Header.Set("Authorization", "Bearer "+authorTok)
	reqUpload2.Header.Set("Content-Type", mpWriter2.FormDataContentType())

	respUpload2, _ := app.Test(reqUpload2)
	defer respUpload2.Body.Close()

	if respUpload2.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 Conflict for second photo, got %d", respUpload2.StatusCode)
	}

	// 3. Other user trying to delete photo should return 403
	reqDelOther := httptest.NewRequest(http.MethodDelete, "/api/v1/location-claims/"+claimID+"/media/"+mediaID, nil)
	reqDelOther.Header.Set("Authorization", "Bearer "+otherTok)
	respDelOther, _ := app.Test(reqDelOther)
	defer respDelOther.Body.Close()

	if respDelOther.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden for non-author delete, got %d", respDelOther.StatusCode)
	}

	// 4. Author deletes photo successfully while claim is menunggu
	reqDelAuthor := httptest.NewRequest(http.MethodDelete, "/api/v1/location-claims/"+claimID+"/media/"+mediaID, nil)
	reqDelAuthor.Header.Set("Authorization", "Bearer "+authorTok)
	respDelAuthor, _ := app.Test(reqDelAuthor)
	defer respDelAuthor.Body.Close()

	if respDelAuthor.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 No Content for author delete, got %d", respDelAuthor.StatusCode)
	}
}

// TestLocationClaimAcceptancePath verifies acceptance flow.
func TestLocationClaimAcceptancePath(t *testing.T) {
	store := NewMemoryStore()
	claimID := "claim-101"
	projectID := "proj-1"

	store.Seed(&Claim{
		ID:        claimID,
		ProjectID: projectID,
		UserID:    "user-1",
		Status:    StatusMenunggu,
	})

	// Accept claim
	if err := store.AcceptClaim(context.Background(), claimID); err != nil {
		t.Fatalf("AcceptClaim failed: %v", err)
	}

	c, _ := store.GetByID(context.Background(), claimID)
	if c.Status != StatusDiterima {
		t.Errorf("expected claim status 'diterima', got '%s'", c.Status)
	}
	if c.DecidedAt == nil {
		t.Errorf("expected decided_at to be set")
	}

	// Trying to accept a second claim on the same project should fail with conflict
	claimID2 := "claim-102"
	store.Seed(&Claim{
		ID:        claimID2,
		ProjectID: projectID,
		UserID:    "user-2",
		Status:    StatusMenunggu,
	})

	if err := store.AcceptClaim(context.Background(), claimID2); err != ErrProjectHasAcceptedClaim {
		t.Fatalf("expected ErrProjectHasAcceptedClaim, got %v", err)
	}
}

func TestClaimValidation_MalformedUUID(t *testing.T) {
	store := NewMemoryStore()
	manager := token.NewManager("test-secret-key-1234567890123456", time.Hour)
	app := newTestApp(store, manager)

	// 1. GET /location-claims/:claim_id with malformed UUID -> 400
	req := httptest.NewRequest(http.MethodGet, "/api/v1/location-claims/not-a-uuid", nil)
	resp, err := app.Test(req)
	if err != nil || resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 Bad Request, got %d (%v)", resp.StatusCode, err)
	}
	body, _ := io.ReadAll(resp.Body)
	var errEnvelope struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &errEnvelope)
	if errEnvelope.Error.Code != "validation_failed" {
		t.Errorf("expected code 'validation_failed', got %s", errEnvelope.Error.Code)
	}
}

func TestClaimValidation_MultipleFieldErrorsAggregated(t *testing.T) {
	store := NewMemoryStore()
	manager := token.NewManager("test-secret-key-1234567890123456", time.Hour)
	app := newTestApp(store, manager)
	tok, _ := manager.Issue("00000000-0000-0000-0000-000000000001")

	// Missing proposed_address, missing kecamatan, invalid proposed_precision
	body, _ := json.Marshal(CreateClaimInput{
		ProposedAddress:   "",
		ProposedPrecision: "invalid_precision",
		Kecamatan:         "",
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/projects/00000000-0000-0000-0000-000000000001/location-claims", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+tok)
	req.Header.Set("Content-Type", "application/json")

	resp, err := app.Test(req)
	if err != nil || resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("expected 422 Unprocessable Entity, got %d", resp.StatusCode)
	}

	resBody, _ := io.ReadAll(resp.Body)
	var errEnvelope struct {
		Error struct {
			Code    string             `json:"code"`
			Details []httpx.FieldError `json:"details"`
		} `json:"error"`
	}
	_ = json.Unmarshal(resBody, &errEnvelope)

	if errEnvelope.Error.Code != "validation_failed" {
		t.Errorf("expected code 'validation_failed', got %s", errEnvelope.Error.Code)
	}
	if len(errEnvelope.Error.Details) < 3 {
		t.Errorf("expected at least 3 aggregated field errors in details[], got %d", len(errEnvelope.Error.Details))
	}
}
