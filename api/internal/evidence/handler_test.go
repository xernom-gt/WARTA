package evidence

import (
	"bytes"
	"context"
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
	"warta.com/api/internal/report"
	"warta.com/api/internal/token"
)

type testEnv struct {
	app     *fiber.App
	store   *MemoryStore
	storage *report.MemoryMediaStorage
	manager *token.Manager
	callers map[string]*Caller
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()

	store := NewMemoryStore()
	storage := report.NewMemoryMediaStorage("https://storage.warta.id")
	manager := token.NewManager("evidence-test-secret-0123456789", time.Hour)
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
	app.Get("/api/v1/reports/:report_id/evidences", middleware.OptionalBearer(manager, nil), h.ListByReport)
	app.Post("/api/v1/reports/:report_id/evidences", middleware.Bearer(manager, nil), h.Create)
	app.Get("/api/v1/evidences/:evidence_id", middleware.OptionalBearer(manager, nil), h.Get)
	app.Get("/api/v1/evidences/:evidence_id/media", middleware.OptionalBearer(manager, nil), h.ListMedia)
	app.Post("/api/v1/evidences/:evidence_id/media", middleware.Bearer(manager, nil), h.UploadMedia)
	app.Delete("/api/v1/evidences/:evidence_id/media/:media_id", middleware.Bearer(manager, nil), h.DeleteMedia)

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

type evidenceEnvelope struct {
	Data  EvidenceView `json:"data"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details []struct {
			Field   string `json:"field"`
			Message string `json:"message"`
		} `json:"details"`
	} `json:"error"`
}

type evidenceListEnvelope struct {
	Data []EvidenceView `json:"data"`
	Meta Meta           `json:"meta"`
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

func doJSON(t *testing.T, app *fiber.App, method, path, auth string, body any) (*http.Response, evidenceEnvelope) {
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
	var env evidenceEnvelope
	if len(raw) > 0 {
		if err := json.Unmarshal(raw, &env); err != nil {
			t.Fatalf("decode envelope (%q): %v", string(raw), err)
		}
	}
	return resp, env
}

func doUpload(t *testing.T, app *fiber.App, path, auth string, fileBytes []byte) (*http.Response, mediaEnvelope) {
	t.Helper()

	var body bytes.Buffer
	w := multipart.NewWriter(&body)
	if fileBytes != nil {
		part, err := w.CreateFormFile("file", "evidence.jpg")
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

func buildPNG() []byte {
	return []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1A, '\n', 0x00, 0x00, 0x00, 0x0D, 'I', 'H', 'D', 'R'}
}

func TestCreateEvidence_AnyCitizenAndValidation(t *testing.T) {
	env := newTestEnv(t)
	author, auth := env.seedCaller("warga_saksi", true, true)
	_, unverifiedAuth := env.seedCaller("warga_belum_verif", true, false)
	_, inactiveAuth := env.seedCaller("warga_nonaktif", false, true)

	reportID := uuid.NewString()
	env.store.SeedReport(reportID, "menunggu")

	t.Run("creates evidence successfully and returns 201 with Location header", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/reports/"+reportID+"/evidences", auth, map[string]any{
				"description": "Retakan di sisi timur semakin melebar setelah hujan semalam.",
			})
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("expected 201, got %d (%+v)", resp.StatusCode, body.Error)
		}
		if loc := resp.Header.Get("Location"); loc != "/api/v1/evidences/"+body.Data.ID {
			t.Errorf("expected Location header /api/v1/evidences/%s, got %q", body.Data.ID, loc)
		}
		if body.Data.ReportID != reportID || body.Data.UserID != author.ID {
			t.Errorf("unexpected IDs in response: %+v", body.Data)
		}
		if body.Data.AuthorDisplayName != author.DisplayName {
			t.Errorf("expected author display name %q, got %q", author.DisplayName, body.Data.AuthorDisplayName)
		}
		if len(body.Data.Media) != 0 {
			t.Errorf("expected 0 media initially, got %d", len(body.Data.Media))
		}
	})

	t.Run("rejects description exceeding 2000 chars or empty", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/reports/"+reportID+"/evidences", auth, map[string]any{
				"description": "   ",
			})
		if resp.StatusCode != http.StatusUnprocessableEntity || body.Error == nil {
			t.Fatalf("expected 422 for empty description, got %d (%+v)", resp.StatusCode, body.Error)
		}

		longDesc := strings.Repeat("A", 2001)
		resp, body = doJSON(t, env.app, http.MethodPost,
			"/api/v1/reports/"+reportID+"/evidences", auth, map[string]any{
				"description": longDesc,
			})
		if resp.StatusCode != http.StatusUnprocessableEntity || body.Error == nil {
			t.Fatalf("expected 422 for >2000 char description, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("rejects unverified or inactive users", func(t *testing.T) {
		resp, body := doJSON(t, env.app, http.MethodPost,
			"/api/v1/reports/"+reportID+"/evidences", unverifiedAuth, map[string]any{
				"description": "Valid description",
			})
		if resp.StatusCode != http.StatusForbidden || body.Error == nil || body.Error.Code != "email_not_verified" {
			t.Fatalf("expected 403 email_not_verified, got %d (%+v)", resp.StatusCode, body.Error)
		}

		resp, body = doJSON(t, env.app, http.MethodPost,
			"/api/v1/reports/"+reportID+"/evidences", inactiveAuth, map[string]any{
				"description": "Valid description",
			})
		if resp.StatusCode != http.StatusForbidden || body.Error == nil || body.Error.Code != "account_inactive" {
			t.Fatalf("expected 403 account_inactive, got %d (%+v)", resp.StatusCode, body.Error)
		}
	})

	t.Run("returns 404 for unknown report and 400 for malformed UUID", func(t *testing.T) {
		resp, _ := doJSON(t, env.app, http.MethodPost,
			"/api/v1/reports/not-uuid/evidences", auth, map[string]any{"description": "Valid"})
		if resp.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400, got %d", resp.StatusCode)
		}

		resp, _ = doJSON(t, env.app, http.MethodPost,
			"/api/v1/reports/"+uuid.NewString()+"/evidences", auth, map[string]any{"description": "Valid"})
		if resp.StatusCode != http.StatusNotFound {
			t.Fatalf("expected 404, got %d", resp.StatusCode)
		}
	})
}

func TestListAndGetEvidence(t *testing.T) {
	env := newTestEnv(t)
	author, _ := env.seedCaller("warga_pelapor", true, true)

	reportID := uuid.NewString()
	env.store.SeedReport(reportID, "menunggu")

	ev1ID := uuid.NewString()
	ev2ID := uuid.NewString()
	now := time.Now().UTC()
	env.store.Seed(&Evidence{
		ID:                ev1ID,
		ReportID:          reportID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Description:       "Bukti pertama",
		CreatedAt:         now.Add(-time.Hour),
		UpdatedAt:         now.Add(-time.Hour),
	}, nil)

	env.store.Seed(&Evidence{
		ID:                ev2ID,
		ReportID:          reportID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Description:       "Bukti kedua",
		CreatedAt:         now,
		UpdatedAt:         now,
	}, []*Media{{
		ID:         uuid.NewString(),
		EvidenceID: ev2ID,
		FileURL:    "https://storage.warta.id/evidences/" + ev2ID + "/photo.png",
		MediaType:  "image/png",
		CreatedAt:  now,
	}})

	// Public listing of evidences for reportID (newest first).
	req := httptest.NewRequest(http.MethodGet, "/api/v1/reports/"+reportID+"/evidences", nil)
	resp, err := env.app.Test(req)
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %v", resp)
	}
	raw, _ := io.ReadAll(resp.Body)
	var listResp evidenceListEnvelope
	_ = json.Unmarshal(raw, &listResp)
	if len(listResp.Data) != 2 {
		t.Fatalf("expected 2 items, got %d", len(listResp.Data))
	}
	if listResp.Data[0].ID != ev2ID || listResp.Data[1].ID != ev1ID {
		t.Errorf("expected newest first order, got %s then %s", listResp.Data[0].ID, listResp.Data[1].ID)
	}

	// Public single evidence lookup.
	resp, body := doJSON(t, env.app, http.MethodGet, "/api/v1/evidences/"+ev2ID, "", nil)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
	if body.Data.ID != ev2ID || len(body.Data.Media) != 1 {
		t.Errorf("unexpected evidence detail: %+v", body.Data)
	}
}

func TestEvidenceMedia_UploadAndReviewStateDeletion(t *testing.T) {
	env := newTestEnv(t)
	author, authorAuth := env.seedCaller("warga_pembuat_bukti", true, true)
	_, otherAuth := env.seedCaller("warga_lain", true, true)

	reportID := uuid.NewString()
	env.store.SeedReport(reportID, "menunggu")

	evidenceID := uuid.NewString()
	env.store.Seed(&Evidence{
		ID:                evidenceID,
		ReportID:          reportID,
		UserID:            author.ID,
		AuthorDisplayName: author.DisplayName,
		Description:       "Bukti foto retakan tambahan.",
		CreatedAt:         time.Now().UTC(),
		UpdatedAt:         time.Now().UTC(),
	}, nil)

	mediaPath := "/api/v1/evidences/" + evidenceID + "/media"

	// 1. Non-author cannot upload media -> 403.
	resp, _ := doUpload(t, env.app, mediaPath, otherAuth, buildPNG())
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for non-author upload, got %d", resp.StatusCode)
	}

	// 2. Author uploads up to 8 photos.
	var uploadedMediaIDs []string
	for i := 0; i < 8; i++ {
		resp, m := doUpload(t, env.app, mediaPath, authorAuth, buildPNG())
		if resp.StatusCode != http.StatusCreated {
			t.Fatalf("expected 201 on photo %d upload, got %d (%+v)", i+1, resp.StatusCode, m.Error)
		}
		uploadedMediaIDs = append(uploadedMediaIDs, m.Data.ID)
		if !env.storage.Has(m.Data.FileURL) {
			t.Errorf("expected media %s to exist in storage", m.Data.FileURL)
		}
	}

	// 3. 9th photo is rejected with 409 photo_limit_reached.
	resp, m9 := doUpload(t, env.app, mediaPath, authorAuth, buildPNG())
	if resp.StatusCode != http.StatusConflict || m9.Error == nil || m9.Error.Code != "photo_limit_reached" {
		t.Fatalf("expected 409 photo_limit_reached on 9th photo, got %d (%+v)", resp.StatusCode, m9.Error)
	}

	// 4. GET /evidences/{evidence_id}/media returns all 8 photos.
	req := httptest.NewRequest(http.MethodGet, mediaPath, nil)
	getResp, err := env.app.Test(req)
	if err != nil || getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %v", getResp)
	}
	raw, _ := io.ReadAll(getResp.Body)
	var mediaList mediaListEnvelope
	_ = json.Unmarshal(raw, &mediaList)
	if len(mediaList.Data) != 8 {
		t.Fatalf("expected 8 media items, got %d", len(mediaList.Data))
	}

	// 5. Non-author cannot delete media -> 403.
	deleteTargetID := uploadedMediaIDs[0]
	resp, _ = doJSON(t, env.app, http.MethodDelete, mediaPath+"/"+deleteTargetID, otherAuth, nil)
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for non-author media delete, got %d", resp.StatusCode)
	}

	// 6. Author deletes photo while report is pending (menunggu) -> 204 & removed from storage.
	resp, _ = doJSON(t, env.app, http.MethodDelete, mediaPath+"/"+deleteTargetID, authorAuth, nil)
	if resp.StatusCode != http.StatusNoContent {
		t.Fatalf("expected 204 for author media delete on pending report, got %d", resp.StatusCode)
	}

	// 7. Transition parent report to consensus verdict ("terverifikasi").
	env.store.SeedReport(reportID, "terverifikasi")

	// 8. Attempting to delete photo after consensus verdict is rejected with 409 conflict!
	secondTargetID := uploadedMediaIDs[1]
	resp, _ = doJSON(t, env.app, http.MethodDelete, mediaPath+"/"+secondTargetID, authorAuth, nil)
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 conflict when deleting media after report consensus, got %d", resp.StatusCode)
	}
}
