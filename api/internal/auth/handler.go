package auth

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/url"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/authtoken"
	"warta.com/api/internal/blocklist"
	"warta.com/api/internal/httpx"
	"warta.com/api/internal/mailer"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/password"
	"warta.com/api/internal/token"
	"warta.com/api/internal/user"
)

// Handler holds the auth endpoints' collaborators.
type Handler struct {
	store   user.Store
	manager *token.Manager
	tokens  authtoken.Store
	bl      blocklist.Store
	mail    mailer.Service
	// mailFrom is the RFC 5322 From header of outgoing mail (config MAIL_FROM).
	mailFrom string
	// verifyBase is the frontend page consuming the token (config
	// MAIL_VERIFY_BASE_URL); the raw token rides as ?token=.
	verifyBase string
}

// Deps bundles NewHandler's collaborators. Tokens and Mail are the email
// verification half added by the §3.5/§6.20-6.21 milestone.
type Deps struct {
	Store      user.Store
	Manager    *token.Manager
	Tokens     authtoken.Store
	Blocklist  blocklist.Store
	Mail       mailer.Service
	MailFrom   string
	VerifyBase string
}

// NewHandler wires the collaborators behind every /auth/* handler.
func NewHandler(d Deps) *Handler {
	return &Handler{
		store:      d.Store,
		manager:    d.Manager,
		tokens:     d.Tokens,
		bl:         d.Blocklist,
		mail:       d.Mail,
		mailFrom:   d.MailFrom,
		verifyBase: d.VerifyBase,
	}
}

// --- response shapes ---------------------------------------------------------

// AuthTokenView is openapi.yaml AuthToken: login's `data` object.
type AuthTokenView struct {
	AccessToken string       `json:"access_token"`
	TokenType   string       `json:"token_type"`
	ExpiresIn   int64        `json:"expires_in"`
	User        AuthUserView `json:"user"`
}

// AuthUserView is openapi.yaml AuthUser: the token's owner summary. It is
// the response-bounded shape and must never carry password material.
type AuthUserView struct {
	ID              string  `json:"id"`
	DisplayName     string  `json:"display_name"`
	Email           string  `json:"email"`
	EmailVerifiedAt *string `json:"email_verified_at,omitempty"`
}

// UserPrivateView is openapi.yaml UserPrivate: the private profile returned
// by register and /auth/me. Only /auth/* and /users/me expose `email` (§13.1).
type UserPrivateView struct {
	ID              string  `json:"id"`
	DisplayName     string  `json:"display_name"`
	Email           string  `json:"email"`
	EmailVerifiedAt *string `json:"email_verified_at,omitempty"`
	IsActive        bool    `json:"is_active"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

// authUserView renders the AuthUser shape of a user row.
func authUserView(u *user.User) AuthUserView {
	return AuthUserView{
		ID:              u.ID,
		DisplayName:     u.DisplayName,
		Email:           u.Email,
		EmailVerifiedAt: nullableRFC3339(u.EmailVerifiedAt),
	}
}

// userPrivateView renders the UserPrivate shape of a user row.
func userPrivateView(u *user.User) UserPrivateView {
	return UserPrivateView{
		ID:              u.ID,
		DisplayName:     u.DisplayName,
		Email:           u.Email,
		EmailVerifiedAt: nullableRFC3339(u.EmailVerifiedAt),
		IsActive:        u.IsActive,
		CreatedAt:       rfc3339(u.CreatedAt),
		UpdatedAt:       rfc3339(u.UpdatedAt),
	}
}

// rfc3339 serialises timestamps ISO 8601 UTC with the Z suffix (§2.5).
func rfc3339(t time.Time) string {
	return t.UTC().Format(time.RFC3339)
}

// nullableRFC3339 renders optional timestamps, omitting null fields to keep
// the `data` object lean while staying schema-compatible (fields allow null).
func nullableRFC3339(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := rfc3339(*t)
	return &s
}

// --- handlers ----------------------------------------------------------------

// Register implements POST /auth/register (§6.1): create the account with a
// hashed password, deliver the address-verification email, then hand back
// the private profile (§3.5).
func (h *Handler) Register(c fiber.Ctx) error {
	var req registerRequest
	if !decodeJSON(c, &req) {
		return nil // decodeJSON already rendered the 400 error envelope
	}

	details := validateRegister(&req)
	if len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity,
			"validation_failed", "One or more fields are invalid.", details...)
	}

	hashed, err := password.Hash(req.Password)
	if err != nil {
		return err
	}

	u := &user.User{
		DisplayName:  req.DisplayName,
		Email:        req.Email,
		PasswordHash: hashed,
		IsActive:     true, // §3.1: is_active defaults to TRUE
	}
	if err := h.store.Create(c.Context(), u); err != nil {
		var dup *user.DuplicateError
		if errors.As(err, &dup) {
			return httpx.Error(c, fiber.StatusConflict, "conflict",
				duplicateMessage(dup.Field), httpx.FieldError{
					Field: dup.Field.Field(), Message: "Already in use.",
				})
		}
		return err
	}

	// §6.1: the fresh account owns a verification email. Delivery is
	// best-effort (§6.21's send-regardless pattern): the row already
	// exists, so failing the response would strand 201-retry callers at a
	// 409 — a broken mail transport is logged and recoverable via
	// /auth/resend-verification once the citizen logs in.
	h.deliverVerification(c.Context(), u)

	c.Set(fiber.HeaderLocation, "/api/v1/users/"+u.ID)
	return httpx.Data(c, fiber.StatusCreated, userPrivateView(u))
}

// Login implements POST /auth/login (§6.2): exchange credentials for a
// bearer token. Unknown email and wrong password are indistinguishable from
// the outside: same status, same code, same CPU cost (§9.3).
func (h *Handler) Login(c fiber.Ctx) error {
	var req loginRequest
	if !decodeJSON(c, &req) {
		return nil
	}

	details := validateLogin(&req)
	if len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity,
			"validation_failed", "One or more fields are invalid.", details...)
	}

	u, err := h.store.FindByEmail(c.Context(), req.Email)
	switch {
	case err == nil:
		if !password.Compare(u.PasswordHash, req.Password) {
			return httpx.Error(c, fiber.StatusUnauthorized,
				"invalid_credentials", "Email or password is incorrect.")
		}
	case errors.Is(err, user.ErrNotFound):
		// Burn a bcrypt round so timing matches the password-miss path.
		password.Equalize(req.Password)
		return httpx.Error(c, fiber.StatusUnauthorized,
			"invalid_credentials", "Email or password is incorrect.")
	default:
		return err
	}

	if !u.IsActive {
		return httpx.Error(c, fiber.StatusForbidden,
			"account_inactive", "This account has been deactivated.")
	}

	issued, err := h.manager.Issue(u.ID)
	if err != nil {
		return err
	}
	return httpx.Data(c, fiber.StatusOK, AuthTokenView{
		AccessToken: issued,
		TokenType:   "Bearer",
		ExpiresIn:   int64(h.manager.TTL().Seconds()),
		User:        authUserView(u),
	})
}

// Me implements GET /auth/me (§6.3): the caller's private profile, the only
// place where `email` rides along per §13.1.
func (h *Handler) Me(c fiber.Ctx) error {
	id, _ := c.Locals(middleware.LocalUserID).(string)

	u, err := h.store.FindByID(c.Context(), id)
	switch {
	case err == nil:
	case errors.Is(err, user.ErrNotFound):
		// The token is valid but the row is gone: treat the session as
		// expired rather than leaking existence (§4.5).
		return httpx.Error(c, fiber.StatusUnauthorized,
			"token_expired", "Missing or invalid access token.")
	default:
		return err
	}

	if !u.IsActive {
		return httpx.Error(c, fiber.StatusForbidden,
			"account_inactive", "This account has been deactivated.")
	}
	return httpx.Data(c, fiber.StatusOK, userPrivateView(u))
}

// VerifyEmail implements POST /auth/verify-email (§6.20): public, because
// the token carries the account identity. Expired, used, unknown, or
// tampered tokens are uniformly rejected as 422 (§3.15 opacity); an owned
// but already-verified address is the catalogue's 409 email_already_verified.
// Consume deliberately precedes the verification stamp: the token is
// single-use even when the account it names turns out already verified.
func (h *Handler) VerifyEmail(c fiber.Ctx) error {
	var req verifyEmailRequest
	if !decodeJSON(c, &req) {
		return nil
	}

	if details := validateVerifyEmail(&req); len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity,
			"validation_failed", "One or more fields are invalid.", details...)
	}

	userID, err := h.tokens.Consume(c.Context(), req.Token,
		authtoken.EmailVerification, time.Now().UTC())
	if errors.Is(err, authtoken.ErrInvalidToken) {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"The verification token is invalid or has expired.")
	}
	if err != nil {
		return err
	}

	u, err := h.store.MarkEmailVerified(c.Context(), userID, time.Now().UTC())
	switch {
	case errors.Is(err, user.ErrAlreadyVerified):
		return httpx.Error(c, fiber.StatusConflict, "email_already_verified",
			"This email address is already verified.")
	case errors.Is(err, user.ErrNotFound):
		// The token was real but its account is gone (deletions cascade,
		// so this needs drift to occur); §3.15 opacity makes it look like
		// any other dead token.
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"The verification token is invalid or has expired.")
	case err != nil:
		return err
	}
	return httpx.Data(c, fiber.StatusOK, userPrivateView(u))
}

// ResendVerification implements POST /auth/resend-verification (§6.21):
// authenticated, replaces the previous unused token by issuing a fresh one,
// and answers 204 regardless of delivery so account state cannot be probed.
// The rate-limit middleware upstream keys 3/hour per account (§6.21), not
// per IP — see rate_limit.go MiddlewareForKey.
func (h *Handler) ResendVerification(c fiber.Ctx) error {
	id, _ := c.Locals(middleware.LocalUserID).(string)

	u, err := h.store.FindByID(c.Context(), id)
	switch {
	case err == nil:
	case errors.Is(err, user.ErrNotFound):
		// Token valid but row gone: class the session as expired (§4.5,
		// same mapping as Me).
		return httpx.Error(c, fiber.StatusUnauthorized,
			"token_expired", "Missing or invalid access token.")
	default:
		return err
	}

	if !u.IsActive {
		return httpx.Error(c, fiber.StatusForbidden,
			"account_inactive", "This account has been deactivated.")
	}

	if u.EmailVerifiedAt != nil {
		// openapi.md is the contract here: 204 even when already verified.
		// Issuing a token would be pure noise; the silent no-op keeps the
		// endpoint from leaking verification state (§6.21 rationale).
		return c.SendStatus(fiber.StatusNoContent)
	}

	// Issue inside deliverVerification invalidates the previous unused
	// token (§3.15), so at most one live invitation per account exists.
	h.deliverVerification(c.Context(), u)
	return c.SendStatus(fiber.StatusNoContent)
}

// Logout implements POST /auth/logout: revokes the current access token by
// adding its jti to the blocklist with the token's remaining TTL.
// Returns 204 on success. Requires authentication.
func (h *Handler) Logout(c fiber.Ctx) error {
	raw, ok := middleware.BearerTokenOf(c)
	if !ok {
		return httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"Missing or invalid access token.")
	}

	// Extract the token's jti and expiry for blocklist entry
	jti, err := h.manager.ExtractJTI(raw)
	if err != nil {
		return httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"Missing or invalid access token.")
	}

	expiresAt, err := h.manager.ExtractExpiry(raw)
	if err != nil {
		return httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"Missing or invalid access token.")
	}

	if time.Now().After(expiresAt) {
		return httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"The access token has expired.")
	}

	// Add to blocklist
	if h.bl != nil {
		if err := h.bl.Add(c.Context(), jti, expiresAt); err != nil {
			return httpx.Error(c, fiber.StatusInternalServerError, "internal_error",
				"Failed to revoke token.")
		}
	}

	return c.SendStatus(fiber.StatusNoContent)
}


// deliverVerification issues a fresh 24-hour single-use token (§3.5) and
// hands the matching mail to the configured transport. Failures are logged,
// never fatal: register and resend-verification answer 201/204 regardless of
// delivery (§6.21), and a logged breakage remains recoverable by resending.
func (h *Handler) deliverVerification(ctx context.Context, u *user.User) {
	raw, tok, err := authtoken.New(u.ID, authtoken.EmailVerification,
		time.Now().UTC(), authtoken.StandardTTL)
	if err != nil {
		log.Printf("auth: verification token for %s unavailable: %v", u.Email, err)
		return
	}
	if err := h.tokens.Issue(ctx, &tok); err != nil {
		log.Printf("auth: verification token for %s not stored: %v", u.Email, err)
		return
	}
	message := mailer.VerificationEmail(h.mailFrom, u.Email, u.DisplayName, h.verifyLink(raw))
	if err := h.mail.Send(ctx, message); err != nil {
		// §6.21: the endpoint answers regardless of the send, so a mail
		// outage surfaces here in the log — visible ops signal, recoverable.
		log.Printf("auth: verification mail to %s not delivered: %v", u.Email, err)
	}
}

// verifyLink assembles the frontend anchor that carries the raw token.
func (h *Handler) verifyLink(raw string) string {
	return strings.TrimSuffix(h.verifyBase, "/") + "?token=" + url.QueryEscape(raw)
}

// duplicateMessage renders the 409 message per duplicated field.
func duplicateMessage(field user.DuplicateField) string {
	if field == user.DuplicateEmail {
		return "Email is already registered."
	}
	return "Display name is already taken."
}

// decodeJSON parses the request body. Malformed or missing JSON renders the
// 400 main-action envelope (§4.4: malformed JSON is 400) and returns false.
//
// Unknown fields are ignored (standard JSON behaviour). §5.4's strictness is
// scoped to PATCH, which lands with the profile milestone.
func decodeJSON(c fiber.Ctx, into any) bool {
	body := c.Body()
	if len(body) == 0 {
		httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
		return false
	}
	if err := json.Unmarshal(body, into); err != nil {
		httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
		return false
	}
	return true
}
