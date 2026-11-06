package middleware

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/token"
)

// authEnvelope mirrors the catalogue error shape (api-guidelines §4.1).
type authEnvelope struct {
	Error struct {
		Code    string `json:"code"`
		Message string `json:"message"`
	} `json:"error"`
}

func TestRequestIDPassesThroughValidHeader(t *testing.T) {
	app := testApp()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set(HeaderRequestID, "0123456789abcdef0123456789abcdef")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	if got := resp.Header.Get(HeaderRequestID); got != "0123456789abcdef0123456789abcdef" {
		t.Fatalf("want supplied id echoed, got %q", got)
	}
}

func TestRequestIDRejectsUnsafeHeader(t *testing.T) {
	app := testApp()
	req := httptest.NewRequest(http.MethodGet, "/ping", nil)
	req.Header.Set(HeaderRequestID, "bad\r\nX: inject")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	if got := resp.Header.Get(HeaderRequestID); got == "bad\r\nX: inject" || !looksLikeUUID(got) {
		t.Fatalf("want generated UUID, got %q", got)
	}
}

func TestRequestIDGeneratesWhenMissing(t *testing.T) {
	app := testApp()
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/ping", nil))
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	if got := resp.Header.Get(HeaderRequestID); !looksLikeUUID(got) {
		t.Fatalf("want generated UUID, got %q", got)
	}
}

func testApp() *fiber.App {
	app := fiber.New()
	app.Use(RequestID())
	app.Get("/ping", func(c fiber.Ctx) error {
		return c.SendString("ok")
	})
	return app
}

func looksLikeUUID(s string) bool {
	return len(s) == 36 && strings.Count(s, "-") == 4
}

func TestRateLimiterAllowsUnderLimitThenReturns429(t *testing.T) {
	app := fiber.New()
	limiter := NewRateLimiter(2, time.Minute)
	app.Post("/gate", limiter.Middleware(), func(c fiber.Ctx) error {
		return c.SendStatus(fiber.StatusOK)
	})

	call := func() *http.Response {
		resp, err := app.Test(httptest.NewRequest(http.MethodPost, "/gate", nil))
		if err != nil {
			t.Fatalf("test: %v", err)
		}
		return resp
	}

	if code := call().StatusCode; code != 200 {
		t.Fatalf("first call: want 200 got %d", code)
	}
	if code := call().StatusCode; code != 200 {
		t.Fatalf("second call: want 200 got %d", code)
	}

	third := call()
	if third.StatusCode != 429 {
		t.Fatalf("third call: want 429 got %d", third.StatusCode)
	}
	retryAfter := third.Header.Get(fiber.HeaderRetryAfter)
	seconds, err := strconv.Atoi(retryAfter)
	if err != nil || seconds <= 0 || seconds > 60 {
		t.Fatalf("want Retry-After in (0,60], got %q", retryAfter)
	}
}

func TestBearerRejectsMissingHeader(t *testing.T) {
	app, _ := authApp(time.Hour)
	resp, err := app.Test(httptest.NewRequest(http.MethodGet, "/me", nil))
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	assertAuthFailure(t, resp, 401, "token_expired", "Missing or invalid access token.")
}

func TestBearerRejectsExpiredToken(t *testing.T) {
	app, manager := authApp(-time.Second)
	issued, err := manager.Issue("user-x")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+issued)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	assertAuthFailure(t, resp, 401, "token_expired", "The access token has expired.")
}

func TestBearerRejectsGarbageToken(t *testing.T) {
	app, _ := authApp(time.Hour)

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer not.a.jwt")
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	assertAuthFailure(t, resp, 401, "token_expired", "Missing or invalid access token.")
}

func TestBearerRejectsWrongScheme(t *testing.T) {
	app, manager := authApp(time.Hour)
	issued, err := manager.Issue("user-x")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Basic "+issued)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	assertAuthFailure(t, resp, 401, "token_expired", "Missing or invalid access token.")
}

func TestBearerAcceptsValidToken(t *testing.T) {
	subject := "0f0f0f0f-0000-4000-8000-000000000001"
	app, manager := authApp(time.Hour)
	issued, err := manager.Issue(subject)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	req := httptest.NewRequest(http.MethodGet, "/me", nil)
	req.Header.Set("Authorization", "Bearer "+issued)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("test: %v", err)
	}
	if resp.StatusCode != 200 {
		t.Fatalf("want 200, got %d", resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("body: %v", err)
	}
	if !strings.HasPrefix(string(body), subject) {
		t.Fatalf("want subject %q echoed, got %q", subject, string(body))
	}
}

// authApp builds the middleware under test paired with its own token
// manager, so tests mint tokens the exact middleware will verify.
func authApp(ttl time.Duration) (*fiber.App, *token.Manager) {
	manager := token.NewManager("auth-test-secret-0123456789", ttl)
	app := fiber.New()
	app.Get("/me", Bearer(manager), func(c fiber.Ctx) error {
		id, _ := c.Locals(LocalUserID).(string)
		return c.SendString(id)
	})
	return app, manager
}

func assertAuthFailure(t *testing.T, resp *http.Response, wantStatus int, wantCode, wantMessage string) {
	t.Helper()
	if resp.StatusCode != wantStatus {
		t.Fatalf("want %d, got %d", wantStatus, resp.StatusCode)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("body: %v", err)
	}
	var envelope authEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		t.Fatalf("envelope: %v (%s)", err, body)
	}
	if envelope.Error.Code != wantCode {
		t.Fatalf("want code %q, got %q", wantCode, envelope.Error.Code)
	}
	if envelope.Error.Message != wantMessage {
		t.Fatalf("want message %q, got %q", wantMessage, envelope.Error.Message)
	}
}
