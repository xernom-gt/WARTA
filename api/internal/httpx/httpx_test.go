package httpx

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gofiber/fiber/v3"
)

func TestClampPagination(t *testing.T) {
	tests := []struct {
		name          string
		inPage        int
		inLimit       int
		expectedPage  int
		expectedLimit int
	}{
		{"defaults on zeros", 0, 0, 1, 20},
		{"defaults on negatives", -5, -10, 1, 20},
		{"clamps high limit to 100", 2, 500, 2, 100},
		{"preserves valid values", 3, 50, 3, 50},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, l := ClampPagination(tt.inPage, tt.inLimit)
			if p != tt.expectedPage || l != tt.expectedLimit {
				t.Errorf("ClampPagination(%d, %d) = (%d, %d); expected (%d, %d)",
					tt.inPage, tt.inLimit, p, l, tt.expectedPage, tt.expectedLimit)
			}
		})
	}
}

func TestNewMeta(t *testing.T) {
	m := NewMeta(1, 20, 45)
	if !m.HasNext {
		t.Errorf("expected HasNext true for page 1 of 45 items with limit 20")
	}
	if m.Total != 45 || m.Page != 1 || m.Limit != 20 {
		t.Errorf("unexpected meta values: %+v", m)
	}

	mLast := NewMeta(3, 20, 45)
	if mLast.HasNext {
		t.Errorf("expected HasNext false for page 3 of 45 items with limit 20")
	}
}

func TestParseSort(t *testing.T) {
	allowed := []string{"created_at", "title", "pagu_amount"}

	// 1. Empty raw -> defaults
	s1, err := ParseSort("", "created_at", true, allowed...)
	if err != nil || s1.Field != "created_at" || !s1.Desc {
		t.Fatalf("expected default -created_at, got %+v (err: %v)", s1, err)
	}

	// 2. Ascending
	s2, err := ParseSort("title", "created_at", true, allowed...)
	if err != nil || s2.Field != "title" || s2.Desc {
		t.Fatalf("expected title asc, got %+v (err: %v)", s2, err)
	}

	// 3. Descending
	s3, err := ParseSort("-pagu_amount", "created_at", true, allowed...)
	if err != nil || s3.Field != "pagu_amount" || !s3.Desc {
		t.Fatalf("expected -pagu_amount desc, got %+v (err: %v)", s3, err)
	}

	// 4. Invalid field
	_, err4 := ParseSort("unknown_column", "created_at", true, allowed...)
	if err4 == nil {
		t.Fatalf("expected error for unknown_column")
	}
	if err4.Field != "sort" {
		t.Errorf("expected field 'sort', got %s", err4.Field)
	}
}

func TestValidateUUIDParam(t *testing.T) {
	app := fiber.New()
	app.Get("/test/:item_id", func(c fiber.Ctx) error {
		id, ok := ValidateUUIDParam(c, "item_id")
		if !ok {
			return nil
		}
		return c.SendString("ok:" + id)
	})

	// 1. Valid UUID
	req1 := httptest.NewRequest(http.MethodGet, "/test/00000000-0000-0000-0000-000000000001", nil)
	resp1, err := app.Test(req1)
	if err != nil || resp1.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d (%v)", resp1.StatusCode, err)
	}

	// 2. Malformed UUID -> 400 Bad Request with validation_failed
	req2 := httptest.NewRequest(http.MethodGet, "/test/not-a-valid-uuid", nil)
	resp2, err := app.Test(req2)
	if err != nil || resp2.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d (%v)", resp2.StatusCode, err)
	}
	body, _ := io.ReadAll(resp2.Body)
	var errEnvelope struct {
		Error struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}
	_ = json.Unmarshal(body, &errEnvelope)
	if errEnvelope.Error.Code != "validation_failed" {
		t.Errorf("expected error code 'validation_failed', got %s", errEnvelope.Error.Code)
	}
}
