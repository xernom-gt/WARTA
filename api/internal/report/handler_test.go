package report

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"mime/multipart"
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
	storage *MemoryMediaStorage
	manager *token.Manager
	callers map[string]*Caller
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()

	store := NewMemoryStore()
	storage := NewMemoryMediaStorage("https://storage.warta.id")
	manager := token.NewManager("report-test-secret-0123456789", time.Hour)
	callers := map[string]*Caller{}

	h := NewHandler(Deps{
		Store:   store,
		Storage: storage,
		CallerLookup: func(ctx context.Context, userID string) (*Caller, error) {
			c, ok := callers[userID]
			if !ok {
				return nil, ErrCallerNotFound
			}
			return c, nil
		},
	})

	app := fiber.New(fiber.Config{
		BodyLimit: 10 * 1024 * 1024,
		ErrorHandler: func(c fiber.Ctx, err error) error {
			t.Errorf("unexpected handler error: %v", err)
			return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "test")
		},
	})
	app.Use(middleware.RequestID())
	app.Post("/api/v1/projects/:project_id/reports", middleware.Bearer(manager, nil), h.Create)
	app.Get("/api/v1/reports/:report_id", middleware.OptionalBearer(manager, nil), h.Get)
	app.Patch("/api/v1/reports/:report_id", middleware.Bearer(manager, nil), h.Update)
	app.Delete("/api/v1/reports/:report_id", middleware.Bearer(manager, nil), h.Delete)
	app.Post("/api/v1/reports/:report_id/submit", middleware.Bearer(manager, nil), h.Submit)
	app.Get("/api/v1/reports/:report_id/media", middleware.OptionalBearer(manager, nil), h.ListMedia)
	app.Post("/api/v1/reports/:report_id/media", middleware.Bearer(manager, nil), h.UploadMedia)
	app.Delete("/api/v1/reports/:report_id/media/:media_id", middleware.Bearer(manager, nil), h.DeleteMedia)

	return &testEnv{
		app:     app,
		store:   store,
		storage: storage,
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

	resp, body = doJSON(t, env.app, http.MethodPost,
		"/api/v1/reports/"+readyID+"/submit", otherAuth, nil)
	if resp.StatusCode != http.StatusForbidden || body.Error == nil || body.Error.Code != "forbidden" {
		t.Fatalf("expected 403 forbidden for non-author, got %d (%+v)", resp.StatusCode, body.Error)
	}

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

	resp, body = doJSON(t, env.app, http.MethodPost,
		"/api/v1/reports/"+readyID+"/submit", authorAuth, nil)
	if resp.StatusCode != http.StatusConflict || body.Error == nil || body.Error.Code != "conflict" {
		t.Fatalf("expected 409 conflict on re-submit, got %d (%+v)", resp.StatusCode, body.Error)
	}
}

func TestGetReport_Visibility(t *testing.T) {
	env := newTestEnv(t)
	author, authorAuth := env.seedCaller("warga_timur", true, true)
	_, otherAuth := env.seedCaller("warga_selatan", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, floatPtr(-6.2000000), floatPtr(106.8166667))

	draftID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                draftID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Narrative:         "Draft laporan kondisi lapangan.",
		ExifStatus:        ExifMissing,
		Status:            StatusDraft,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, nil, 0)

	submittedID := uuid.NewString()
	now := time.Now().UTC()
	dist := 42.5
	notice := "Geotag cocok"
	env.store.Seed(&Report{
		ID:                   submittedID,
		ProjectID:            projectID,
		UserID:               author.ID,
		AuthorDisplayName:    author.DisplayName,
		Category:             strPtr(CategoryFisikRusak),
		Narrative:            "Beton pembatas jalan sudah retak memanjang lebih dari dua meter.",
		ProposedAddress:      strPtr("Jl. Pramuka No. 12, Jakarta Timur"),
		Latitude:             floatPtr(-6.2003000),
		Longitude:            floatPtr(106.8166667),
		DistanceFromProjectM: &dist,
		ExifStatus:           ExifValid,
		ExifNotice:           &notice,
		Status:               StatusMenunggu,
		CreatedAt:            now,
		UpdatedAt:            now,
		SubmittedAt:          &now,
	}, []*Media{{
		ID:        uuid.NewString(),
		ReportID:  submittedID,
		FileURL:   "https://storage.warta.id/reports/" + submittedID + "/1.jpg",
		MediaType: "image/jpeg",
		SortOrder: 0,
		CreatedAt: now,
	}}, 3)

	resp, body := doJSON(t, env.app, http.MethodGet, "/api/v1/reports/"+submittedID, "", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for public submitted report, got %d", resp.StatusCode)
	}
	if body.Data.EvidencesCount != 3 || len(body.Data.Media) != 1 || body.Data.ExifStatus != ExifValid {
		t.Errorf("unexpected submitted report detail: %+v", body.Data)
	}

	resp, _ = doJSON(t, env.app, http.MethodGet, "/api/v1/reports/"+draftID, authorAuth, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for author reading own draft, got %d", resp.StatusCode)
	}
	resp, _ = doJSON(t, env.app, http.MethodGet, "/api/v1/reports/"+draftID, "", nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for guest reading draft, got %d", resp.StatusCode)
	}
	resp, _ = doJSON(t, env.app, http.MethodGet, "/api/v1/reports/"+draftID, otherAuth, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for non-author reading draft, got %d", resp.StatusCode)
	}
}

func TestUpdateReport_DraftOnlyAndPartialPatch(t *testing.T) {
	env := newTestEnv(t)
	author, authorAuth := env.seedCaller("warga_pusat", true, true)
	_, otherAuth := env.seedCaller("warga_tamu", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, floatPtr(-6.2000000), floatPtr(106.8166667))

	draftID := uuid.NewString()
	initialDist := 111.19
	env.store.Seed(&Report{
		ID:                   draftID,
		ProjectID:            projectID,
		UserID:               author.ID,
		AuthorDisplayName:    author.DisplayName,
		Category:             strPtr(CategoryBelumMulai),
		Narrative:            "Catatan awal kondisi proyek.",
		ProposedAddress:      strPtr("Jl. MH Thamrin No. 5"),
		Latitude:             floatPtr(-6.2010000),
		Longitude:            floatPtr(106.8166667),
		DistanceFromProjectM: &initialDist,
		ExifStatus:           ExifMissing,
		Status:               StatusDraft,
		CreatedAt:            time.Now().UTC(),
		UpdatedAt:            time.Now().UTC(),
	}, nil, 0)

	resp, body := doJSON(t, env.app, http.MethodPatch, "/api/v1/reports/"+draftID, authorAuth, map[string]any{
		"narrative": "Catatan diperbarui: belum ada pengerjaan fisik di lapangan.",
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on partial patch, got %d (%+v)", resp.StatusCode, body.Error)
	}
	if body.Data.Category == nil || *body.Data.Category != CategoryBelumMulai {
		t.Errorf("expected category preserved, got %v", body.Data.Category)
	}
	if body.Data.DistanceFromProjectM == nil || *body.Data.DistanceFromProjectM != initialDist {
		t.Errorf("expected distance preserved (%v), got %v", initialDist, body.Data.DistanceFromProjectM)
	}

	resp, body = doJSON(t, env.app, http.MethodPatch, "/api/v1/reports/"+draftID, authorAuth, map[string]any{
		"latitude":  -6.2050000,
		"longitude": 106.8166667,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on coord update, got %d (%+v)", resp.StatusCode, body.Error)
	}
	if body.Data.DistanceFromProjectM == nil || *body.Data.DistanceFromProjectM <= 500 {
		t.Errorf("expected recomputed distance > 500m, got %v", body.Data.DistanceFromProjectM)
	}

	resp, body = doJSON(t, env.app, http.MethodPatch, "/api/v1/reports/"+draftID, authorAuth, map[string]any{
		"latitude":  nil,
		"longitude": nil,
	})
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on coord clear, got %d (%+v)", resp.StatusCode, body.Error)
	}
	if body.Data.DistanceFromProjectM != nil {
		t.Errorf("expected nil distance when coordinates cleared, got %v", body.Data.DistanceFromProjectM)
	}

	resp, _ = doJSON(t, env.app, http.MethodPatch, "/api/v1/reports/"+draftID, otherAuth, map[string]any{
		"narrative": "Coba bajak laporan orang lain.",
	})
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for non-author patch, got %d", resp.StatusCode)
	}

	submittedID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                submittedID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Narrative:         "Sudah dikirim ke antrean verifikasi.",
		ExifStatus:        ExifMissing,
		Status:            StatusMenunggu,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, nil, 0)

	resp, _ = doJSON(t, env.app, http.MethodPatch, "/api/v1/reports/"+submittedID, authorAuth, map[string]any{
		"narrative": "Coba ubah setelah submit.",
	})
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 for patching non-draft report, got %d", resp.StatusCode)
	}
}

func TestDeleteReport_HardAndSoftDelete(t *testing.T) {
	env := newTestEnv(t)
	author, authorAuth := env.seedCaller("warga_penulis", true, true)
	_, otherAuth := env.seedCaller("warga_bukan_penulis", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, nil, nil)

	draftID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                draftID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Narrative:         "Draft yang akan dihapus permanen.",
		ExifStatus:        ExifMissing,
		Status:            StatusDraft,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, []*Media{{
		ID:        uuid.NewString(),
		ReportID:  draftID,
		FileURL:   "https://storage.warta.id/reports/" + draftID + "/draft.jpg",
		MediaType: "image/jpeg",
		SortOrder: 0,
		CreatedAt: time.Now().UTC(),
	}}, 0)

	resp, _ := doJSON(t, env.app, http.MethodDelete, "/api/v1/reports/"+draftID, otherAuth, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for non-author delete, got %d", resp.StatusCode)
	}

	resp, _ = doJSON(t, env.app, http.MethodDelete, "/api/v1/reports/"+draftID, authorAuth, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 for draft delete, got %d", resp.StatusCode)
	}
	if env.store.MediaCount(draftID) != 0 {
		t.Errorf("expected draft media to be hard-deleted, got %d rows", env.store.MediaCount(draftID))
	}
	resp, _ = doJSON(t, env.app, http.MethodGet, "/api/v1/reports/"+draftID, authorAuth, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 after draft deletion, got %d", resp.StatusCode)
	}

	pendingID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                pendingID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Category:          strPtr(CategoryFisikRusak),
		Narrative:         "Laporan menunggu yang ditarik kembali oleh penulis.",
		ProposedAddress:   strPtr("Jl. Sudirman No. 1"),
		ExifStatus:        ExifValid,
		Status:            StatusMenunggu,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, []*Media{{
		ID:        uuid.NewString(),
		ReportID:  pendingID,
		FileURL:   "https://storage.warta.id/reports/" + pendingID + "/pending.jpg",
		MediaType: "image/jpeg",
		SortOrder: 0,
		CreatedAt: time.Now().UTC(),
	}}, 0)

	resp, _ = doJSON(t, env.app, http.MethodDelete, "/api/v1/reports/"+pendingID, authorAuth, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 for pending report soft-delete, got %d", resp.StatusCode)
	}
	if env.store.MediaCount(pendingID) != 1 {
		t.Errorf("expected pending report media to be retained on soft-delete, got %d", env.store.MediaCount(pendingID))
	}
	items := env.store.VerificationItems()
	if len(items) != 1 || items[0].ResolvedAt == nil {
		t.Errorf("expected verification item to be closed (ResolvedAt set), got %+v", items)
	}
	resp, _ = doJSON(t, env.app, http.MethodGet, "/api/v1/reports/"+pendingID, authorAuth, nil)
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 on GET for soft-deleted report, got %d", resp.StatusCode)
	}

	for _, lockedStatus := range []ReportStatus{StatusTerverifikasi, StatusDitolak, StatusSelesai} {
		lockedID := uuid.NewString()
		env.store.Seed(&Report{
			ID:                lockedID,
			ProjectID:         projectID,
			UserID:            author.ID,
			AuthorDisplayName: author.DisplayName,
			Narrative:         "Laporan yang sudah memiliki putusan konsensus.",
			ExifStatus:        ExifValid,
			Status:            lockedStatus,
			CreatedAt:         time.Now().UTC(),
			UpdatedAt:         time.Now().UTC(),
		}, nil, 0)

		resp, _ = doJSON(t, env.app, http.MethodDelete, "/api/v1/reports/"+lockedID, authorAuth, nil)
		if resp.StatusCode != http.StatusConflict {
			t.Errorf("expected 409 conflict when deleting %q report, got %d", lockedStatus, resp.StatusCode)
		}
	}
}

type mediaEnvelope struct {
	Data  MediaView `json:"data"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

type mediaListEnvelope struct {
	Data []MediaView `json:"data"`
}

func doUpload(t *testing.T, app *fiber.App, path, auth, sortOrder string, fileBytes []byte) (*http.Response, mediaEnvelope) {
	t.Helper()

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	if sortOrder != "" {
		if err := w.WriteField("sort_order", sortOrder); err != nil {
			t.Fatalf("write sort_order: %v", err)
		}
	}
	if fileBytes != nil {
		part, err := w.CreateFormFile("file", "photo.jpg")
		if err != nil {
			t.Fatalf("create form file: %v", err)
		}
		if _, err := part.Write(fileBytes); err != nil {
			t.Fatalf("write file bytes: %v", err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close multipart: %v", err)
	}

	req := httptest.NewRequest(http.MethodPost, path, &body)
	req.Header.Set("Content-Type", w.FormDataContentType())
	if auth != "" {
		req.Header.Set("Authorization", auth)
	}

	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("upload request: %v", err)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("read body: %v", err)
	}
	var env mediaEnvelope
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &env); err != nil {
			t.Fatalf("decode media envelope (%q): %v", string(raw), err)
		}
	}
	return resp, env
}

// buildJPEGWithEXIF builds a minimal valid JPEG containing an APP1 EXIF segment
// with DateTime ("2026:11:09 10:30:00") and GPS coordinates (-6.2, 106.816667).
func buildJPEGWithEXIF() []byte {
	var tiff bytes.Buffer
	tiff.WriteString("MM")
	_ = binary.Write(&tiff, binary.BigEndian, uint16(0x002A))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(8)) // IFD0 at offset 8

	// IFD0: 2 entries (DateTime 0x0132, GPSInfoIFDPointer 0x8825)
	// Offset 8..10 (2) + 2*12 (24) + nextIFD (4) = 30 -> data starts at offset 38.
	_ = binary.Write(&tiff, binary.BigEndian, uint16(2))

	// Entry 1: DateTime (0x0132), ASCII (2), count 20, offset 38
	_ = binary.Write(&tiff, binary.BigEndian, uint16(0x0132))
	_ = binary.Write(&tiff, binary.BigEndian, uint16(2))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(20))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(38))

	// Entry 2: GPSInfoIFDPointer (0x8825), LONG (4), count 1, value = offset 58
	_ = binary.Write(&tiff, binary.BigEndian, uint16(0x8825))
	_ = binary.Write(&tiff, binary.BigEndian, uint16(4))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(1))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(58))

	_ = binary.Write(&tiff, binary.BigEndian, uint32(0)) // next IFD = 0

	// Offset 38..58: DateTime string (20 bytes)
	tiff.WriteString("2026:11:09 10:30:00\x00")

	// Offset 58: GPS IFD with 4 entries -> 2 + 4*12 + 4 = 54 bytes (ends at 112).
	_ = binary.Write(&tiff, binary.BigEndian, uint16(4))

	// GPS Tag 1: GPSLatitudeRef (0x0001), ASCII (2), count 2, inline "S\x00\x00\x00"
	_ = binary.Write(&tiff, binary.BigEndian, uint16(0x0001))
	_ = binary.Write(&tiff, binary.BigEndian, uint16(2))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(2))
	tiff.Write([]byte{'S', 0, 0, 0})

	// GPS Tag 2: GPSLatitude (0x0002), RATIONAL (5), count 3, offset 112
	_ = binary.Write(&tiff, binary.BigEndian, uint16(0x0002))
	_ = binary.Write(&tiff, binary.BigEndian, uint16(5))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(3))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(112))

	// GPS Tag 3: GPSLongitudeRef (0x0003), ASCII (2), count 2, inline "E\x00\x00\x00"
	_ = binary.Write(&tiff, binary.BigEndian, uint16(0x0003))
	_ = binary.Write(&tiff, binary.BigEndian, uint16(2))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(2))
	tiff.Write([]byte{'E', 0, 0, 0})

	// GPS Tag 4: GPSLongitude (0x0004), RATIONAL (5), count 3, offset 136
	_ = binary.Write(&tiff, binary.BigEndian, uint16(0x0004))
	_ = binary.Write(&tiff, binary.BigEndian, uint16(5))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(3))
	_ = binary.Write(&tiff, binary.BigEndian, uint32(136))

	_ = binary.Write(&tiff, binary.BigEndian, uint32(0)) // next IFD = 0

	// Offset 112..136: Latitude 6 deg, 12 min, 0 sec -> 6.2 S (-6.2)
	for _, pair := range [][2]uint32{{6, 1}, {12, 1}, {0, 1}} {
		_ = binary.Write(&tiff, binary.BigEndian, pair[0])
		_ = binary.Write(&tiff, binary.BigEndian, pair[1])
	}
	// Offset 136..160: Longitude 106 deg, 49 min, 0 sec -> 106.816667 E
	for _, pair := range [][2]uint32{{106, 1}, {49, 1}, {0, 1}} {
		_ = binary.Write(&tiff, binary.BigEndian, pair[0])
		_ = binary.Write(&tiff, binary.BigEndian, pair[1])
	}

	app1Payload := append([]byte("Exif\x00\x00"), tiff.Bytes()...)
	segLen := uint16(len(app1Payload) + 2)

	var jpg bytes.Buffer
	jpg.Write([]byte{0xFF, 0xD8, 0xFF, 0xE1})
	_ = binary.Write(&jpg, binary.BigEndian, segLen)
	jpg.Write(app1Payload)
	jpg.Write([]byte{0xFF, 0xD9})
	return jpg.Bytes()
}

func buildPNGWithoutEXIF() []byte {
	return []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0x00, 0x00, 0x00, 0x0D, 'I', 'H', 'D', 'R'}
}

func buildWebPWithoutEXIF() []byte {
	return []byte{'R', 'I', 'F', 'F', 0x10, 0x00, 0x00, 0x00, 'W', 'E', 'B', 'P', 'V', 'P', '8', ' '}
}

func TestReportMedia_UploadListAndDeleteLifecycle(t *testing.T) {
	env := newTestEnv(t)
	author, authorAuth := env.seedCaller("warga_foto", true, true)
	_, otherAuth := env.seedCaller("warga_penonton", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, floatPtr(-6.2000000), floatPtr(106.8166667))

	reportID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                reportID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Category:          strPtr(CategoryFisikRusak),
		Narrative:         "Permukaan aspal baru sudah mengelupas sepanjang sepuluh meter.",
		ProposedAddress:   strPtr("Jl. Jenderal Sudirman Kav. 21"),
		Latitude:          floatPtr(-6.2000000),
		Longitude:         floatPtr(106.8166667),
		ExifStatus:        ExifValid,
		Status:            StatusDraft,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, nil, 0)

	mediaPath := "/api/v1/reports/" + reportID + "/media"

	// 1. Upload JPEG with EXIF GPS (no sort_order -> defaults to slot 0).
	resp, m0 := doUpload(t, env.app, mediaPath, authorAuth, "", buildJPEGWithEXIF())
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on JPEG upload, got %d (%+v)", resp.StatusCode, m0.Error)
	}
	if m0.Data.SortOrder != 0 || m0.Data.MediaType != "image/jpeg" {
		t.Errorf("expected sort_order=0 image/jpeg, got %+v", m0.Data)
	}
	if m0.Data.ExifLatitude == nil || *m0.Data.ExifLatitude != -6.2 {
		t.Errorf("expected exif_latitude -6.2, got %v", m0.Data.ExifLatitude)
	}
	if m0.Data.ExifTakenAt == nil || *m0.Data.ExifTakenAt != "2026-11-09T10:30:00Z" {
		t.Errorf("expected exif_taken_at 2026-11-09T10:30:00Z, got %v", m0.Data.ExifTakenAt)
	}
	if m0.Data.IsGeotagValid == nil || !*m0.Data.IsGeotagValid {
		t.Errorf("expected is_geotag_valid=true, got %v", m0.Data.IsGeotagValid)
	}
	if !env.storage.Has(m0.Data.FileURL) {
		t.Errorf("expected uploaded file to exist in storage at %q", m0.Data.FileURL)
	}

	// 2. Upload PNG without EXIF at explicit sort_order=2 (still succeeds with nil EXIF fields!).
	resp, m2 := doUpload(t, env.app, mediaPath, authorAuth, "2", buildPNGWithoutEXIF())
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201 on PNG without EXIF, got %d (%+v)", resp.StatusCode, m2.Error)
	}
	if m2.Data.SortOrder != 2 || m2.Data.MediaType != "image/png" {
		t.Errorf("expected sort_order=2 image/png, got %+v", m2.Data)
	}
	if m2.Data.ExifLatitude != nil || m2.Data.IsGeotagValid != nil {
		t.Errorf("expected nil EXIF fields for PNG without EXIF, got %+v", m2.Data)
	}

	// 3. Upload WebP without sort_order -> automatically picks lowest free slot (1).
	resp, m1 := doUpload(t, env.app, mediaPath, authorAuth, "", buildWebPWithoutEXIF())
	if resp.StatusCode != http.StatusCreated || m1.Data.SortOrder != 1 {
		t.Fatalf("expected 201 at slot 1, got %d (slot %d)", resp.StatusCode, m1.Data.SortOrder)
	}

	// 4. Upload 4th photo -> fills slot 3.
	resp, m3 := doUpload(t, env.app, mediaPath, authorAuth, "", buildPNGWithoutEXIF())
	if resp.StatusCode != http.StatusCreated || m3.Data.SortOrder != 3 {
		t.Fatalf("expected 201 at slot 3, got %d (slot %d)", resp.StatusCode, m3.Data.SortOrder)
	}

	// 5. Upload 5th photo -> rejected with 409 photo_limit_reached.
	resp, mExtra := doUpload(t, env.app, mediaPath, authorAuth, "", buildPNGWithoutEXIF())
	if resp.StatusCode != http.StatusConflict || mExtra.Error == nil || mExtra.Error.Code != "photo_limit_reached" {
		t.Fatalf("expected 409 photo_limit_reached on 5th photo, got %d (%+v)", resp.StatusCode, mExtra.Error)
	}

	// 6. GET /reports/{report_id}/media returns all 4 ordered by sort_order (0, 1, 2, 3).
	listReq := httptest.NewRequest(http.MethodGet, mediaPath, nil)
	listReq.Header.Set("Authorization", authorAuth)
	listResp, err := env.app.Test(listReq)
	if err != nil || listResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on GET media, got %v", listResp)
	}
	rawList, _ := io.ReadAll(listResp.Body)
	var listed mediaListEnvelope
	_ = json.Unmarshal(rawList, &listed)
	if len(listed.Data) != 4 {
		t.Fatalf("expected 4 media items, got %d", len(listed.Data))
	}
	for i, item := range listed.Data {
		if item.SortOrder != i {
			t.Errorf("expected item %d to have sort_order=%d, got %d", i, i, item.SortOrder)
		}
	}

	// 7. Non-author cannot delete media (403); author deletes m1 while draft (204 + removed from storage).
	resp, _ = doJSON(t, env.app, http.MethodDelete, mediaPath+"/"+m1.Data.ID, otherAuth, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for non-author media delete, got %d", resp.StatusCode)
	}

	resp, _ = doJSON(t, env.app, http.MethodDelete, mediaPath+"/"+m1.Data.ID, authorAuth, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 for author media delete on draft, got %d", resp.StatusCode)
	}
	if env.storage.Has(m1.Data.FileURL) {
		t.Errorf("expected deleted media object to be removed from storage")
	}

	// 8. Submit report, then attempt to delete remaining photo -> 409 conflict (draft-only deletion).
	resp, _ = doJSON(t, env.app, http.MethodPost, "/api/v1/reports/"+reportID+"/submit", authorAuth, nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 on submit, got %d", resp.StatusCode)
	}
	resp, _ = doJSON(t, env.app, http.MethodDelete, mediaPath+"/"+m0.Data.ID, authorAuth, nil)
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 conflict when deleting media after submission, got %d", resp.StatusCode)
	}
}

func TestReportMedia_ValidationErrors(t *testing.T) {
	env := newTestEnv(t)
	author, authorAuth := env.seedCaller("warga_validasi", true, true)

	projectID := uuid.NewString()
	env.store.SeedProject(projectID, nil, nil)

	reportID := uuid.NewString()
	env.store.Seed(&Report{
		ID:                reportID,
		ProjectID:         projectID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Narrative:         "Draft laporan untuk uji validasi upload.",
		ExifStatus:        ExifMissing,
		Status:            StatusDraft,
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, nil, 0)

	mediaPath := "/api/v1/reports/" + reportID + "/media"

	// 1. Unsupported MIME type (plain text) -> 415 unsupported_media_type.
	resp, body := doUpload(t, env.app, mediaPath, authorAuth, "", []byte("bukan file gambar melainkan teks biasa"))
	if resp.StatusCode != http.StatusUnsupportedMediaType || body.Error == nil || body.Error.Code != "unsupported_media_type" {
		t.Fatalf("expected 415 unsupported_media_type, got %d (%+v)", resp.StatusCode, body.Error)
	}

	// 2. File larger than 5 MB -> 413 file_too_large.
	oversized := make([]byte, MaxPhotoBytes+1024)
	copy(oversized, buildPNGWithoutEXIF())
	resp, body = doUpload(t, env.app, mediaPath, authorAuth, "", oversized)
	if resp.StatusCode != http.StatusRequestEntityTooLarge || body.Error == nil || body.Error.Code != "file_too_large" {
		t.Fatalf("expected 413 file_too_large, got %d (%+v)", resp.StatusCode, body.Error)
	}

	// 3. Invalid sort_order (outside 0..3) -> 422 validation_failed.
	resp, body = doUpload(t, env.app, mediaPath, authorAuth, "7", buildPNGWithoutEXIF())
	if resp.StatusCode != http.StatusUnprocessableEntity || body.Error == nil || body.Error.Code != "validation_failed" {
		t.Fatalf("expected 422 validation_failed for sort_order=7, got %d (%+v)", resp.StatusCode, body.Error)
	}
}
