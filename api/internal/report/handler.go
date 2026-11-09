package report

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
)

// ErrCallerNotFound indicates the bearer token's user ID does not exist.
var ErrCallerNotFound = errors.New("report: caller not found")

// Caller holds the account state required by content-write authorization (§3.4, §3.5).
type Caller struct {
	ID            string
	DisplayName   string
	IsActive      bool
	EmailVerified bool
}

// CallerLookup resolves an authenticated user ID to its Caller state, returning
// ErrCallerNotFound when the account row is absent.
type CallerLookup func(ctx context.Context, userID string) (*Caller, error)

// Handler serves the report creation and submission endpoints (§6.11, §6.12).
type Handler struct {
	store  Store
	caller CallerLookup
}

// Deps bundles the collaborators for NewHandler.
type Deps struct {
	Store        Store
	CallerLookup CallerLookup
}

// NewHandler wires a report Handler.
func NewHandler(d Deps) *Handler {
	return &Handler{
		store:  d.Store,
		caller: d.CallerLookup,
	}
}

type createReportRequest struct {
	Category        *string  `json:"category"`
	Narrative       string   `json:"narrative"`
	ProposedAddress *string  `json:"proposed_address"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
	ExifStatus      *string  `json:"exif_status"`
	ExifNotice      *string  `json:"exif_notice"`
	Submit          bool     `json:"submit"`
}

// Create implements POST /projects/{project_id}/reports (§6.11).
func (h *Handler) Create(c fiber.Ctx) error {
	projectID := c.Params("project_id")
	if _, err := uuid.Parse(projectID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"project_id must be a valid UUID.")
	}

	caller, err := h.authorizeWriter(c)
	if err != nil || caller == nil {
		return err
	}

	raw := c.Body()
	if len(raw) == 0 {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
	}
	var req createReportRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
	}

	details, category, proposedAddr, exifStatus := validateCreateRequest(req)
	if len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"Validation failed.", details...)
	}

	now := time.Now().UTC()
	status := StatusDraft
	var submittedAt *time.Time
	if req.Submit {
		status = StatusMenunggu
		submittedAt = &now
	}

	r := &Report{
		ProjectID:         projectID,
		UserID:            caller.ID,
		AuthorDisplayName: caller.DisplayName,
		Category:          category,
		Narrative:         req.Narrative,
		ProposedAddress:   proposedAddr,
		Latitude:          req.Latitude,
		Longitude:         req.Longitude,
		ExifStatus:        exifStatus,
		ExifNotice:        req.ExifNotice,
		Status:            status,
		CreatedAt:         now,
		UpdatedAt:         now,
		SubmittedAt:       submittedAt,
	}

	created, err := h.store.Create(c.Context(), r, req.Submit)
	switch {
	case err == nil:
		c.Set("Location", "/api/v1/reports/"+created.ID)
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": created.View()})
	case errors.Is(err, ErrProjectNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Project not found.")
	default:
		return err
	}
}

// Submit implements POST /reports/{report_id}/submit (§6.12).
func (h *Handler) Submit(c fiber.Ctx) error {
	reportID := c.Params("report_id")
	if _, err := uuid.Parse(reportID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"report_id must be a valid UUID.")
	}

	caller, err := h.authorizeWriter(c)
	if err != nil || caller == nil {
		return err
	}

	r, err := h.store.FindByID(c.Context(), reportID)
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	case err != nil:
		return err
	}

	if r.UserID != caller.ID {
		return httpx.Error(c, fiber.StatusForbidden, "forbidden",
			"Only the report author can submit this report.")
	}
	if r.Status != StatusDraft {
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Only draft reports can be submitted.")
	}

	if details := validateSubmitState(r); len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"Report is missing required fields for submission.", details...)
	}

	submitted, err := h.store.Submit(c.Context(), r.ID, time.Now().UTC())
	switch {
	case err == nil:
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": submitted.View()})
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	case errors.Is(err, ErrNotDraft):
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Only draft reports can be submitted.")
	default:
		return err
	}
}

// authorizeWriter verifies that the authenticated user exists, is active, and
// has verified their email address before creating or submitting content (§3.4, §3.5).
func (h *Handler) authorizeWriter(c fiber.Ctx) (*Caller, error) {
	userID, _ := c.Locals(middleware.LocalUserID).(string)
	if userID == "" || h.caller == nil {
		_ = httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"Missing or invalid access token.")
		return nil, nil
	}

	caller, err := h.caller(c.Context(), userID)
	if errors.Is(err, ErrCallerNotFound) {
		_ = httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"Missing or invalid access token.")
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if !caller.IsActive {
		_ = httpx.Error(c, fiber.StatusForbidden, "account_inactive",
			"This account has been deactivated.")
		return nil, nil
	}
	if !caller.EmailVerified {
		_ = httpx.Error(c, fiber.StatusForbidden, "email_not_verified",
			"Verify your email address before creating content.")
		return nil, nil
	}
	return caller, nil
}

func validateCreateRequest(req createReportRequest) ([]httpx.FieldError, *string, *string, string) {
	var details []httpx.FieldError

	var category *string
	if req.Category != nil && strings.TrimSpace(*req.Category) != "" {
		parsed, ok := ParseCategory(*req.Category)
		if !ok {
			details = append(details, httpx.FieldError{
				Field:   "category",
				Message: "Category must be one of: belum_mulai, lambat_mangkrak, fisik_rusak, papan_tidak_ada, selesai.",
			})
		} else {
			category = &parsed
		}
	} else if req.Submit {
		details = append(details, httpx.FieldError{
			Field:   "category",
			Message: "Category is required when submitting a report.",
		})
	}

	narrativeLen := utf8.RuneCountInString(strings.TrimSpace(req.Narrative))
	if req.Submit {
		if narrativeLen < 20 || narrativeLen > 500 {
			details = append(details, httpx.FieldError{
				Field:   "narrative",
				Message: "Narrative must be between 20 and 500 characters when submitting.",
			})
		}
	} else {
		if narrativeLen < 1 || narrativeLen > 500 {
			details = append(details, httpx.FieldError{
				Field:   "narrative",
				Message: "Narrative is required and must be at most 500 characters.",
			})
		}
	}

	var proposedAddr *string
	if req.ProposedAddress != nil && strings.TrimSpace(*req.ProposedAddress) != "" {
		trimmed := *req.ProposedAddress
		if utf8.RuneCountInString(trimmed) > 500 {
			details = append(details, httpx.FieldError{
				Field:   "proposed_address",
				Message: "Proposed address must be at most 500 characters.",
			})
		} else {
			proposedAddr = &trimmed
		}
	} else if req.Submit {
		details = append(details, httpx.FieldError{
			Field:   "proposed_address",
			Message: "Proposed address is required when submitting a report.",
		})
	}

	details = append(details, validateCoords(req.Latitude, req.Longitude)...)

	exifStatus := ExifMissing
	if req.ExifStatus != nil && *req.ExifStatus != "" {
		parsed, ok := ParseExifStatus(*req.ExifStatus)
		if !ok {
			details = append(details, httpx.FieldError{
				Field:   "exif_status",
				Message: "exif_status must be one of: valid, invalid, missing.",
			})
		} else {
			exifStatus = parsed
		}
	}

	return details, category, proposedAddr, exifStatus
}

func validateSubmitState(r *Report) []httpx.FieldError {
	var details []httpx.FieldError

	if r.Category == nil || strings.TrimSpace(*r.Category) == "" {
		details = append(details, httpx.FieldError{
			Field:   "category",
			Message: "Category is required before submitting.",
		})
	} else if _, ok := ParseCategory(*r.Category); !ok {
		details = append(details, httpx.FieldError{
			Field:   "category",
			Message: "Category must be one of: belum_mulai, lambat_mangkrak, fisik_rusak, papan_tidak_ada, selesai.",
		})
	}

	narrativeLen := utf8.RuneCountInString(strings.TrimSpace(r.Narrative))
	if narrativeLen < 20 || narrativeLen > 500 {
		details = append(details, httpx.FieldError{
			Field:   "narrative",
			Message: "Narrative must be between 20 and 500 characters.",
		})
	}

	if r.ProposedAddress == nil || strings.TrimSpace(*r.ProposedAddress) == "" {
		details = append(details, httpx.FieldError{
			Field:   "proposed_address",
			Message: "Proposed address is required before submitting.",
		})
	} else if utf8.RuneCountInString(*r.ProposedAddress) > 500 {
		details = append(details, httpx.FieldError{
			Field:   "proposed_address",
			Message: "Proposed address must be at most 500 characters.",
		})
	}

	details = append(details, validateCoords(r.Latitude, r.Longitude)...)

	if len(r.Media) < 1 {
		details = append(details, httpx.FieldError{
			Field:   "media",
			Message: "At least one report photo is required before submitting.",
		})
	}

	return details
}

func validateCoords(lat, lng *float64) []httpx.FieldError {
	if (lat == nil) != (lng == nil) {
		return []httpx.FieldError{{
			Field:   "latitude",
			Message: "Latitude and longitude must both be present or both be null.",
		}}
	}
	if lat == nil {
		return nil
	}
	var details []httpx.FieldError
	if *lat < -90 || *lat > 90 {
		details = append(details, httpx.FieldError{
			Field:   "latitude",
			Message: "Latitude must be between -90 and 90.",
		})
	}
	if *lng < -180 || *lng > 180 {
		details = append(details, httpx.FieldError{
			Field:   "longitude",
			Message: "Longitude must be between -180 and 180.",
		})
	}
	return details
}
