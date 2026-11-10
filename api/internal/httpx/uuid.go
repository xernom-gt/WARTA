package httpx

import (
	"fmt"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

// ValidateUUIDParam extracts and validates a path parameter as a valid UUID.
// If valid, it returns (val, true).
// If malformed, it sends a 400 Bad Request response with code 'validation_failed',
// and returns ("", false) so the caller can return nil (api-guidelines §2.4, §4.4, §10).
func ValidateUUIDParam(c fiber.Ctx, paramName string) (string, bool) {
	val := c.Params(paramName)
	if _, err := uuid.Parse(val); err != nil {
		_ = Error(c, fiber.StatusBadRequest, "validation_failed",
			fmt.Sprintf("%s must be a valid UUID.", paramName))
		return "", false
	}
	return val, true
}
