package auth

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/password"
	"warta.com/api/internal/token"
	"warta.com/api/internal/user"
)

func newTestApp(t *testing.T) (*fiber.App, *user.MemoryStore, *token.Manager) {
	store := user.NewMemoryStore()
	manager := token.NewManager("handler-test-secret-0123456789", time.Hour)
	h := NewHandler(store, manager)

	app := fiber.New(fiber.Config{ErrorHandler: failFast(t)})
	app.Use(middleware.RequestID())
	app.Post("/auth/register", h.Register)
	app.Post("/auth/login", h.Login)
	app.Get("/auth/me", middleware.Bearer(manager), h.Me)
	return app, store, manager
}

func failFast(t *testing.T) fiber.ErrorHandler {
	return func(c fiber.Ctx, err error) error {
		t.Errorf("unexpected handler error: %v", err)
		return httpx.Error(c, 500, "internal_error", "test")
	}
}

type envelope struct {
	Data  json.RawMessage `json:"data"`
	Error *struct {
		Code    string `json:"code"`
		Message string `json:"message"`
		Details []struct {
			Field   string `json:"field"`
			Message string `json:"message"`
		} `json:"details"`
	} `json:"error"`
}

func post(t *testing.T, app *fiber.App, path, body string) (*http.Response, envelope) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request %s: %v", path, err)
	}
	return resp, readEnvelope(t, resp)
}

func readEnvelope(t *testing.T, resp *http.Response) envelope {
	t.Helper()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("body: %v", err)
	}
	var e envelope
	if err := json.Unmarshal(raw, &e); err != nil {
		t.Fatalf("envelope on %s: %v (%s)", resp.Request.URL, err, raw)
	}
	return e
}

func fieldDetails(e envelope) map[string]string {
	out := make(map[string]string)
	for _, d := range e.Error.Details {
		out[d.Field] = d.Message
	}
	return out
}

// --- register ----------------------------------------------------------------

func TestRegisterCreatesAccountWithLocation(t *testing.T) {
	app, _, _ := newTestApp(t)

	resp, e := post(t, app, "/auth/register", `{
		"display_name": "warga_jakarta",
		"email": "Warga@Example.com",
		"password": "correct-horse-battery"
	}`)

	if resp.StatusCode != 201 {
		t.Fatalf("want 201, got %d (%s)", resp.StatusCode, e.Data)
	}
	if loc := resp.Header.Get("Location"); !strings.HasPrefix(loc, "/api/v1/users/") {
		t.Fatalf("want Location /api/v1/users/<id>, got %q", loc)
	}
	var data map[string]any
	if err := json.Unmarshal(e.Data, &data); err != nil {
		t.Fatalf("data: %v", err)
	}
	if data["display_name"] != "warga_jakarta" || data["email"] != "warga@example.com" {
		t.Fatalf("unexpected profile: %v", data)
	}
	if data["email_verified_at"] != nil {
		t.Fatalf("new accounts start unverified, got %v", data["email_verified_at"])
	}
}

func TestRegisterCollectsEveryValidationFailure(t *testing.T) {
	app, _, _ := newTestApp(t)

	resp, e := post(t, app, "/auth/register", `{
		"display_name": "ab!",
		"email": "not-an-email",
		"password": "short"
	}`)

	if resp.StatusCode != 422 {
		t.Fatalf("want 422, got %d", resp.StatusCode)
	}
	if e.Error.Code != "validation_failed" {
		t.Fatalf("want validation_failed, got %q", e.Error.Code)
	}
	details := fieldDetails(e)
	for _, field := range []string{"display_name", "email", "password"} {
		if _, has := details[field]; !has {
			t.Fatalf("missing field detail %q in %v", field, details)
		}
	}
}

func TestRegisterRejectsDuplicateDisplayNameAcrossCase(t *testing.T) {
	app, store, _ := newTestApp(t)
	mustSeed(t, store, "warga_jakarta", "one@example.com", "correct-horse-battery", true)

	resp, e := post(t, app, "/auth/register", `{
		"display_name": "WARGA_JAKARTA",
		"email": "two@example.com",
		"password": "correct-horse-battery"
	}`)

	if resp.StatusCode != 409 || e.Error.Code != "conflict" {
		t.Fatalf("want 409 conflict, got %d %q", resp.StatusCode, e.Error.Code)
	}
}

func TestRegisterRejectsDuplicateEmailAcrossCase(t *testing.T) {
	app, store, _ := newTestApp(t)
	mustSeed(t, store, "other", "Warga@example.com", "correct-horse-battery", true)

	resp, e := post(t, app, "/auth/register", `{
		"display_name": "warga_baru",
		"email": "warga@example.com",
		"password": "correct-horse-battery"
	}`)

	if resp.StatusCode != 409 || e.Error.Code != "conflict" {
		t.Fatalf("want 409 conflict, got %d %q", resp.StatusCode, e.Error.Code)
	}
}

func TestRegisterRejectsMalformedJSON(t *testing.T) {
	app, _, _ := newTestApp(t)
	resp, e := post(t, app, "/auth/register", `{display_name:}`)

	if resp.StatusCode != 400 || e.Error.Code != "bad_request" {
		t.Fatalf("want 400 bad_request, got %d %q", resp.StatusCode, e.Error.Code)
	}
}

// --- login ---------------------------------------------------------------------

func TestLoginIssuesTokenAndProfile(t *testing.T) {
	app, store, _ := newTestApp(t)
	mustSeed(t, store, "warga_jakarta", "warga@example.com", "correct-horse-battery", true)

	resp, e := post(t, app, "/auth/login", `{
		"email": "warga@example.com",
		"password": "correct-horse-battery"
	}`)

	if resp.StatusCode != 200 {
		t.Fatalf("want 200, got %d (%s)", resp.StatusCode, e.Data)
	}
	var data struct {
		AccessToken string         `json:"access_token"`
		TokenType   string         `json:"token_type"`
		ExpiresIn   int64          `json:"expires_in"`
		User        map[string]any `json:"user"`
	}
	if err := json.Unmarshal(e.Data, &data); err != nil {
		t.Fatalf("data: %v", err)
	}
	if data.TokenType != "Bearer" || data.ExpiresIn != 3600 {
		t.Fatalf("bad token metadata: %+v", data)
	}
	if data.User["email"] != "warga@example.com" || data.User["id"] == nil {
		t.Fatalf("bad auth user: %v", data.User)
	}
}

func TestLoginUnknownEmailMatchesWrongPasswordResponse(t *testing.T) {
	app, store, _ := newTestApp(t)
	mustSeed(t, store, "real", "real@example.com", "correct-horse-battery", true)

	// Unknown email and wrong password must be byte-identical bodies (§9.3).
	unknownStatus, unknownBody := loginFor(t, app, "nobody@example.com", "whatever-secret")
	wrongStatus, wrongBody := loginFor(t, app, "real@example.com", "wrong-one")

	if unknownStatus != 401 || wrongStatus != 401 {
		t.Fatalf("want 401 for both, got %d and %d", unknownStatus, wrongStatus)
	}
	if unknownBody != wrongBody {
		t.Fatalf("bodies diverge:\n unknown: %s\n   wrong: %s", unknownBody, wrongBody)
	}
}

func TestLoginDeactivatedAccountIs403(t *testing.T) {
	app, store, _ := newTestApp(t)
	mustSeed(t, store, "sleeper", "sleeper@example.com", "correct-horse-battery", false)

	resp, e := post(t, app, "/auth/login", `{
		"email": "sleeper@example.com",
		"password": "correct-horse-battery"
	}`)

	if resp.StatusCode != 403 || e.Error.Code != "account_inactive" {
		t.Fatalf("want 403 account_inactive, got %d %q", resp.StatusCode, e.Error.Code)
	}
}

func TestLoginValidationListsFieldErrors(t *testing.T) {
	app, _, _ := newTestApp(t)
	resp, e := post(t, app, "/auth/login", `{"email": "", "password": ""}`)

	if resp.StatusCode != 422 || e.Error.Code != "validation_failed" {
		t.Fatalf("want 422 validation_failed, got %d %q", resp.StatusCode, e.Error.Code)
	}
	if len(fieldDetails(e)) < 2 {
		t.Fatalf("want both fields validated, got %v", e.Error.Details)
	}
}

// --- /auth/me ----------------------------------------------------------------

func TestMeReturnsPrivateProfileForToken(t *testing.T) {
	app, store, _ := newTestApp(t)
	stored := mustSeed(t, store, "warga_jakarta", "warga@example.com", "correct-horse-battery", true)

	status, body := loginFor(t, app, "warga@example.com", "correct-horse-battery")
	if status != 200 {
		t.Fatalf("login failed: %d %s", status, body)
	}
	var data struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal([]byte(body), &data); err != nil || data.AccessToken == "" {
		t.Fatalf("token in body %s: %v", body, err)
	}

	req := httptest.NewRequest(http.MethodGet, "/auth/me", nil)
	req.Header.Set("Authorization", "Bearer "+data.AccessToken)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("me: %v", err)
	}
	e := readEnvelope(t, resp)
	if resp.StatusCode != 200 {
		t.Fatalf("want 200, got %d (%s)", resp.StatusCode, e.Data)
	}
	var profile map[string]any
	if err := json.Unmarshal(e.Data, &profile); err != nil {
		t.Fatalf("profile: %v", err)
	}
	if profile["id"] != stored.ID || profile["email"] != "warga@example.com" {
		t.Fatalf("wrong profile: %v", profile)
	}
	for _, key := range []string{"is_active", "created_at", "updated_at"} {
		if _, has := profile[key]; !has {
			t.Fatalf("private profile missing %q: %v", key, profile)
		}
	}
	if _, has := profile["password_hash"]; has {
		t.Fatalf("hash leaked into response: %v", profile)
	}
}

// --- helpers -------------------------------------------------------------------

func loginFor(t *testing.T, app *fiber.App, email, pass string) (int, string) {
	t.Helper()
	resp, e := post(t, app, "/auth/login", `{"email": "`+email+`", "password": "`+pass+`"}`)
	if e.Data != nil {
		return resp.StatusCode, string(e.Data)
	}
	raw, err := json.Marshal(e.Error)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return resp.StatusCode, string(raw)
}

func mustSeed(t *testing.T, store *user.MemoryStore, name, email, pass string, active bool) *user.User {
	t.Helper()
	hashed, err := password.Hash(pass)
	if err != nil {
		t.Fatalf("hash: %v", err)
	}
	return store.MustAdd(user.User{
		DisplayName:  name,
		Email:        email,
		PasswordHash: hashed,
		IsActive:     active,
	})
}
