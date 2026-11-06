package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/token"
)

// LocalUserID is the Locals key carrying the authenticated citizen's ID.
const LocalUserID = "warta.user_id"

// Bearer requires and verifies the Authorization: Bearer <jwt> header
// (api-requirements §3.1). Tokens are never accepted from anywhere else
// (api-guidelines §5.2).
//
// Error mapping: the catalogue defines token_expired as the 401 auth code,
// and the OpenAPI Unauthorized example pins it for the entire
// "missing, expired, or invalid token" family, so every bearer failure
// surfaces as 401 token_expired with a message stating the precise reason.
// invalid_credentials is never used here; it belongs to the login flow
// alone (§9.3).
func Bearer(tm *token.Manager) fiber.Handler {
	return func(c fiber.Ctx) error {
		raw, ok := bearerTokenOf(c)
		if !ok {
			return unauthorized(c, "Missing or invalid access token.")
		}

		userID, err := tm.Verify(raw)
		switch {
		case err == nil:
			c.Locals(LocalUserID, userID)
			return c.Next()
		case err == token.ErrExpired:
			return unauthorized(c, "The access token has expired.")
		default:
			return unauthorized(c, "Missing or invalid access token.")
		}
	}
}

// bearerTokenOf extracts the token after a case-insensitive Bearer scheme
// token per RFC 7235 (auth-scheme tokens are case-insensitive).
func bearerTokenOf(c fiber.Ctx) (string, bool) {
	header := c.Get(fiber.HeaderAuthorization)
	scheme, tokenValue, found := strings.Cut(header, " ")
	if !found || !strings.EqualFold(scheme, "Bearer") {
		return "", false
	}
	tokenValue = strings.TrimSpace(tokenValue)
	if tokenValue == "" {
		return "", false
	}
	return tokenValue, true
}

// unauthorized renders the 401 envelope with WWW-Authenticate semantics kept
// minimal (no WWW-Authenticate attributes; the contract defines none).
func unauthorized(c fiber.Ctx, message string) error {
	return httpx.Error(c, fiber.StatusUnauthorized, "token_expired", message)
}
