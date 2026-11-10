package claim

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
)

// Handler serves HTTP endpoints for location claims.
type Handler struct {
	store Store
}

// NewHandler creates a new Handler for location claims.
func NewHandler(store Store) *Handler {
	return &Handler{store: store}
}

// CreateClaim handles POST /projects/:project_id/location-claims (§6.16).
// Requires authenticated citizen.
func (h *Handler) CreateClaim(c fiber.Ctx) error {
	projectID := c.Params("project_id")
	if _, err := uuid.Parse(projectID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "invalid_uuid", "invalid project_id format")
	}

	userID, _ := c.Locals(middleware.LocalUserID).(string)
	if userID == "" {
		return httpx.Error(c, fiber.StatusUnauthorized, "unauthorized", "authentication required")
	}

	var input CreateClaimInput
	if err := json.Unmarshal(c.Body(), &input); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "invalid_json", "failed to parse request body")
	}

	var fieldErrors []httpx.FieldError

	input.ProposedAddress = strings.TrimSpace(input.ProposedAddress)
	if input.ProposedAddress == "" {
		fieldErrors = append(fieldErrors, httpx.FieldError{
			Field:   "proposed_address",
			Message: "proposed_address is required",
		})
	}

	input.ProposedPrecision = strings.TrimSpace(input.ProposedPrecision)
	switch input.ProposedPrecision {
	case "titik", "alamat/ruas", "desa/kelurahan", "kecamatan", "kabupaten/kota":
		// valid
	default:
		fieldErrors = append(fieldErrors, httpx.FieldError{
			Field:   "proposed_precision",
			Message: "allowed values: titik, alamat/ruas, desa/kelurahan, kecamatan, kabupaten/kota",
		})
	}

	input.Kecamatan = strings.TrimSpace(input.Kecamatan)
	if input.Kecamatan == "" {
		fieldErrors = append(fieldErrors, httpx.FieldError{
			Field:   "kecamatan",
			Message: "kecamatan is required",
		})
	}

	// Address line rule: required unless proposed_precision is kecamatan or desa/kelurahan
	if input.ProposedPrecision != "kecamatan" && input.ProposedPrecision != "desa/kelurahan" {
		if input.AddressLine == nil || strings.TrimSpace(*input.AddressLine) == "" {
			fieldErrors = append(fieldErrors, httpx.FieldError{
				Field:   "address_line",
				Message: "address_line is required unless proposed_precision is kecamatan or desa/kelurahan",
			})
		}
	}

	// Latitude and longitude must both be present or both null
	if (input.Latitude == nil && input.Longitude != nil) || (input.Latitude != nil && input.Longitude == nil) {
		fieldErrors = append(fieldErrors, httpx.FieldError{
			Field:   "coordinates",
			Message: "latitude and longitude must both be present or both be null",
		})
	}

	if len(fieldErrors) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "validation failed", fieldErrors...)
	}

	claim, err := h.store.Create(c.Context(), projectID, userID, input)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "project_not_found", "project not found")
		}
		if errors.Is(err, ErrProjectHasAcceptedClaim) {
			return httpx.Error(c, fiber.StatusConflict, "claim_already_accepted", "project already has an accepted location claim")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to create location claim")
	}

	c.Set("Location", "/api/v1/location-claims/"+claim.ID)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": claim.View()})
}

// GetClaim handles GET /location-claims/:claim_id.
func (h *Handler) GetClaim(c fiber.Ctx) error {
	claimID := c.Params("claim_id")
	if _, err := uuid.Parse(claimID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "invalid_uuid", "invalid claim_id format")
	}

	claim, err := h.store.GetByID(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "claim_not_found", "location claim not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to get location claim")
	}

	return httpx.Data(c, fiber.StatusOK, claim.View())
}

// GetClaimMedia handles GET /location-claims/:claim_id/media.
func (h *Handler) GetClaimMedia(c fiber.Ctx) error {
	claimID := c.Params("claim_id")
	if _, err := uuid.Parse(claimID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "invalid_uuid", "invalid claim_id format")
	}

	media, err := h.store.GetMedia(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrMediaNotFound) {
			// Return empty array if no media attached yet
			return httpx.Data(c, fiber.StatusOK, []MediaView{})
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to get claim media")
	}

	return httpx.Data(c, fiber.StatusOK, []MediaView{media.View()})
}

// UploadClaimMedia handles POST /location-claims/:claim_id/media.
// One-photo rule and max 5MB. Author only.
func (h *Handler) UploadClaimMedia(c fiber.Ctx) error {
	claimID := c.Params("claim_id")
	if _, err := uuid.Parse(claimID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "invalid_uuid", "invalid claim_id format")
	}

	userID, _ := c.Locals(middleware.LocalUserID).(string)
	claim, err := h.store.GetByID(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "claim_not_found", "location claim not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to check claim")
	}

	if claim.UserID != userID {
		return httpx.Error(c, fiber.StatusForbidden, "forbidden", "only the author can upload media")
	}

	fileHeader, err := c.FormFile("file")
	if err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "missing_file", "file is required")
	}

	// 5 MB limit
	if fileHeader.Size > 5*1024*1024 {
		return httpx.Error(c, fiber.StatusRequestEntityTooLarge, "file_too_large", "photo exceeds 5 MB limit")
	}

	contentType := fileHeader.Header.Get("Content-Type")
	if contentType == "" || contentType == "application/octet-stream" {
		lowerName := strings.ToLower(fileHeader.Filename)
		if strings.HasSuffix(lowerName, ".jpg") || strings.HasSuffix(lowerName, ".jpeg") {
			contentType = "image/jpeg"
		} else if strings.HasSuffix(lowerName, ".png") {
			contentType = "image/png"
		} else if strings.HasSuffix(lowerName, ".webp") {
			contentType = "image/webp"
		}
	}
	switch contentType {
	case "image/jpeg", "image/png", "image/webp":
		// valid image
	default:
		return httpx.Error(c, fiber.StatusUnsupportedMediaType, "unsupported_media_type", "only JPEG, PNG, and WebP are supported")
	}

	// Simulated storage URL
	fileURL := "https://storage.warta.id/claims/" + claimID + "/" + fileHeader.Filename
	media := &Media{
		FileURL:   fileURL,
		MediaType: contentType,
	}

	createdMedia, err := h.store.AddMedia(c.Context(), claimID, media)
	if err != nil {
		if errors.Is(err, ErrPhotoLimitExceeded) {
			return httpx.Error(c, fiber.StatusConflict, "photo_limit_exceeded", "a claim may have at most one photo")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to attach media")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": createdMedia.View()})
}

// DeleteClaimMedia handles DELETE /location-claims/:claim_id/media/:media_id.
// Author only, only allowed when claim is in menunggu status.
func (h *Handler) DeleteClaimMedia(c fiber.Ctx) error {
	claimID := c.Params("claim_id")
	mediaID := c.Params("media_id")

	userID, _ := c.Locals(middleware.LocalUserID).(string)
	claim, err := h.store.GetByID(c.Context(), claimID)
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "claim_not_found", "location claim not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to check claim")
	}

	if claim.UserID != userID {
		return httpx.Error(c, fiber.StatusForbidden, "forbidden", "only the author can delete media")
	}

	if claim.Status != StatusMenunggu {
		return httpx.Error(c, fiber.StatusConflict, "invalid_claim_state", "photo can only be deleted while claim is menunggu")
	}

	if err := h.store.DeleteMedia(c.Context(), claimID, mediaID); err != nil {
		if errors.Is(err, ErrMediaNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "media_not_found", "photo not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to delete media")
	}

	return c.SendStatus(fiber.StatusNoContent)
}
