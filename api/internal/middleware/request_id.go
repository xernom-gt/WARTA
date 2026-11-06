// Package middleware hosts cross-cutting Fiber middlewares: request ID
// correlation (api-guidelines §4.8), per-IP rate limiting (§13.4), and bearer
// JWT authentication (§5.2).
package middleware

import (
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// HeaderRequestID is the correlation header used on every exchange (§2.8).
const HeaderRequestID = "X-Request-Id"

const localsRequestID = "warta.request_id"

// RequestID propagates a client-supplied X-Request-Id or generates one, and
// stores it for logging and error rendering. Header values are normalised:
// length-capped to 64, restricted to safe characters, and never trusted raw,
// so a hostile header cannot smuggle response-splitting bytes.
func RequestID() fiber.Handler {
	return func(c fiber.Ctx) error {
		id := strings.TrimSpace(c.Get(HeaderRequestID))
		if !validRequestID(id) {
			id = uuid.NewString()
		}
		c.Locals(localsRequestID, id)
		c.Set(HeaderRequestID, id)
		return c.Next()
	}
}

// RequestIDOf reads the correlating request ID of the in-flight request.
func RequestIDOf(c fiber.Ctx) string {
	if id, ok := c.Locals(localsRequestID).(string); ok {
		return id
	}
	return ""
}

// validRequestID bounds the reuse so attackers cannot set silly or unsafe
// values; anything rejected simply becomes a generated UUID.
func validRequestID(id string) bool {
	if id == "" || len(id) > 64 {
		return false
	}
	for _, r := range id {
		switch {
		case r >= '0' && r <= '9', r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z',
			r == '-', r == '_', r == '.':
		default:
			return false
		}
	}
	return true
}
