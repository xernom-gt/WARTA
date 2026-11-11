package middleware

import (
	"context"

	"github.com/gofiber/fiber/v3"

	"warta.com/api/internal/httpx"
)

// UserRoleChecker checks whether a user has an active admin role.
type UserRoleChecker interface {
	CheckAdmin(ctx context.Context, userID string) (isActive bool, isAdmin bool, err error)
}

// RequireAdmin verifies that the authenticated user possesses the 'admin' role.
// Must be chained after Bearer middleware so LocalUserID is populated.
func RequireAdmin(checker UserRoleChecker) fiber.Handler {
	return func(c fiber.Ctx) error {
		userID, ok := c.Locals(LocalUserID).(string)
		if !ok || userID == "" {
			return httpx.Error(c, fiber.StatusUnauthorized, "token_expired", "Missing or invalid access token.")
		}

		isActive, isAdmin, err := checker.CheckAdmin(c.Context(), userID)
		if err != nil {
			return httpx.Error(c, fiber.StatusUnauthorized, "token_expired", "Missing or invalid access token.")
		}

		if !isActive {
			return httpx.Error(c, fiber.StatusForbidden, "account_inactive", "This account has been deactivated.")
		}

		if !isAdmin {
			return httpx.Error(c, fiber.StatusForbidden, "forbidden", "Akses ditolak: Operasi ini membutuhkan hak akses administrator dinas.")
		}

		return c.Next()
	}
}
