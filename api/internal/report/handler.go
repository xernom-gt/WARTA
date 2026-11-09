package report

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"strconv"
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

// Handler serves the report CRUD, submission, and media endpoints (§6.11-6.15).
type Handler struct {
	store   Store
	caller  CallerLookup
	storage MediaStorage
}

// Deps bundles the collaborators for NewHandler.
type Deps struct {
	Store        Store
	CallerLookup CallerLookup
	Storage      MediaStorage
}

// NewHandler wires a report Handler.
func NewHandler(d Deps) *Handler {
	st := d.Storage
	if st == nil {
		st = NewMemoryMediaStorage("https://storage.warta.id")
	}
	return &Handler{
		store:   d.Store,
		caller:  d.CallerLookup,
		storage: st,
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

type updateReportRequest struct {
	Category        *string  `json:"category"`
	Narrative       *string  `json:"narrative"`
	ProposedAddress *string  `json:"proposed_address"`
	Latitude        *float64 `json:"latitude"`
	Longitude       *float64 `json:"longitude"`
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

// Get implements GET /reports/{report_id} (§5.3, §7.1).
// Submitted reports are public; drafts are visible only to their active author
// and return 404 to everyone else (§9.3).
func (h *Handler) Get(c fiber.Ctx) error {
	reportID := c.Params("report_id")
	if _, err := uuid.Parse(reportID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"report_id must be a valid UUID.")
	}

	r, err := h.store.FindByID(c.Context(), reportID)
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	case err != nil:
		return err
	}

	if !h.canReadReport(c, r) {
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": r.View()})
}

// ListMedia implements GET /reports/{report_id}/media (§5.3, §7.1).
func (h *Handler) ListMedia(c fiber.Ctx) error {
	reportID := c.Params("report_id")
	if _, err := uuid.Parse(reportID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"report_id must be a valid UUID.")
	}

	r, err := h.store.FindByID(c.Context(), reportID)
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	case err != nil:
		return err
	}

	if !h.canReadReport(c, r) {
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": r.View().Media})
}

// UploadMedia implements POST /reports/{report_id}/media (§6.15, §11.1-11.4).
func (h *Handler) UploadMedia(c fiber.Ctx) error {
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
			"Only the report author can upload photos to this report.")
	}
	if r.Status != StatusDraft && r.Status != StatusMenunggu {
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Cannot upload photos to a resolved report.")
	}
	if len(r.Media) >= MaxReportPhotos {
		return httpx.Error(c, fiber.StatusConflict, "photo_limit_reached",
			"Maximum of 4 photos per report reached.")
	}

	var requestedSlot *int
	if rawSort := strings.TrimSpace(c.FormValue("sort_order")); rawSort != "" {
		slot, convErr := strconv.Atoi(rawSort)
		if convErr != nil || slot < 0 || slot >= MaxReportPhotos {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
				"Validation failed.", httpx.FieldError{
					Field:   "sort_order",
					Message: "sort_order must be an integer between 0 and 3.",
				})
		}
		requestedSlot = &slot
	}

	fh, err := c.FormFile("file")
	if err != nil || fh == nil {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"Validation failed.", httpx.FieldError{
				Field:   "file",
				Message: "file is required.",
			})
	}
	if fh.Size > MaxPhotoBytes {
		return httpx.Error(c, fiber.StatusRequestEntityTooLarge, "file_too_large",
			"Files must be 5 MB or smaller.")
	}

	f, err := fh.Open()
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	data, err := io.ReadAll(io.LimitReader(f, MaxPhotoBytes+1))
	if err != nil {
		return err
	}
	if len(data) > MaxPhotoBytes {
		return httpx.Error(c, fiber.StatusRequestEntityTooLarge, "file_too_large",
			"Files must be 5 MB or smaller.")
	}

	mimeType, ext, ok := DetectImageMIME(data)
	if !ok {
		return httpx.Error(c, fiber.StatusUnsupportedMediaType, "unsupported_media_type",
			"Only image/jpeg, image/png, and image/webp are accepted.")
	}

	exifMeta := ExtractEXIF(data)
	isGeotagValid := EvaluateGeotag(exifMeta, r.Latitude, r.Longitude)

	mediaID := uuid.NewString()
	key := "reports/" + r.ID + "/" + mediaID + ext
	fileURL, err := h.storage.Put(c.Context(), key, mimeType, data)
	if err != nil {
		return err
	}

	created, err := h.store.CreateMedia(c.Context(), r.ID, &Media{
		ID:            mediaID,
		ReportID:      r.ID,
		FileURL:       fileURL,
		MediaType:     mimeType,
		ExifLatitude:  exifMeta.Latitude,
		ExifLongitude: exifMeta.Longitude,
		ExifTakenAt:   exifMeta.TakenAt,
		IsGeotagValid: isGeotagValid,
		CreatedAt:     time.Now().UTC(),
	}, requestedSlot)
	if err != nil {
		_ = h.storage.Delete(c.Context(), fileURL)
		switch {
		case errors.Is(err, ErrPhotoLimitReached):
			return httpx.Error(c, fiber.StatusConflict, "photo_limit_reached",
				"Maximum of 4 photos per report reached.")
		case errors.Is(err, ErrSortOrderTaken):
			return httpx.Error(c, fiber.StatusConflict, "conflict",
				"The requested sort_order is already in use.")
		case errors.Is(err, ErrNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
		default:
			return err
		}
	}

	c.Set("Location", "/api/v1/reports/"+r.ID+"/media/"+created.ID)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": created.View()})
}

// DeleteMedia implements DELETE /reports/{report_id}/media/{media_id} (§6.19).
func (h *Handler) DeleteMedia(c fiber.Ctx) error {
	reportID := c.Params("report_id")
	if _, err := uuid.Parse(reportID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"report_id must be a valid UUID.")
	}
	mediaID := c.Params("media_id")
	if _, err := uuid.Parse(mediaID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"media_id must be a valid UUID.")
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
			"Only the report author can delete photos from this report.")
	}

	fileURL, err := h.store.DeleteMedia(c.Context(), r.ID, mediaID)
	switch {
	case err == nil:
		_ = h.storage.Delete(c.Context(), fileURL)
		return c.SendStatus(fiber.StatusNoContent)
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrMediaNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report photo not found.")
	case errors.Is(err, ErrNotDraft):
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Report photos can only be deleted while the report is a draft.")
	default:
		return err
	}
}

func (h *Handler) canReadReport(c fiber.Ctx, r *Report) bool {
	if r.Status != StatusDraft {
		return true
	}
	callerID, _ := c.Locals(middleware.LocalUserID).(string)
	if callerID == "" || callerID != r.UserID {
		return false
	}
	if h.caller != nil {
		caller, err := h.caller(c.Context(), callerID)
		if err != nil || caller == nil || !caller.IsActive {
			return false
		}
	}
	return true
}

// Update implements PATCH /reports/{report_id} (§6.13).
func (h *Handler) Update(c fiber.Ctx) error {
	reportID := c.Params("report_id")
	if _, err := uuid.Parse(reportID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"report_id must be a valid UUID.")
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
	var rawFields map[string]json.RawMessage
	if err := json.Unmarshal(raw, &rawFields); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
	}
	var req updateReportRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
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
			"Only the report author can update this report.")
	}
	if r.Status != StatusDraft {
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Only draft reports can be updated.")
	}

	patch, details := buildDraftPatch(r, rawFields, req)
	if len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"Validation failed.", details...)
	}

	updated, err := h.store.UpdateDraft(c.Context(), r.ID, patch)
	switch {
	case err == nil:
		return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": updated.View()})
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	case errors.Is(err, ErrNotDraft):
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Only draft reports can be updated.")
	default:
		return err
	}
}

// Delete implements DELETE /reports/{report_id} (§6.14).
func (h *Handler) Delete(c fiber.Ctx) error {
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
			"Only the report author can delete this report.")
	}

	err = h.store.Delete(c.Context(), r.ID, time.Now().UTC())
	switch {
	case err == nil:
		return c.SendStatus(fiber.StatusNoContent)
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	case errors.Is(err, ErrDeleteLocked):
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Reports with a consensus verdict cannot be deleted.")
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
// has verified their email address before creating or modifying content (§3.4, §3.5).
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

func buildDraftPatch(existing *Report, rawFields map[string]json.RawMessage, req updateReportRequest) (DraftPatch, []httpx.FieldError) {
	var details []httpx.FieldError
	patch := DraftPatch{UpdatedAt: time.Now().UTC()}

	if _, hasCategory := rawFields["category"]; hasCategory {
		patch.SetCategory = true
		if req.Category != nil && strings.TrimSpace(*req.Category) != "" {
			parsed, ok := ParseCategory(*req.Category)
			if !ok {
				details = append(details, httpx.FieldError{
					Field:   "category",
					Message: "Category must be one of: belum_mulai, lambat_mangkrak, fisik_rusak, papan_tidak_ada, selesai.",
				})
			} else {
				patch.Category = &parsed
			}
		}
	}

	if _, hasNarrative := rawFields["narrative"]; hasNarrative {
		patch.SetNarrative = true
		if req.Narrative == nil {
			details = append(details, httpx.FieldError{
				Field:   "narrative",
				Message: "Narrative is required and must be at most 500 characters.",
			})
		} else {
			nLen := utf8.RuneCountInString(strings.TrimSpace(*req.Narrative))
			if nLen < 1 || nLen > 500 {
				details = append(details, httpx.FieldError{
					Field:   "narrative",
					Message: "Narrative is required and must be at most 500 characters.",
				})
			} else {
				patch.Narrative = *req.Narrative
			}
		}
	}

	if _, hasAddr := rawFields["proposed_address"]; hasAddr {
		patch.SetProposedAddress = true
		if req.ProposedAddress != nil && strings.TrimSpace(*req.ProposedAddress) != "" {
			trimmed := *req.ProposedAddress
			if utf8.RuneCountInString(trimmed) > 500 {
				details = append(details, httpx.FieldError{
					Field:   "proposed_address",
					Message: "Proposed address must be at most 500 characters.",
				})
			} else {
				patch.ProposedAddress = &trimmed
			}
		}
	}

	_, hasLat := rawFields["latitude"]
	_, hasLng := rawFields["longitude"]
	if hasLat || hasLng {
		patch.SetCoordinates = true
		lat := existing.Latitude
		lng := existing.Longitude
		if hasLat {
			lat = req.Latitude
		}
		if hasLng {
			lng = req.Longitude
		}
		coordErrs := validateCoords(lat, lng)
		if len(coordErrs) > 0 {
			details = append(details, coordErrs...)
		} else {
			patch.Latitude = lat
			patch.Longitude = lng
		}
	}

	return patch, details
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
