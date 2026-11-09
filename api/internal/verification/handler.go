package verification

import (
	"errors"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
)

// Handler serves HTTP endpoints for the verification queue and votes.
type Handler struct {
	queueStore QueueStore
	voteStore  Store
}

// NewHandler builds a new Handler for verification items and votes.
func NewHandler(queueStore QueueStore, voteStore Store) *Handler {
	return &Handler{
		queueStore: queueStore,
		voteStore:  voteStore,
	}
}

// ListQueue handles GET /verification-items (§5.5, §10.2).
// Supports filters by status, item_type, project_id. Default sort: created_at ASC.
func (h *Handler) ListQueue(c fiber.Ctx) error {
	var filter QueueFilter

	if rawStatus := strings.TrimSpace(c.Query("status")); rawStatus != "" {
		st, ok := ParseItemStatus(rawStatus)
		if !ok {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "status is invalid", httpx.FieldError{
				Field:   "status",
				Message: "allowed values: menunggu, terverifikasi, ditolak, diterima",
			})
		}
		filter.Status = &st
	}

	if rawType := strings.TrimSpace(c.Query("item_type")); rawType != "" {
		it, ok := ParseItemType(rawType)
		if !ok {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "item_type is invalid", httpx.FieldError{
				Field:   "item_type",
				Message: "allowed values: laporan_kondisi, klaim_lokasi",
			})
		}
		filter.ItemType = &it
	}

	if rawProjectID := strings.TrimSpace(c.Query("project_id")); rawProjectID != "" {
		if _, err := uuid.Parse(rawProjectID); err != nil {
			return httpx.Error(c, fiber.StatusBadRequest, "invalid_uuid", "project_id must be a valid UUID", httpx.FieldError{
				Field:   "project_id",
				Message: "must be a valid UUID",
			})
		}
		filter.ProjectID = rawProjectID
	}

	if rawPage := strings.TrimSpace(c.Query("page")); rawPage != "" {
		p, err := strconv.Atoi(rawPage)
		if err != nil || p < 1 {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "page must be a positive integer", httpx.FieldError{
				Field:   "page",
				Message: "must be >= 1",
			})
		}
		filter.Page = p
	}

	if rawLimit := strings.TrimSpace(c.Query("limit")); rawLimit != "" {
		l, err := strconv.Atoi(rawLimit)
		if err != nil || l < 1 {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "limit must be a positive integer", httpx.FieldError{
				Field:   "limit",
				Message: "must be >= 1",
			})
		}
		filter.Limit = l
	}

	res, err := h.queueStore.ListQueue(c.Context(), filter)
	if err != nil {
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to list verification queue")
	}

	return c.JSON(fiber.Map{
		"data": res.Data,
		"meta": res.Meta,
	})
}

// GetItem handles GET /verification-items/:item_id (§5.5, §7.3).
func (h *Handler) GetItem(c fiber.Ctx) error {
	itemID := c.Params("item_id")
	if _, err := uuid.Parse(itemID); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "invalid_uuid", "invalid item_id format")
	}

	item, err := h.queueStore.GetItemByID(c.Context(), itemID)
	if err != nil {
		if errors.Is(err, ErrItemNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "item_not_found", "verification item not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to get verification item")
	}

	return httpx.Data(c, fiber.StatusOK, item.View())
}
