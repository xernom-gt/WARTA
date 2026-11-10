package httpx

import (
	"strconv"

	"github.com/gofiber/fiber/v3"
)

// DefaultPage is the initial page index per api-guidelines §3.3.
const DefaultPage = 1

// DefaultLimit is the standard page size (20 items) per api-guidelines §3.3.
const DefaultLimit = 20

// MaxLimit is the maximum page size allowed (100 items) per api-guidelines §3.3.
const MaxLimit = 100

// Meta represents the standard envelope meta object for paginated collections
// (api-guidelines §3.2, §3.3).
type Meta struct {
	Page    int  `json:"page"`
	Limit   int  `json:"limit"`
	Total   int  `json:"total"`
	HasNext bool `json:"has_next"`
}

// NewMeta constructs a Meta object, calculating has_next accurately.
func NewMeta(page, limit, total int) Meta {
	page, limit = ClampPagination(page, limit)
	return Meta{
		Page:    page,
		Limit:   limit,
		Total:   total,
		HasNext: (page * limit) < total,
	}
}

// ClampPagination enforces api-guidelines §3.3:
// - Default limit is 20; max is 100.
// - Limits above 100 are clamped, NEVER rejected.
// - Limits below 1 default to 20.
// - Page numbers below 1 clamp to 1.
func ClampPagination(page, limit int) (int, int) {
	if page < 1 {
		page = DefaultPage
	}
	if limit <= 0 {
		limit = DefaultLimit
	} else if limit > MaxLimit {
		limit = MaxLimit
	}
	return page, limit
}

// ParsePagination extracts and clamps ?page and ?limit from the HTTP request query.
func ParsePagination(c fiber.Ctx) (int, int) {
	p, _ := strconv.Atoi(c.Query("page"))
	l, _ := strconv.Atoi(c.Query("limit"))
	return ClampPagination(p, l)
}
