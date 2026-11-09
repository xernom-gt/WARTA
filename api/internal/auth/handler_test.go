package auth

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/authtoken"
	"warta.com/api/internal/httpx"
	"warta.com/api/internal/mailer"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/password"
	"warta.com/api/internal/token"
	"warta.com/api/internal/user"
)

func newTestApp(t *testing.T) (*fiber.App, *user.MemoryStore, *token.Manager, *authtoken.MemoryStore, *mailer.Recorder) {
	t.Helper()
	store := user.NewMemoryStore()
	manager := token.NewManager("handler-test-secret-0123456789", time.Hour)
	tokens := authtoken.NewMemoryStore()
	mail := new(mailer.Recorder)
	h := NewHandler(Deps{
		Store:      store,
		Manager:    manager,
		Tokens:     tokens,
		Mail:       mail,
		MailFrom:   "WARTA <test@warta.example>",
		VerifyBase: "https://app.example.test/verify-email",
	})

	// resendLimit mirrors the wire() gate: 3/hour keyed per account (§6.21),
	// which only makes sense after Bearer stamps the account id.
	resendLimit := middleware.NewRateLimiter(3, time.Hour)
	resend := resendLimit.MiddlewareForKey(func(c fiber.Ctx) string {
		id, _ := c.Locals(middleware.LocalUserID).(string)
		return id
	})

	app := fiber.New(fiber.Config{ErrorHandler: failFast(t)})
	app.Use(middleware.RequestID())
	app.Post("/auth/register", h.Register)
	app.Post("/auth/login", h.Login)
	app.Post("/auth/verify-email", h.VerifyEmail)
	app.Post("/auth/resend-verification", middleware.Bearer(manager, nil), resend, h.ResendVerification)
	app.Get("/auth/me", middleware.Bearer(manager, nil), h.Me)
	return app, store, manager, tokens, mail
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
	app, _, _, _, _ := newTestApp(t)

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
	app, _, _, _, _ := newTestApp(t)

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
	app, store, _, _, _ := newTestApp(t)
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
	app, store, _, _, _ := newTestApp(t)
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
	app, _, _, _, _ := newTestApp(t)
	resp, e := post(t, app, "/auth/register", `{display_name:}`)

	if resp.StatusCode != 400 || e.Error.Code != "bad_request" {
		t.Fatalf("want 400 bad_request, got %d %q", resp.StatusCode, e.Error.Code)
	}
}

// --- login ---------------------------------------------------------------------

func TestLoginIssuesTokenAndProfile(t *testing.T) {
	app, store, _, _, _ := newTestApp(t)
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
	app, store, _, _, _ := newTestApp(t)
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
	app, store, _, _, _ := newTestApp(t)
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
	app, _, _, _, _ := newTestApp(t)
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
	app, store, _, _, _ := newTestApp(t)
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

// --- email verification -------------------------------------------------------

func TestRegisterDeliversVerificationEmail(t *testing.T) {
	app, _, _, _, mail := newTestApp(t)

	resp, _ := post(t, app, "/auth/register", `{
		"display_name": "warga_jakarta",
		"email": "warga@example.com",
		"password": "correct-horse-battery"
	}`)
	if resp.StatusCode != 201 {
		t.Fatalf("want 201, got %d", resp.StatusCode)
	}

	sent := mail.Sent()
	if len(sent) != 1 {
		t.Fatalf("want exactly one verification mail, got %d", len(sent))
	}
	if sent[0].To != "warga@example.com" || sent[0].Subject == "" {
		t.Fatalf("bad mail envelope: %+v", sent[0])
	}
	if !strings.Contains(sent[0].Text, "?token=") {
		t.Fatalf("mail lacks the single-use link: %q", sent[0].Text)
	}
}

func TestRegisterSurvivesBrokenMailDelivery(t *testing.T) {
	app, _, _, _, mail := newTestApp(t)
	mail.Fail = errors.New("smtp down")

	resp, _ := post(t, app, "/auth/register", `{
		"display_name": "warga_jakarta",
		"email": "warga@example.com",
		"password": "correct-horse-battery"
	}`)

	// §6.1/§6.21: an account whose mail could not go out is still 201 — the
	// row exists, and resend-verification is the recovery path. Failing the
	// response would strand 201-retry callers at a 409 conflict.
	if resp.StatusCode != 201 {
		t.Fatalf("want 201 despite mail outage, got %d", resp.StatusCode)
	}
}

func TestVerifyEmailMarksAddressVerified(t *testing.T) {
	app, _, _, _, mail := newTestApp(t)
	resp, _ := post(t, app, "/auth/register", `{
		"display_name": "warga_jakarta",
		"email": "warga@example.com",
		"password": "correct-horse-battery"
	}`)
	if resp.StatusCode != 201 {
		t.Fatalf("register: want 201, got %d", resp.StatusCode)
	}

	_, e := post(t, app, "/auth/verify-email", `{"token": "`+tokenFrom(t, mail.Sent())+`"}`)
	if e.Error != nil {
		t.Fatalf("want success, got %+v", e.Error)
	}
	var profile map[string]any
	if err := json.Unmarshal(e.Data, &profile); err != nil {
		t.Fatalf("data: %v", err)
	}
	if profile["email_verified_at"] == nil {
		t.Fatalf("address still unverified: %v", profile)
	}
	if profile["email"] != "warga@example.com" {
		t.Fatalf("wrong profile: %v", profile)
	}
}

func TestVerifyEmailTokenIsSingleUse(t *testing.T) {
	app, _, _, _, mail := newTestApp(t)
	post(t, app, "/auth/register", `{
		"display_name": "warga_jakarta",
		"email": "warga@example.com",
		"password": "correct-horse-battery"
	}`)
	raw := tokenFrom(t, mail.Sent())

	resp, _ := post(t, app, "/auth/verify-email", `{"token": "`+raw+`"}`)
	if resp.StatusCode != 200 {
		t.Fatalf("first use: want 200, got %d", resp.StatusCode)
	}
	resp, e := post(t, app, "/auth/verify-email", `{"token": "`+raw+`"}`)
	if resp.StatusCode != 422 || e.Error.Code != "validation_failed" {
		t.Fatalf("replay: want 422 validation_failed, got %d %+v", resp.StatusCode, e.Error)
	}
}

func TestVerifyEmailRejectsBadTokensUniformly(t *testing.T) {
	app, _, _, _, _ := newTestApp(t)

	cases := map[string]struct {
		status int
		code   string
		body   string
	}{
		"unknown token": {422, "validation_failed", `{"token": "nonexistent-entropy"}`},
		"empty token":   {422, "validation_failed", `{"token": ""}`},
		"malformed body": {400, "bad_request", `{token}`},
	}
	for name, tc := range cases {
		resp, e := post(t, app, "/auth/verify-email", tc.body)
		if resp.StatusCode != tc.status {
			t.Fatalf("%s: want %d, got %d (%v)", name, tc.status, resp.StatusCode, e.Error)
		}
		if e.Error == nil || e.Error.Code != tc.code {
			t.Fatalf("%s: want code %q, got %+v", name, tc.code, e.Error)
		}
	}

	// §3.15: expired, used, and unknown tokens reject without distinguishing
	// details, so the uniform 422 stays detailless.
	_, e := post(t, app, "/auth/verify-email", `{"token": "nonexistent-entropy"}`)
	if len(e.Error.Details) != 0 {
		t.Fatalf("uniform rejection must be detailless, got %+v", e.Error.Details)
	}
}

func TestVerifyEmailAlreadyVerifiedIs409(t *testing.T) {
	app, store, _, tokens, _ := newTestApp(t)
	stored := mustSeedVerified(t, store, "verified", "warga@example.com", "correct-horse-battery")

	raw, tok, err := authtoken.New(stored.ID, authtoken.EmailVerification,
		time.Now().UTC(), authtoken.StandardTTL)
	if err != nil {
		t.Fatalf("token: %v", err)
	}
	if err := tokens.Issue(context.Background(), &tok); err != nil {
		t.Fatalf("issue: %v", err)
	}

	resp, e := post(t, app, "/auth/verify-email", `{"token": "`+raw+`"}`)
	if resp.StatusCode != 409 || e.Error == nil || e.Error.Code != "email_already_verified" {
		t.Fatalf("want 409 email_already_verified, got %d %+v", resp.StatusCode, e.Error)
	}
}

func TestResendVerificationIssuesFreshTokenAndInvalidatesOld(t *testing.T) {
	app, _, _, _, mail := newTestApp(t)
	post(t, app, "/auth/register", `{
		"display_name": "warga_jakarta",
		"email": "warga@example.com",
		"password": "correct-horse-battery"
	}`)
	jwt := bearerOf(t, app, "warga@example.com", "correct-horse-battery")

	sent := mail.Sent()
	if len(sent) != 1 {
		t.Fatalf("register should have mailed once, got %d", len(sent))
	}
	resp, raw := postBearer(t, app, "/auth/resend-verification", jwt, "")
	if resp.StatusCode != 204 || raw != "" {
		t.Fatalf("want empty 204, got %d %.10q", resp.StatusCode, raw)
	}
	if sent = mail.Sent(); len(sent) != 2 {
		t.Fatalf("resend should have mailed once more, got %d", len(sent))
	}
	stale := tokenFrom(t, sent[:1])
	fresh := tokenFrom(t, sent[1:])

	// §3.15: issuing invalidates the earlier unused token — the register
	// link is dead the moment the resend lands.
	respStale, eStale := post(t, app, "/auth/verify-email", `{"token": "`+stale+`"}`)
	if respStale.StatusCode != 422 || eStale.Error.Code != "validation_failed" {
		t.Fatalf("stale token: want 422, got %d %+v", respStale.StatusCode, eStale.Error)
	}
	respFresh, eFresh := post(t, app, "/auth/verify-email", `{"token": "`+fresh+`"}`)
	if respFresh.StatusCode != 200 || eFresh.Error != nil {
		t.Fatalf("fresh token: want 200, got %d %+v", respFresh.StatusCode, eFresh.Error)
	}
}

func TestResendVerificationLimitIsPerAccount(t *testing.T) {
	app, store, _, _, _ := newTestApp(t)
	mustSeed(t, store, "warga_satu", "satu@example.com", "correct-horse-battery", true)
	mustSeed(t, store, "warga_dua", "dua@example.com", "correct-horse-battery", true)
	jwtSatu := bearerOf(t, app, "satu@example.com", "correct-horse-battery")
	jwtDua := bearerOf(t, app, "dua@example.com", "correct-horse-battery")

	// §6.21: 3 requests per hour per account — the fourth hits the gate.
	for i := 0; i < 3; i++ {
		resp, _ := postBearer(t, app, "/auth/resend-verification", jwtSatu, "")
		if resp.StatusCode != 204 {
			t.Fatalf("resend %d: want 204, got %d", i+1, resp.StatusCode)
		}
	}
	resp, raw := postBearer(t, app, "/auth/resend-verification", jwtSatu, "")
	if resp.StatusCode != 429 || raw == "" {
		t.Fatalf("fourth resend: want rate-limited envelope, got %d %.10q", resp.StatusCode, raw)
	}
	if retryAfter := resp.Header.Get("Retry-After"); retryAfter == "" {
		t.Fatal("429 must carry Retry-After (§9.2)")
	}

	// The budget is per account: account dua keeps its own three.
	resp, _ = postBearer(t, app, "/auth/resend-verification", jwtDua, "")
	if resp.StatusCode != 204 {
		t.Fatalf("second account: want 204 (independent budget), got %d", resp.StatusCode)
	}
}

func TestResendVerificationVerifiedIsSilentNoOp(t *testing.T) {
	app, store, _, _, mail := newTestApp(t)
	mustSeedVerified(t, store, "verified", "warga@example.com", "correct-horse-battery")
	jwt := bearerOf(t, app, "warga@example.com", "correct-horse-battery")

	resp, raw := postBearer(t, app, "/auth/resend-verification", jwt, "")
	if resp.StatusCode != 204 || raw != "" {
		t.Fatalf("want silent 204, got %d %.10q", resp.StatusCode, raw)
	}
	if len(mail.Sent()) != 0 {
		t.Fatal("verified accounts must not receive further invitations")
	}
}

func TestResendVerificationRequiresAuth(t *testing.T) {
	app, _, _, _, _ := newTestApp(t)

	resp, e := post(t, app, "/auth/resend-verification", "")
	if resp.StatusCode != 401 || e.Error == nil || e.Error.Code != "token_expired" {
		t.Fatalf("want 401 token_expired, got %d %+v", resp.StatusCode, e.Error)
	}

	req := httptest.NewRequest(http.MethodPost, "/auth/resend-verification", nil)
	req.Header.Set("Authorization", "Bearer not-a-jwt")
	garbage, err := app.Test(req)
	if err != nil {
		t.Fatalf("bearer garbage: %v", err)
	}
	eg := readEnvelope(t, garbage)
	if garbage.StatusCode != 401 || eg.Error.Code != "token_expired" {
		t.Fatalf("garbage bearer: want 401 token_expired, got %d %+v", garbage.StatusCode, eg.Error)
	}
}

// --- helpers -------------------------------------------------------------------

// bearerOf logs in and returns the access token for Bearer-authed tests.
func bearerOf(t *testing.T, app *fiber.App, email, pass string) string {
	t.Helper()
	status, body := loginFor(t, app, email, pass)
	if status != 200 {
		t.Fatalf("login %s failed: %d %s", email, status, body)
	}
	var data struct {
		AccessToken string `json:"access_token"`
	}
	if err := json.Unmarshal([]byte(body), &data); err != nil || data.AccessToken == "" {
		t.Fatalf("token not in body %s: %v", body, err)
	}
	return data.AccessToken
}

// postBearer posts with a Bearer header and returns the raw body, because
// 204 responses carry no envelope to decode.
func postBearer(t *testing.T, app *fiber.App, path, jwt, body string) (*http.Response, string) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	req.Header.Set("Authorization", "Bearer "+jwt)
	resp, err := app.Test(req)
	if err != nil {
		t.Fatalf("request %s: %v", path, err)
	}
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatalf("body %s: %v", path, err)
	}
	return resp, string(raw)
}

// tokenFrom digs the raw single-use token out of a delivered verification
// email (the link is the only place the raw value exists).
func tokenFrom(t *testing.T, mail []mailer.Email) string {
	t.Helper()
	if len(mail) == 0 {
		t.Fatal("no mail was delivered")
	}
	last := mail[len(mail)-1].Text
	_, rest, ok := strings.Cut(last, "?token=")
	if !ok {
		t.Fatalf("verification mail lacks ?token= link: %q", last)
	}
	line, _, _ := strings.Cut(rest, "\n")
	if tok := strings.TrimSpace(line); tok != "" {
		return tok
	}
	t.Fatalf("?token= trails without a value: %q", last)
	return ""
}

// mustSeedVerified plants an account whose address is already verified,
// reaching for the same write-once path the handlers use.
func mustSeedVerified(t *testing.T, store *user.MemoryStore, name, email, pass string) *user.User {
	t.Helper()
	seeded := mustSeed(t, store, name, email, pass, true)
	verified, err := store.MarkEmailVerified(context.Background(),
		seeded.ID, time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC))
	if err != nil {
		t.Fatalf("seed verified: %v", err)
	}
	return verified
}

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
