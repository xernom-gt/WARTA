package verification

import (
	"encoding/json"
	"errors"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
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
			return httpx.Error(c, fiber.StatusBadRequest, "validation_failed", "project_id must be a valid UUID", httpx.FieldError{
				Field:   "project_id",
				Message: "must be a valid UUID",
			})
		}
		filter.ProjectID = rawProjectID
	}

	page, limit := httpx.ParsePagination(c)
	filter.Page = page
	filter.Limit = limit

	res, err := h.queueStore.ListQueue(c.Context(), filter)
	if err != nil {
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to list verification queue")
	}

	return httpx.EnvelopeETag(c, fiber.Map{
		"data": res.Data,
		"meta": res.Meta,
	})
}

// GetItem handles GET /verification-items/:item_id (§5.5, §7.3).
func (h *Handler) GetItem(c fiber.Ctx) error {
	itemID, ok := httpx.ValidateUUIDParam(c, "item_id")
	if !ok {
		return nil
	}

	item, err := h.queueStore.GetItemByID(c.Context(), itemID)
	if err != nil {
		if errors.Is(err, ErrItemNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "verification item not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to get verification item")
	}

	return httpx.DataETag(c, item.View())
}

// ListVotes handles GET /verification-items/:item_id/votes (§5.5, openapi VoteListResponse).
func (h *Handler) ListVotes(c fiber.Ctx) error {
	itemID, ok := httpx.ValidateUUIDParam(c, "item_id")
	if !ok {
		return nil
	}

	page, limit := httpx.ParsePagination(c)
	filter := ListFilter{
		Page:  page,
		Limit: limit,
	}

	res, err := h.voteStore.ListByItem(c.Context(), itemID, filter)
	if err != nil {
		if errors.Is(err, ErrItemNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "verification item not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to list votes")
	}

	return c.JSON(fiber.Map{
		"data": res.Data,
		"meta": res.Meta,
	})
}

// CastVoteRequest carries payload for POST /verification-items/:item_id/votes.
type CastVoteRequest struct {
	Choice string `json:"choice"`
}

// CastVote handles POST /verification-items/:item_id/votes (§6.17).
// Requires authenticated citizen.
func (h *Handler) CastVote(c fiber.Ctx) error {
	itemID, ok := httpx.ValidateUUIDParam(c, "item_id")
	if !ok {
		return nil
	}

	userID, _ := c.Locals(middleware.LocalUserID).(string)
	if userID == "" {
		return httpx.Error(c, fiber.StatusUnauthorized, "unauthorized", "authentication required")
	}

	var req CastVoteRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request", "failed to parse request body")
	}

	choice, ok := ParseVoteChoice(strings.TrimSpace(req.Choice))
	if !ok {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "invalid vote choice", httpx.FieldError{
			Field:   "choice",
			Message: "allowed values: setuju, tidak_setuju",
		})
	}

	vote, err := h.voteStore.CastVote(c.Context(), itemID, userID, choice)
	if err != nil {
		if errors.Is(err, ErrItemNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "verification item not found")
		}
		if errors.Is(err, ErrSelfVote) {
			return httpx.Error(c, fiber.StatusForbidden, "self_vote_forbidden", "authors cannot vote on their own content")
		}
		if errors.Is(err, ErrDuplicateVote) {
			return httpx.Error(c, fiber.StatusConflict, "already_voted", "citizen has already voted on this item")
		}
		if errors.Is(err, ErrItemResolved) {
			return httpx.Error(c, fiber.StatusConflict, "item_resolved", "verification item is already resolved")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to cast vote")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"data": vote})
}

// UpdateFollowUpRequest carries the payload for PATCH /verification-items/:id/follow-up.
type UpdateFollowUpRequest struct {
	AdminStatus string  `json:"admin_status"`
	AdminNote   *string `json:"admin_note"`
}

// UpdateFollowUp handles PATCH /verification-items/:id/follow-up (admin only).
func (h *Handler) UpdateFollowUp(c fiber.Ctx) error {
	itemID, ok := httpx.ValidateUUIDParam(c, "id")
	if !ok {
		return nil
	}

	var req UpdateFollowUpRequest
	if err := json.Unmarshal(c.Body(), &req); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "bad_request", "failed to parse request body")
	}

	status := strings.TrimSpace(req.AdminStatus)
	if status == "" {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed", "admin_status is required", httpx.FieldError{
			Field:   "admin_status",
			Message: "admin_status is required (e.g. diproses, selesai, ditolak)",
		})
	}

	item, err := h.queueStore.UpdateFollowUp(c.Context(), itemID, status, req.AdminNote)
	if err != nil {
		if errors.Is(err, ErrItemNotFound) {
			return httpx.Error(c, fiber.StatusNotFound, "not_found", "verification item not found")
		}
		return httpx.Error(c, fiber.StatusInternalServerError, "internal_error", "failed to update follow up")
	}

	return httpx.Data(c, fiber.StatusOK, item.View())
}
