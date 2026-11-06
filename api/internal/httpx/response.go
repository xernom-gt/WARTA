// Package httpx writes API responses in the exact envelope shape required by
// docs/api/api-guidelines.md §3.2 (success) and §4.1 (errors).
package httpx

import "github.com/gofiber/fiber/v3"

// FieldError is one entry of the error envelope details[] list (§4.3).
type FieldError struct {
	Field   string `json:"field"`
	Message string `json:"message"`
}

// Data sends a success response wrapped in the top-level "data" envelope.
func Data(c fiber.Ctx, status int, payload any) error {
	return c.Status(status).JSON(fiber.Map{"data": payload})
}

// Error sends an error response in the "error" envelope. Extra details are
// only included when provided, so non-validation errors stay small (§4.1).
func Error(c fiber.Ctx, status int, code, message string, details ...FieldError) error {
	err := fiber.Map{
		"code":    code,
		"message": message,
	}
	if len(details) > 0 {
		err["details"] = details
	}
	return c.Status(status).JSON(fiber.Map{"error": err})
}
