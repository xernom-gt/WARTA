package httpx

import (
	"errors"
)

// NotFoundErr checks if err matches target and returns true. Use with
// errors.Is(err, domainNotFound) patterns in handlers.
//
//	if NotFoundErr(err, report.ErrNotFound) {
//		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
//	}
func NotFoundErr(err, target error) bool {
	return errors.Is(err, target)
}

// ConflictErr checks if err matches target (e.g., ErrAlreadyVerified).
//
//	if ConflictErr(err, user.ErrAlreadyVerified) {
//		return httpx.Error(c, fiber.StatusConflict, "already_verified", "Email already verified.")
//	}
func ConflictErr(err, target error) bool {
	return errors.Is(err, target)
}

// UnauthorizedErr checks if err matches target (e.g., auth failures).
//
//	if UnauthorizedErr(err, auth.ErrInvalidPassword) {
//		return httpx.Error(c, fiber.StatusUnauthorized, "invalid_credentials", "...")
//	}
func UnauthorizedErr(err, target error) bool {
	return errors.Is(err, target)
}
