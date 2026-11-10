package httpx

import (
	"fmt"
	"strings"
)

// SortOrder represents normalized sort direction (api-guidelines §2.5).
type SortOrder struct {
	Field string
	Desc  bool
}

// ParseSort parses the sort query parameter according to api-guidelines §2.5:
// - A leading '-' indicates descending order (e.g. "-created_at").
// - Without leading '-', order is ascending (e.g. "title").
// - If raw is empty, defaultField and defaultDesc are returned.
// - If allowedFields are specified and raw field is not allowed, a FieldError is returned.
func ParseSort(raw string, defaultField string, defaultDesc bool, allowedFields ...string) (SortOrder, *FieldError) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return SortOrder{Field: defaultField, Desc: defaultDesc}, nil
	}

	desc := false
	field := raw
	if strings.HasPrefix(raw, "-") {
		desc = true
		field = strings.TrimPrefix(raw, "-")
	}

	if len(allowedFields) > 0 {
		allowed := false
		for _, f := range allowedFields {
			if field == f {
				allowed = true
				break
			}
		}
		if !allowed {
			return SortOrder{}, &FieldError{
				Field:   "sort",
				Message: fmt.Sprintf("Invalid sort field '%s'. Allowed fields: %s", field, strings.Join(allowedFields, ", ")),
			}
		}
	}

	return SortOrder{Field: field, Desc: desc}, nil
}
