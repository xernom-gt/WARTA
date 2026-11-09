package evidence

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
	"warta.com/api/internal/report"
)

// ErrCallerNotFound indicates the bearer token's user ID does not exist.
var ErrCallerNotFound = errors.New("evidence: caller not found")

// Caller holds the authenticated account state.
type Caller struct {
	ID            string
	DisplayName   string
	IsActive      bool
	EmailVerified bool
}

// CallerLookup resolves an authenticated user ID.
type CallerLookup func(ctx context.Context, userID string) (*Caller, error)

// ReportLookup checks if the parent report is readable.
type ReportLookup func(ctx context.Context, reportID string, callerID string) (bool, error)

// Handler serves evidence endpoints (§6.18, §6.19).
type Handler struct {
	store        Store
	caller       CallerLookup
	storage      report.MediaStorage
	canReadReport ReportLookup
}

// Deps bundles collaborator dependencies for NewHandler.
type Deps struct {
	Store        Store
	CallerLookup CallerLookup
	Storage      report.MediaStorage
	ReportLookup ReportLookup
}

// NewHandler wires an evidence Handler.
func NewHandler(d Deps) *Handler {
	st := d.Storage
	if st == nil {
		st = report.NewMemoryMediaStorage("https://storage.warta.id")
	}
	return &Handler{
		store:        d.Store,
		caller:       d.CallerLookup,
		storage:      st,
		canReadReport: d.ReportLookup,
	}
}

type createEvidenceRequest struct {
	Description string `json:"description"`
}

// ListByReport implements GET /reports/{report_id}/evidences (§5.3).
func (h *Handler) ListByReport(c fiber.Ctx) error {
	reportID := c.Params("report_id")
	if _, err := uuid.Parse(reportID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"report_id must be a valid UUID.")
	}

	if h.canReadReport != nil {
		callerID, _ := c.Locals(middleware.LocalUserID).(string)
		ok, err := h.canReadReport(c.Context(), reportID, callerID)
		if err != nil || !ok {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
		}
	}

	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))

	res, err := h.store.ListByReport(c.Context(), reportID, ListFilter{Page: page, Limit: limit})
	switch {
	case err == nil:
		views := make([]EvidenceView, 0, len(res.Data))
		for _, ev := range res.Data {
			views = append(views, ev.View())
		}
		return c.Status(fiber.StatusOK).JSON(fiber.Map{
			"data": views,
			"meta": res.Meta,
		})
	case errors.Is(err, ErrReportNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	default:
		return err
	}
}

// Create implements POST /reports/{report_id}/evidences (§6.18).
// Any authenticated citizen may add evidence. Does NOT create a verification item.
func (h *Handler) Create(c fiber.Ctx) error {
	reportID := c.Params("report_id")
	if _, err := uuid.Parse(reportID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"report_id must be a valid UUID.")
	}

	caller, err := h.authorizeWriter(c)
	if err != nil || caller == nil {
		return err
	}

	if h.canReadReport != nil {
		ok, err := h.canReadReport(c.Context(), reportID, caller.ID)
		if err != nil || !ok {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
		}
	}

	raw := c.Body()
	if len(raw) == 0 {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
	}
	var req createEvidenceRequest
	if err := json.Unmarshal(raw, &req); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request",
			"The request body is not valid JSON.")
	}

	desc := strings.TrimSpace(req.Description)
	descLen := utf8.RuneCountInString(desc)
	if descLen < MinDescLen || descLen > MaxDescLen {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"Validation failed.", httpx.FieldError{
				Field:   "description",
				Message: "Description is required and must be between 1 and 2000 characters.",
			})
	}

	now := time.Now().UTC()
	created, err := h.store.Create(c.Context(), &Evidence{
		ReportID:          reportID,
		UserID:            caller.ID,
		AuthorDisplayName: caller.DisplayName,
		Description:       desc,
		CreatedAt:         now,
		UpdatedAt:         now,
	})
	switch {
	case err == nil:
		c.Set("Location", "/api/v1/evidences/"+created.ID)
		return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": created.View()})
	case errors.Is(err, ErrReportNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Report not found.")
	default:
		return err
	}
}

// Get implements GET /evidences/{evidence_id} (§5.3).
func (h *Handler) Get(c fiber.Ctx) error {
	evidenceID := c.Params("evidence_id")
	if _, err := uuid.Parse(evidenceID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"evidence_id must be a valid UUID.")
	}

	ev, err := h.store.FindByID(c.Context(), evidenceID)
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence not found.")
	case err != nil:
		return err
	}

	if h.canReadReport != nil {
		callerID, _ := c.Locals(middleware.LocalUserID).(string)
		ok, err := h.canReadReport(c.Context(), ev.ReportID, callerID)
		if err != nil || !ok {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence not found.")
		}
	}

	return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": ev.View()})
}

// ListMedia implements GET /evidences/{evidence_id}/media (§5.3).
func (h *Handler) ListMedia(c fiber.Ctx) error {
	evidenceID := c.Params("evidence_id")
	if _, err := uuid.Parse(evidenceID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"evidence_id must be a valid UUID.")
	}

	ev, err := h.store.FindByID(c.Context(), evidenceID)
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence not found.")
	case err != nil:
		return err
	}

	if h.canReadReport != nil {
		callerID, _ := c.Locals(middleware.LocalUserID).(string)
		ok, err := h.canReadReport(c.Context(), ev.ReportID, callerID)
		if err != nil || !ok {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence not found.")
		}
	}

	media, err := h.store.ListMedia(c.Context(), evidenceID)
	if err != nil {
		return err
	}
	views := make([]MediaView, 0, len(media))
	for _, m := range media {
		views = append(views, m.View())
	}
	return c.Status(fiber.StatusOK).JSON(fiber.Map{"data": views})
}

// UploadMedia implements POST /evidences/{evidence_id}/media (§6.19, §11.2).
// Author-only. Max 8 photos per evidence entry, 5MB per file.
func (h *Handler) UploadMedia(c fiber.Ctx) error {
	evidenceID := c.Params("evidence_id")
	if _, err := uuid.Parse(evidenceID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"evidence_id must be a valid UUID.")
	}

	caller, err := h.authorizeWriter(c)
	if err != nil || caller == nil {
		return err
	}

	ev, err := h.store.FindByID(c.Context(), evidenceID)
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence not found.")
	case err != nil:
		return err
	}

	if ev.UserID != caller.ID {
		return httpx.Error(c, fiber.StatusForbidden, "forbidden",
			"Only the evidence author can upload photos to this evidence.")
	}

	if len(ev.Media) >= MaxEvidencePhotos {
		return httpx.Error(c, fiber.StatusConflict, "photo_limit_reached",
			"Maximum of 8 photos per evidence reached.")
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

	mimeType, ext, ok := report.DetectImageMIME(data)
	if !ok {
		return httpx.Error(c, fiber.StatusUnsupportedMediaType, "unsupported_media_type",
			"Only image/jpeg, image/png, and image/webp are accepted.")
	}

	exifMeta := report.ExtractEXIF(data)
	mediaID := uuid.NewString()
	key := "evidences/" + ev.ID + "/" + mediaID + ext
	fileURL, err := h.storage.Put(c.Context(), key, mimeType, data)
	if err != nil {
		return err
	}

	created, err := h.store.CreateMedia(c.Context(), ev.ID, &Media{
		ID:            mediaID,
		EvidenceID:    ev.ID,
		FileURL:       fileURL,
		MediaType:     mimeType,
		ExifLatitude:  exifMeta.Latitude,
		ExifLongitude: exifMeta.Longitude,
		ExifTakenAt:   exifMeta.TakenAt,
		CreatedAt:     time.Now().UTC(),
	})
	if err != nil {
		_ = h.storage.Delete(c.Context(), fileURL)
		switch {
		case errors.Is(err, ErrPhotoLimitReached):
			return httpx.Error(c, fiber.StatusConflict, "photo_limit_reached",
				"Maximum of 8 photos per evidence reached.")
		case errors.Is(err, ErrNotFound):
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence not found.")
		default:
			return err
		}
	}

	c.Set("Location", "/api/v1/evidences/"+ev.ID+"/media/"+created.ID)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": created.View()})
}

// DeleteMedia implements DELETE /evidences/{evidence_id}/media/{media_id} (§6.19).
// Author-only. Allowed only before the parent report has reached consensus.
func (h *Handler) DeleteMedia(c fiber.Ctx) error {
	evidenceID := c.Params("evidence_id")
	if _, err := uuid.Parse(evidenceID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"evidence_id must be a valid UUID.")
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

	ev, err := h.store.FindByID(c.Context(), evidenceID)
	switch {
	case errors.Is(err, ErrNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence not found.")
	case err != nil:
		return err
	}

	if ev.UserID != caller.ID {
		return httpx.Error(c, fiber.StatusForbidden, "forbidden",
			"Only the evidence author can delete photos from this evidence.")
	}

	fileURL, err := h.store.DeleteMedia(c.Context(), ev.ID, mediaID)
	switch {
	case err == nil:
		_ = h.storage.Delete(c.Context(), fileURL)
		return c.SendStatus(fiber.StatusNoContent)
	case errors.Is(err, ErrNotFound), errors.Is(err, ErrMediaNotFound):
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Evidence photo not found.")
	case errors.Is(err, ErrDeleteLocked):
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Evidence photos cannot be deleted after the report has reached a consensus verdict.")
	default:
		return err
	}
}

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
