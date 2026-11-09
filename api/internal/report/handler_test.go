package report

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/token"
)

type testEnv struct {
	app     *fiber.App
	store   *MemoryStore
	manager *token.Manager
	callers map[string]*Caller
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()

	store := NewMemoryStore()
	manager := token.NewManager("report-test-secret-0123456789", time.Hour)
	callers := map[string]*Caller{}

	h := NewHandler(Deps{
		Store: store,
		CallerLookup: func(ctx context.Context, userID string) (*Caller, error) {
			c, ok := callers[userID]
			if !ok {
				return nil, ErrCallerNotFound
			}
			return c, nil
		},
	})

	app := fiber.New(fiber.Config{
		ErrorHandler: func(c fiber.Ctx, err error) error {
			t.Errorf("unexpected handler error: %v", err)
			return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "test")
		},
	})
	app.Use(middleware.RequestID())
	app.Post("/api/v1/projects/:project_id/reports", middleware.Bearer(manager, nil), h.Create)
	app.Post("/api/v1/reports/:report_id/submit", middleware.Bearer(manager, nil), h.Submit)

	return &testEnv{
		app:     app,
		store:   store,
		manager: manager,
		callers: callers,
	}
}

func (e *testEnv) seedCaller(displayName string, active, verified bool) (*Caller, string) {
	id := uuid.NewString()
	c := &Caller{
		ID:            id,
		DisplayName:   displayName,
		IsActive:      active,
		EmailVerified: verified,
	}
	e.callers[id] = c
	raw, _ := e.manager.Issue(id)
	return c, "Bearer " + raw
}

type rawEnvelope struct {
	Data  ReportView `json:"data"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details []struct {
			Field   string `json:"field"`
			Message string `json:"message"`
		} `json:"details"`
	} `json:"error"`
}

func doJSON(t *testing.T, app *fiber.App, method, path, auth string, body any) (*http.Response, rawEnvelope) {
	t.Helper()

	var reader io.Reader
	if body != nil {
		switch v := body.(type) {
		case string:
			reader = strings.NewReader(v)
		default:
			buf, err := json.Marshal(v)
			if err != nil {
				t.Fatalf("marshal body: %v", err)
			}
			reader = bytes.NewReader(buf)
		}
	}

	req := httptest.NewRequest(method, path, reader)
	req.Header.Set("Content-Type", "application/json")
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request %s %s: %v", method, path, err)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	var env rawEnvelope
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &env); err != nil {
			t.Fatalf("decode envelope (%q): %v", string(raw), err)
		}
	}
	return resp, env
}

func floatPtr(v float64) *float64 { return &v }
func strPtr(v string) *string     { return &v }

func TestCreateReport_DraftAndDistance(t *testing.T) {
	env := newTestEnv(t)
	author, auth := env.seedCaller("warga_jakarta", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, floatPtr(-6.2000000), floatPtr(106.8166667))

	resp, body := doJSON(t, env.app, http.MethodPost,
		"/api/v1/projects/"+projectID+"/reports", auth, map[string]any{
			"narrative": "Lokasi proyek belum ada aktivitas alat berat.",
			"latitude":  -6.2010000,
			"longitude": 106.8166667,
			"submit":    false,
		})

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d (%+v)", resp.StatusCode, body.Error)
	}
	if loc := resp.Header.Get("Location"); loc != "/api/v1/reports/"+body.Data.ID {
		t.Errorf("expected Location header /api/v1/reports/%s, got %q", body.Data.ID, loc)
	}
	if body.Data.Status != StatusDraft {
		t.Errorf("expected status draft, got %q", body.Data.Status)
	}
	if body.Data.SubmittedAt != nil {
		t.Errorf("expected submitted_at nil for draft, got %v", *body.Data.SubmittedAt)
	}
	if body.Data.UserID != author.ID || body.Data.AuthorDisplayName != author.DisplayName {
		t.Errorf("unexpected author fields: user_id=%q display_name=%q",
			body.Data.UserID, body.Data.AuthorDisplayName)
	}
	if body.Data.DistanceFromProjectM == nil || *body.Data.DistanceFromProjectM <= 100 || *body.Data.DistanceFromProjectM >= 120 {
		t.Errorf("expected distance ~111.19m, got %v", body.Data.DistanceFromProjectM)
	}
	if len(env.store.VerificationItems()) != 0 {
		t.Errorf("expected 0 verification items for draft, got %d", len(env.store.VerificationItems()))
	}
}

func TestCreateReport_SubmitImmediateEnqueuesVerification(t *testing.T) {
	env := newTestEnv(t)
	author, auth := env.seedCaller("warga_barat", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, floatPtr(-6.1753924), floatPtr(106.8271528))

	resp, body := doJSON(t, env.app, http.MethodPost,
		"/api/v1/projects/"+projectID+"/reports", auth, map[string]any{
			"category":         CategoryLambatMangkrak,
			"narrative":        "Sudah tiga minggu tidak terlihat pekerja maupun material di lokasi proyek ini.",
			"proposed_address": "Jl. Medan Merdeka Utara No. 1, Gambir, Jakarta Pusat",
			"latitude":         -6.1760000,
			"longitude":        106.8271528,
			"exif_status":      ExifValid,
			"submit":           true,
		})

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d (%+v)", resp.StatusCode, body.Error)
	}
	if body.Data.Status != StatusMenunggu {
		t.Errorf("expected status menunggu, got %q", body.Data.Status)
	}
	if body.Data.SubmittedAt == nil {
		t.Errorf("expected submitted_at to be populated on submit")
	}
	if body.Data.UserID != author.ID {
		t.Errorf("expected user_id %q, got %q", author.ID, body.Data.UserID)
	}
	if body.Data.DistanceFromProjectM == nil || *body.Data.DistanceFromProjectM <= 0 {
		t.Errorf("expected positive distance_from_project_m, got %v", body.Data.DistanceFromProjectM)
	}

	items := env.store.VerificationItems()
	if len(items) != 1 {
		t.Fatalf("expected 1 verification item, got %d", len(items))
	}
	if items[0].ItemType != "laporan_kondisi" || items[0].ReportID != body.Data.ID || items[0].TargetVotes != 3 {
		t.Errorf("unexpected verification item: %+v", items[0])
	}
}

func TestCreateReport_ValidationAndAuth(t *testing.T) {
	env := newTestEnv(t)
	_, validAuth := env.seedCaller("warga_valid", true, true)
	_, unverifiedAuth := env.seedCaller("warga_unverified", true, false)
	_, inactiveAuth := env.seedCaller("warga_inactive", false, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, nil, nil)

	t.Run("malformed project_id returns 400", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/projects/not-a-uuid/reports", validAuth, map[string]any{"narrative": "halo"})
		if resp.StatusCode != http.StatusBadRequest || body.Error == nil || body.Error.Code != "validation_failed" {
			t.Fatalf("expected 400 validation_failed, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("unknown project_id returns 404", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/projects/"+uuid.NewString()+"/reports", validAuth, map[string]any{"narrative": "halo"})
		if resp.StatusCode != http.StatusNotFound || body.Error == nil || body.Error.Code != "not_found" {
			t.Fatalf("expected 404 not_found, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("malformed JSON returns 400", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/projects/"+projectID+"/reports", validAuth, "{broken")
		if resp.StatusCode != http.StatusBadRequest || body.Error == nil || body.Error.Code != "bad_request" {
			t.Fatalf("expected 400 bad_request, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("unauthenticated returns 401", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/projects/"+projectID+"/reports", "", map[string]any{"narrative": "halo"})
		if resp.StatusCode != http.StatusUnauthorized || body.Error == nil || body.Error.Code != "token_expired" {
			t.Fatalf("expected 401 token_expired, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("unverified email returns 403 email_not_verified", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/projects/"+projectID+"/reports", unverifiedAuth, map[string]any{"narrative": "halo"})
		if resp.StatusCode != http.StatusForbidden || body.Error == nil || body.Error.Code != "email_not_verified" {
			t.Fatalf("expected 403 email_not_verified, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("inactive account returns 403 account_inactive", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/projects/"+projectID+"/reports", inactiveAuth, map[string]any{"narrative": "halo"})
		if resp.StatusCode != http.StatusForbidden || body.Error == nil || body.Error.Code != "account_inactive" {
			t.Fatalf("expected 403 account_inactive, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("submit=true validates required fields", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/projects/"+projectID+"/reports", validAuth, map[string]any{
				"narrative": "Pendek",
				"latitude":  -6.2,
				"submit":    true,
			})
		if resp.StatusCode != http.StatusUnprocessableEntity || body.Error == nil {
			t.Fatalf("expected 422, got %d (%+v)", resp.StatusCode, body.Error)
		}
		fields := map[string]bool{}
		for _, d := range body.Error.Details {
			fields[d.Field] = true
		}
		for _, want := range []string{"category", "narrative", "proposed_address", "latitude"} {
			if !fields[want] {
				t.Errorf("expected field error on %q, got %+v", want, body.Error.Details)
			}
		}
	})
}

func TestSubmitReport_LifecycleAndErrors(t *testing.T) {
	env := newTestEnv(t)
	author, authorAuth := env.seedCaller("warga_utara", true, true)
	_, otherAuth := env.seedCaller("warga_lain", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, floatPtr(-6.1200000), floatPtr(106.8500000))

	// 1. Draft missing required submit fields & media -> 422 with field errors.
	incompleteID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                incompleteID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Narrative:         "Terlalu pendek",
		ExifStatus:        ExifMissing,
		Status:            StatusDraft,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, nil, 0)

	resp, body := doJSON(t, env.app, http.MethodPost,
		"/api/v1/reports/"+incompleteID+"/submit", authorAuth, nil)
	if resp.StatusCode != http.StatusUnprocessableEntity || body.Error == nil {
		t.Fatalf("expected 422 for incomplete draft, got %d (%+v)", resp.StatusCode, body.Error)
	}
	fields := map[string]bool{}
	for _, d := range body.Error.Details {
		fields[d.Field] = true
	}
	for _, want := range []string{"category", "narrative", "proposed_address", "media"} {
		if !fields[want] {
			t.Errorf("expected field error on %q, got %+v", want, body.Error.Details)
		}
	}

	// 2. Complete draft with 1 photo -> 200 OK by author, 403 by non-author, 409 on re-submit.
	readyID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                readyID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Category:          strPtr(CategoryPapanTidakAda),
		Narrative:         "Di sekitar lokasi proyek sama sekali tidak ditemukan papan informasi kegiatan.",
		ProposedAddress:   strPtr("Jl. Yos Sudarso Kav. 85, Tanjung Priok, Jakarta Utara"),
		Latitude:          floatPtr(-6.1210000),
		Longitude:         floatPtr(106.8500000),
		ExifStatus:        ExifValid,
		Status:            StatusDraft,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, []*Media{{
		ID:        uuid.NewString(),
		ReportID:  readyID,
		FileURL:   "https://storage.warta.id/reports/" + readyID + "/photo-1.jpg",
		MediaType: "image/jpeg",
		SortOrder: 0,
		CreatedAt: time.Now().UTC(),
	}}, 0)

	// Non-author gets 403 forbidden.
	resp, body = doJSON(t, env.app, http.MethodPost,
		"/api/v1/reports/"+readyID+"/submit", otherAuth, nil)
	if resp.StatusCode != http.StatusForbidden || body.Error == nil || body.Error.Code != "forbidden" {
		t.Fatalf("expected 403 forbidden for non-author, got %d (%+v)", resp.StatusCode, body.Error)
	}

	// Author submits successfully -> 200 OK, status menunggu, submitted_at set, verification item created.
	resp, body = doJSON(t, env.app, http.MethodPost,
		"/api/v1/reports/"+readyID+"/submit", authorAuth, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 OK, got %d (%+v)", resp.StatusCode, body.Error)
	}
	if body.Data.Status != StatusMenunggu {
		t.Errorf("expected status menunggu, got %q", body.Data.Status)
	}
	if body.Data.SubmittedAt == nil {
		t.Errorf("expected submitted_at to be set")
	}
	if body.Data.DistanceFromProjectM == nil || *body.Data.DistanceFromProjectM <= 0 {
		t.Errorf("expected distance_from_project_m to be computed, got %v", body.Data.DistanceFromProjectM)
	}
	if len(body.Data.Media) != 1 {
		t.Errorf("expected 1 media item in response, got %d", len(body.Data.Media))
	}
	if len(env.store.VerificationItems()) != 1 {
		t.Fatalf("expected 1 verification item after submit, got %d", len(env.store.VerificationItems()))
	}

	// Submitting again returns 409 conflict.
	resp, body = doJSON(t, env.app, http.MethodPost,
		"/api/v1/reports/"+readyID+"/submit", authorAuth, nil)
	if resp.StatusCode != http.StatusConflict || body.Error == nil || body.Error.Code != "conflict" {
		t.Fatalf("expected 409 conflict on re-submit, got %d (%+v)", resp.StatusCode, body.Error)
	}
}
