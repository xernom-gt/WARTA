package user

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/claim"
	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/report"
	"warta.com/api/internal/token"
	"warta.com/api/internal/verification"
)

// newTestApp wires the /users endpoints exactly like server.go's wire(): the
// me-family sits behind Bearer; /users/{user_id} is public.
func newTestApp(t *testing.T) (*fiber.App, *MemoryStore, *token.Manager,
	*report.MemoryStore, *claim.MemoryStore, *verification.MemoryStore) {
	t.Helper()

	users := NewMemoryStore()
	manager := token.NewManager("user-test-secret-0123456789", time.Hour)
	reports := report.NewMemoryStore()
	claims := claim.NewMemoryStore()
	votes := verification.NewMemoryStore()

	h := NewHandler(Deps{
		Store:       users,
		ReportStore: reports,
		ClaimStore:  claims,
		VoteStore:   votes,
	})

	app := fiber.New(fiber.Config{ErrorHandler: failFast(t)})
	app.Use(middleware.RequestID())
	app.Get("/users/me/reports", middleware.Bearer(manager, nil), h.ListMyReports)
	app.Get("/users/me/claims", middleware.Bearer(manager, nil), h.ListMyClaims)
	app.Get("/users/me/votes", middleware.Bearer(manager, nil), h.ListMyVotes)
	app.Get("/users/:user_id", h.GetPublicUser)
	return app, users, manager, reports, claims, votes
}

func failFast(t *testing.T) fiber.ErrorHandler {
	return func(c fiber.Ctx, err error) error {
		t.Errorf("unexpected handler error: %v", err)
		return httpx.Error(c, 500, "internal_error", "test")
	}
}

// bearer builds an Authorization header for userID.
func bearer(manager *token.Manager, userID string) string {
	raw, err := manager.Issue(userID)
	if err != nil {
		return ""
	}
	return "Bearer " + raw
}

type rawEnvelope struct {
	Data  json.RawMessage `json:"data"`
	Meta  json.RawMessage `json:"meta"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details []struct {
			Field   string `json:"field"`
			Message string `json:"message"`
		} `json:"details"`
	} `json:"error"`
}

func do(t *testing.T, app *fiber.App, method, path, auth string) (*http.Response, rawEnvelope) {
	t.Helper()
	req := httptest.NewRequest(method, path, nil)
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request %s %s: %v", method, path, err)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("body: %v", err)
	}
	var e rawEnvelope
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatalf("envelope on %s: %v (%s)", path, err, raw)
	}
	return resp, e
}

// --- GET /users/{user_id} -----------------------------------------------------

func TestGetPublicUserReturnsPublicShape(t *testing.T) {
	app, users, _, _, _, _ := newTestApp(t)
	me := users.MustAdd(User{
		Email:        "warga@example.com",
		PasswordHash: "x",
		DisplayName:  "warga_jakarta",
		IsActive:     true,
		CreatedAt:    time.Date(2026, 11, 3, 14, 5, 0, 0, time.UTC),
	})

	resp, e := do(t, app, http.MethodGet, "/users/"+me.ID, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", resp.StatusCode, string(e.Data))
	}

	var data map[string]any
	if err := json.Unmarshal(e.Data, &data); err != nil {
		t.Fatalf("data: %v", err)
	}
	if data["id"] != me.ID || data["display_name"] != "warga_jakarta" || data["is_active"] != true {
		t.Fatalf("unexpected data: %v", data)
	}
	// §6.4: the response must never contain email or password_hash.
	if _, leak := data["email"]; leak {
		t.Fatalf("public profile leaked email: %v", data)
	}
	if _, leak := data["password_hash"]; leak {
		t.Fatalf("public profile leaked password_hash: %v", data)
	}
	// §7.4 examples pin UTC RFC3339: "2026-11-03T14:05:00Z".
	created, ok := data["created_at"].(string)
	if !ok || created != "2026-11-03T14:05:00Z" {
		t.Fatalf("created_at %q is not RFC3339 UTC", created)
	}
}

func TestGetPublicUserMalformedUUIDIs400(t *testing.T) {
	app, _, _, _, _, _ := newTestApp(t)
	resp, e := do(t, app, http.MethodGet, "/users/not-a-uuid", "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", resp.StatusCode)
	}
	if e.Error == nil || e.Error.Code != "validation_failed" {
		t.Fatalf("want validation_failed, got %+v", e.Error)
	}
}

func TestGetPublicUserUnknownIs404(t *testing.T) {
	app, _, _, _, _, _ := newTestApp(t)
	resp, e := do(t, app, http.MethodGet, "/users/00000000-0000-4000-8000-ffffffffffff", "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("want 404, got %d", resp.StatusCode)
	}
	if e.Error == nil || e.Error.Code != "not_found" {
		t.Fatalf("want not_found, got %+v", e.Error)
	}
}

// --- GET /users/me/* ----------------------------------------------------------
//
// The Bearer middleware blocks unauthenticated reads with the catalogue 401.

func TestMyListsRequireAuth(t *testing.T) {
	app, _, _, _, _, _ := newTestApp(t)
	for _, path := range []string{"/users/me/reports", "/users/me/claims", "/users/me/votes"} {
		resp, e := do(t, app, http.MethodGet, path, "")
		if resp.StatusCode != http.StatusUnauthorized {
			t.Fatalf("%s: want 401, got %d", path, resp.StatusCode)
		}
		if e.Error == nil || e.Error.Code != "token_expired" {
			t.Fatalf("%s: want token_expired, got %+v", path, e.Error)
		}
	}
}

func TestMyReportsFilteredAndPrivate(t *testing.T) {
	app, users, manager, reports, _, _ := newTestApp(t)
	me := users.MustAdd(User{Email: "me@example.com", PasswordHash: "x", DisplayName: "warga_me"})

	auth := bearer(manager, me.ID)
	if auth == "" {
		t.Fatal("issue token")
	}

	reports.Seed(&report.Report{ID: "r1", UserID: me.ID, AuthorDisplayName: "warga_me",
		Narrative: "n", Status: report.StatusTerverifikasi, CreatedAt: time.Unix(1_700_000_001, 0)},
		nil, 0)
	reports.Seed(&report.Report{ID: "r2", UserID: me.ID, AuthorDisplayName: "warga_me",
		Narrative: "n", Status: report.StatusMenunggu, CreatedAt: time.Unix(1_700_000_002, 0)},
		nil, 2)

	// Unfiltered: newest first.
	resp, e := do(t, app, http.MethodGet, "/users/me/reports", auth)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", resp.StatusCode)
	}
	var list []map[string]any
	if err := json.Unmarshal(e.Data, &list); err != nil {
		t.Fatalf("data list: %v (%s)", err, string(e.Data))
	}
	if len(list) != 2 || list[0]["id"] != "r2" {
		t.Fatalf("order: %v", list)
	}

	// ?status=menunggu filters.
	req := httptest.NewRequest(http.MethodGet, "/users/me/reports?status=menunggu", nil)
	req.Header.Set("Authorization", auth)
	filtered, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	raw, err := io.ReadAll(filtered.Body)
	if err != nil {
		t.Fatal(err)
	}
	var fe rawEnvelope
	if err := json.Unmarshal(raw, &fe); err != nil {
		t.Fatal(err)
	}
	if err := json.Unmarshal(fe.Data, &list); err != nil {
		t.Fatal(err)
	}
	if filtered.StatusCode != http.StatusOK || len(list) != 1 || list[0]["id"] != "r2" {
		t.Fatalf("filter: %d %v", filtered.StatusCode, list)
	}

	// Other citizens' rows never appear (store filters by user_id).
	other := users.MustAdd(User{Email: "other@example.com", PasswordHash: "x", DisplayName: "warga_other"})
	reports.Seed(&report.Report{ID: "r3", UserID: other.ID, AuthorDisplayName: "warga_other",
		Narrative: "n", Status: report.StatusMenunggu, CreatedAt: time.Unix(1_700_000_003, 0)}, nil, 0)
	resp, e = do(t, app, http.MethodGet, "/users/me/reports", auth)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status %d", resp.StatusCode)
	}
	if err := json.Unmarshal(e.Data, &list); err != nil {
		t.Fatal(err)
	}
	for _, row := range list {
		if row["id"] == "r3" {
			t.Fatalf("foreign report leaked: %v", list)
		}
	}
}

// TestMyReportsUnknownStatusIs422 pins the ?status contract: unknown values
// get 422 validation_failed with a status field detail (§4.3).
func TestMyReportsUnknownStatusIs422(t *testing.T) {
	app, users, manager, _, _, _ := newTestApp(t)
	me := users.MustAdd(User{Email: "me@example.com", PasswordHash: "x", DisplayName: "warga_me"})
	auth := bearer(manager, me.ID)

	req := httptest.NewRequest(http.MethodGet, "/users/me/reports?status=bogus", nil)
	req.Header.Set("Authorization", auth)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(resp.Body)
	var e rawEnvelope
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Fatalf("want 422, got %d", resp.StatusCode)
	}
	if e.Error == nil || e.Error.Code != "validation_failed" || len(e.Error.Details) == 0 {
		t.Fatalf("details: %+v", e.Error)
	}
	if e.Error.Details[0].Field != "status" {
		t.Fatalf("detail field: %+v", e.Error.Details)
	}
}

func TestMyClaimsListShape(t *testing.T) {
	app, users, manager, _, claims, _ := newTestApp(t)
	me := users.MustAdd(User{Email: "me@example.com", PasswordHash: "x", DisplayName: "warga_me"})
	auth := bearer(manager, me.ID)

	claims.Seed(&claim.Claim{ID: "c1", UserID: me.ID, AuthorDisplayName: "warga_me",
		ProposedAddress: "addr", Kecamatan: "Tebet", ProposedPrecision: "titik",
		Status: claim.StatusMenunggu, CreatedAt: time.Unix(1_700_000_000, 0), UpdatedAt: time.Unix(1_700_000_000, 0)})

	resp, e := do(t, app, http.MethodGet, "/users/me/claims", auth)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", resp.StatusCode)
	}
	var list []map[string]any
	if err := json.Unmarshal(e.Data, &list); err != nil {
		t.Fatalf("data: %v (%s)", err, string(e.Data))
	}
	if len(list) != 1 || list[0]["id"] != "c1" || list[0]["status"] != "menunggu" {
		t.Fatalf("rows: %v", list)
	}
	// Meta mirrors openapi Meta: page, limit, total, has_next.
	var meta map[string]any
	if err := json.Unmarshal(e.Meta, &meta); err != nil {
		t.Fatalf("meta: %v (%s)", err, string(e.Meta))
	}
	if meta["page"] != float64(1) || meta["total"] != float64(1) || meta["has_next"] != false {
		t.Fatalf("meta: %v", meta)
	}
}

func TestMyVotesCarryCurrentResolution(t *testing.T) {
	app, users, manager, _, _, votes := newTestApp(t)
	me := users.MustAdd(User{Email: "me@example.com", PasswordHash: "x", DisplayName: "warga_me"})
	auth := bearer(manager, me.ID)

	pending := verification.ResolutionMenunggu
	votes.Seed(&verification.Vote{ID: "v1", VoterID: me.ID, VerificationItemID: "i2",
		ProjectID: "p", ProjectTitle: "T", ItemType: "laporan_kondisi",
		AuthorDisplayName: "warga_lain", Choice: verification.ChoiceTidakSetuju,
		CreatedAt: time.Unix(1_700_000_001, 0), Status: pending,
		VotesAgree: 1, VotesDisagree: 0, TargetVotes: 3})

	resp, e := do(t, app, http.MethodGet, "/users/me/votes", auth)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d", resp.StatusCode)
	}
	var list []map[string]any
	if err := json.Unmarshal(e.Data, &list); err != nil {
		t.Fatalf("data: %v (%s)", err, string(e.Data))
	}
	if len(list) != 1 {
		t.Fatalf("rows: %v", list)
	}
	row := list[0]
	if row["choice"] != "tidak_setuju" || row["author_display_name"] != "warga_lain" {
		t.Fatalf("row: %v", row)
	}
	// §6.22: resolution is always present, even while the item is menunggu.
	res, ok := row["resolution"].(map[string]any)
	if !ok || res["status"] != "menunggu" || res["resolved_at"] != nil {
		t.Fatalf("resolution: %v", res)
	}
	// email must never appear (§7.5).
	if _, leak := row["email"]; leak {
		t.Fatalf("row leaked email: %v", row)
	}
}

// TestMyVotesPaginationClamped pins §10.4: limit above 100 clamps instead of
// rejecting; unparsable values fall back to defaults.
func TestMyVotesPaginationClamped(t *testing.T) {
	app, users, manager, _, _, votes := newTestApp(t)
	me := users.MustAdd(User{Email: "me@example.com", PasswordHash: "x", DisplayName: "warga_me"})
	auth := bearer(manager, me.ID)
	votes.Seed(&verification.Vote{ID: "v1", VoterID: me.ID, VerificationItemID: "i",
		ProjectID: "p", ProjectTitle: "T", ItemType: "laporan_kondisi",
		AuthorDisplayName: "a", Choice: verification.ChoiceSetuju,
		CreatedAt: time.Unix(1_700_000_000, 0), Status: verification.ResolutionMenunggu,
		TargetVotes: 3})

	req := httptest.NewRequest(http.MethodGet, "/users/me/votes?limit=500&page=abc", nil)
	req.Header.Set("Authorization", auth)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := io.ReadAll(resp.Body)
	var e rawEnvelope
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatal(err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", resp.StatusCode, string(e.Data))
	}
	var meta map[string]any
	if err := json.Unmarshal(e.Meta, &meta); err != nil {
		t.Fatal(err)
	}
	if meta["limit"] != float64(100) || meta["page"] != float64(1) {
		t.Fatalf("clamped meta: %v", meta)
	}
}
