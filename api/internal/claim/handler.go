package claim

import (
	"encoding/json"
	"errors"
	"io"
	"strings"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/report"
)

// Handler serves HTTP endpoints for location claims.
type Handler struct {
	store   Store
	storage report.MediaStorage
}

// NewHandler creates a new Handler for location claims.
func NewHandler(store Store, storage ...report.MediaStorage) *Handler {
	var st report.MediaStorage
	if len(storage) > 0 && storage[0] != nil {
		st = storage[0]
	} else {
		st = report.NewMemoryMediaStorage("https://storage.warta.id")
	}
	return &Handler{
		store:   store,
		storage: st,
	}
}

// CreateClaim handles POST /projects/:project_id/location-claims (§6.16).
// Requires authenticated citizen.
func (h *Handler) CreateClaim(c fiber.Ctx) error {
	projectID, ok := httpx.ValidateUUIDParam(c, "project_id")
	if !ok {
		return nil
	}

	userID, _ := c.Locals(middleware.LocalUserID).(string)
	if userID == "" {
		return httpx.Error(c, fiber.StatusUnauthorized, "unauthorized", "authentication required")
	}

	var input CreateClaimInput
	if err := json.Unmarshal(c.Body(), &input); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed", "The request body is not valid JSON.")
	}

	vb := httpx.NewValidationBuilder()

	input.ProposedAddress = strings.TrimSpace(input.ProposedAddress)
	vb.AddIfEmpty("proposed_address", input.ProposedAddress)

	input.ProposedPrecision = strings.TrimSpace(input.ProposedPrecision)
	switch input.ProposedPrecision {
	case "titik", "alamat/ruas", "desa/kelurahan", "kecamatan", "kabupaten/kota":
		// valid
	default:
		vb.AddError("proposed_precision", "allowed values: titik, alamat/ruas, desa/kelurahan, kecamatan, kabupaten/kota")
	}

	input.Kecamatan = strings.TrimSpace(input.Kecamatan)
	vb.AddIfEmpty("kecamatan", input.Kecamatan)

	// Address line rule: required unless proposed_precision is kecamatan or desa/kelurahan
	if input.ProposedPrecision != "kecamatan" && input.ProposedPrecision != "desa/kelurahan" {
		var addrTrimmed string
		if input.AddressLine != nil {
			addrTrimmed = strings.TrimSpace(*input.AddressLine)
		}
		if addrTrimmed == "" {
			vb.AddError("address_line", "address_line is required unless proposed_precision is kecamatan or desa/kelurahan")
		}
	}

	// Latitude and longitude must both be present or both null
	vb.AddErrorIf(
		(input.Latitude == nil && input.Longitude != nil) || (input.Latitude != nil && input.Longitude == nil),
		"coordinates", "latitude and longitude must both be present or both be null")

	if vb.HasErrors() {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "One or more fields are invalid.", vb.Errors()...)
	}

	claim, err := h.store.Create(c.Context(), projectID, userID, input)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Project not found.")
		}
		if errors.Is(err, ErrProjectHasAcceptedClaim) {
			return httpx.Error(c, fiber.StatusConflict, "conflict", "Project already has an accepted location claim.")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to create location claim.")
	}

	c.Set("Location", "/api/v1/location-claims/"+claim.ID)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": claim.View()})
}

// GetClaim handles GET /location-claims/:claim_id.
func (h *Handler) GetClaim(c fiber.Ctx) error {
	claimID, ok := httpx.ValidateUUIDParam(c, "claim_id")
	if !ok {
		return nil
	}

	claim, err := h.store.GetByID(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Claim not found.")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to get location claim.")
	}

	return httpx.Data(c, fiber.StatusOK, claim.View())
}

// GetClaimMedia handles GET /location-claims/:claim_id/media.
func (h *Handler) GetClaimMedia(c fiber.Ctx) error {
	claimID, ok := httpx.ValidateUUIDParam(c, "claim_id")
	if !ok {
		return nil
	}

	media, err := h.store.GetMedia(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrMediaNotFound) {
			// Return empty array if no media attached yet
			return httpx.Data(c, fiber.StatusOK, []MediaView{})
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to get claim media.")
	}

	return httpx.Data(c, fiber.StatusOK, []MediaView{media.View()})
}

// UploadClaimMedia handles POST /location-claims/:claim_id/media (§6.18, §11.2).
// One-photo rule and max 5MB. Author only.
func (h *Handler) UploadClaimMedia(c fiber.Ctx) error {
	claimID, ok := httpx.ValidateUUIDParam(c, "claim_id")
	if !ok {
		return nil
	}

	userID, _ := c.Locals(middleware.LocalUserID).(string)
	claim, err := h.store.GetByID(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Claim not found.")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to check claim.")
	}

	if claim.UserID != userID {
		return httpx.Error(c, fiber.StatusForbidden, "forbidden", "Only the author can upload media.")
	}

	fileHeader, err := c.FormFile("file")
	if err != nil || fileHeader == nil {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "Validation failed.", httpx.FieldError{
			Field:   "file",
			Message: "file is required.",
		})
	}

	// 5 MB limit (§11.2)
	if fileHeader.Size > report.MaxPhotoBytes {
		return httpx.Error(c, fiber.StatusRequestEntityTooLarge, "file_too_large", "Files must be 5 MB or smaller.")
	}

	f, err := fileHeader.Open()
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	data, err := io.ReadAll(io.LimitReader(f, report.MaxPhotoBytes+1))
	if err != nil {
		return err
	}
	if int64(len(data)) > report.MaxPhotoBytes {
		return httpx.Error(c, fiber.StatusRequestEntityTooLarge, "file_too_large", "Files must be 5 MB or smaller.")
	}

	mimeType, ext, ok := report.DetectImageMIME(data)
	if !ok {
		return httpx.Error(c, fiber.StatusUnsupportedMediaType, "unsupported_media_type", "Only image/jpeg, image/png, and image/webp are accepted.")
	}

	exifMeta := report.ExtractEXIF(data)
	var isGeotagValid *bool
	if claim.Latitude != nil && claim.Longitude != nil {
		isGeotagValid = report.EvaluateGeotag(exifMeta, claim.Latitude, claim.Longitude)
	} else {
		isGeotagValid = report.EvaluateGeotag(exifMeta, nil, nil)
	}

	mediaID := uuid.NewString()
	key := "claims/" + claimID + "/" + mediaID + ext
	fileURL, err := h.storage.Put(c.Context(), key, mimeType, data)
	if err != nil {
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to store media.")
	}

	media := &Media{
		ID:            mediaID,
		ClaimID:       claimID,
		FileURL:       fileURL,
		MediaType:     mimeType,
		ExifLatitude:  exifMeta.Latitude,
		ExifLongitude: exifMeta.Longitude,
		ExifTakenAt:   exifMeta.TakenAt,
		IsGeotagValid: isGeotagValid,
		CreatedAt:     time.Now().UTC(),
	}

	createdMedia, err := h.store.AddMedia(c.Context(), claimID, media)
	if err != nil {
		_ = h.storage.Delete(c.Context(), fileURL)
		if errors.Is(err, ErrPhotoLimitExceeded) {
			return httpx.Error(c, fiber.StatusConflict, "photo_limit_reached", "Maximum of 1 photo per location claim reached.")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to attach media.")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": createdMedia.View()})
}

// DeleteClaimMedia handles DELETE /location-claims/:claim_id/media/:media_id.
// Author only, only allowed when claim is in menunggu status.
func (h *Handler) DeleteClaimMedia(c fiber.Ctx) error {
	claimID, ok := httpx.ValidateUUIDParam(c, "claim_id")
	if !ok {
		return nil
	}
	mediaID, ok := httpx.ValidateUUIDParam(c, "media_id")
	if !ok {
		return nil
	}

	userID, _ := c.Locals(middleware.LocalUserID).(string)
	claim, err := h.store.GetByID(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Claim not found.")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to check claim.")
	}

	if claim.UserID != userID {
		return httpx.Error(c, fiber.StatusForbidden, "forbidden", "Only the author can delete media.")
	}

	if claim.Status != StatusMenunggu {
		return httpx.Error(c, fiber.StatusConflict, "conflict", "Photo can only be deleted while claim is pending review.")
	}

	media, err := h.store.GetMedia(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrMediaNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Photo not found.")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to check media.")
	}
	if media.ID != mediaID {
		return httpx.Error(c, fiber.StatusNotFound, "not_found", "Photo not found.")
	}

	if err := h.store.DeleteMedia(c.Context(), claimID, mediaID); err != nil {
		if errors.Is(err, ErrMediaNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "Photo not found.")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "Failed to delete media.")
	}

	if h.storage != nil {
		_ = h.storage.Delete(c.Context(), media.FileURL)
	}

	return c.SendStatus(fiber.StatusNoContent)
}
