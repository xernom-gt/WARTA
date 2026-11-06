package auth

import (
	"encoding/json"
	"errors"
	"time"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/password"
	"warta.com/api/internal/token"
	"warta.com/api/internal/user"
)

// Handler holds the auth endpoints' collaborators.
type Handler struct {
	store   user.Store
	manager *token.Manager
}

// NewHandler wires a user store and a token manager into the handlers.
func NewHandler(store user.Store, manager *token.Manager) *Handler {
	return &Handler{store: store, manager: manager}
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
// hashed password, then hand back the private profile. Email verification
// delivery is still pending as its own task (§6.20-6.21 depends on the
// auth_tokens migration); until then the account is simply unverified,
// matching the schema default of a NULL email_verified_at.
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
