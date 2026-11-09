package user

import (
	"errors"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/claim"
	"warta.com/api/internal/httpx"
	"warta.com/api/internal/middleware"
	"warta.com/api/internal/report"
	"warta.com/api/internal/verification"
)

// Handler holds the user profile endpoints' collaborators.
type Handler struct {
	store       Store
	reportStore report.Store
	claimStore  claim.Store
	voteStore   verification.Store
}

// Deps bundles NewHandler's collaborators.
type Deps struct {
	Store       Store
	ReportStore report.Store
	ClaimStore  claim.Store
	VoteStore   verification.Store
}

// NewHandler wires the collaborators behind every /users handler.
func NewHandler(d Deps) *Handler {
	return &Handler{
		store:       d.Store,
		reportStore: d.ReportStore,
		claimStore:  d.ClaimStore,
		voteStore:   d.VoteStore,
	}
}

// UserPrivateView is the private profile returned by /users/me and /auth/me.
// Only /auth/* and /users/me expose `email` (§13.1).
type UserPrivateView struct {
	ID              string   `json:"id"`
	DisplayName     string   `json:"display_name"`
	Email           string   `json:"email"`
	IsActive        bool     `json:"is_active"`
	EmailVerifiedAt *string  `json:"email_verified_at,omitempty"`
	CreatedAt       string   `json:"created_at"`
	UpdatedAt       string   `json:"updated_at"`
}

// UserPublicView is the public profile returned by GET /users/{user_id}
// (§7.4): id, display_name, is_active, created_at — and never email.
type UserPublicView struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	IsActive    bool   `json:"is_active"`
	CreatedAt   string `json:"created_at"`
}

// userPrivateView renders the UserPrivate shape of a user row.
func userPrivateView(u *User) UserPrivateView {
	return UserPrivateView{
		ID:              u.ID,
		DisplayName:     u.DisplayName,
		Email:           u.Email,
		IsActive:        u.IsActive,
		EmailVerifiedAt: nullableRFC3339(u.EmailVerifiedAt),
		CreatedAt:       u.CreatedAt.UTC().Format(http.TimeFormat),
		UpdatedAt:       u.UpdatedAt.UTC().Format(http.TimeFormat),
	}
}

// userPublicView renders the UserPublic shape of a user row. Timestamps
// follow the contract examples (§7.4): UTC RFC3339 — email is never present.
func userPublicView(u *User) UserPublicView {
	return UserPublicView{
		ID:          u.ID,
		DisplayName: u.DisplayName,
		IsActive:    u.IsActive,
		CreatedAt:   httpx.ISO8601(u.CreatedAt),
	}
}

// nullableRFC3339 renders optional timestamps, omitting null fields to keep
// the `data` object lean while staying schema-compatible (fields allow null).
func nullableRFC3339(t *time.Time) *string {
	if t == nil {
		return nil
	}
	s := t.UTC().Format(http.TimeFormat)
	return &s
}

// displayNameRe validates display_name: 3-24 chars, alphanum + underscore.
var displayNameRe = regexp.MustCompile(`^[a-zA-Z0-9_]{3,24}$`)

// UpdateMe implements PATCH /users/me: update the caller's display_name.
// Requires authentication. Body: { "display_name": "new_name" }.
func (h *Handler) UpdateMe(c fiber.Ctx) error {
	type req struct {
		DisplayName string `json:"display_name"`
	}
	var body req
	if err := c.Bind().Body(&body); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"The request body is not valid JSON.")
	}

	if body.DisplayName == "" {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"display_name is required.")
	}
	if !displayNameRe.MatchString(body.DisplayName) {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"display_name must be 3-24 characters: alphanumeric and underscore only.")
	}

	id, _ := c.Locals(middleware.LocalUserID).(string)
	u, err := h.store.UpdateDisplayName(c.Context(), id, body.DisplayName)
	switch {
	case err == nil:
		return c.JSON(fiber.Map{"data": userPrivateView(u)})
	case err == ErrNotFound:
		// Token valid but row gone: class the session as expired (§4.5,
		// same mapping as /auth/me).
		return httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"Missing or invalid access token.")
	case IsDuplicateDisplayName(err):
		return httpx.Error(c, fiber.StatusConflict, "conflict",
			"Display name is already taken.")
	default:
		return err
	}
}

// IsDuplicateDisplayName checks if an error is a DuplicateError for display_name.
func IsDuplicateDisplayName(err error) bool {
	var dup *DuplicateError
	return errors.As(err, &dup) && dup.Field == DuplicateDisplayName
}

// DeleteMe implements DELETE /users/me: deactivate the caller's account.
// Requires authentication. Returns 204 on success.
func (h *Handler) DeleteMe(c fiber.Ctx) error {
	id, _ := c.Locals(middleware.LocalUserID).(string)
	_, err := h.store.Deactivate(c.Context(), id)
	switch {
	case err == nil:
		return c.SendStatus(fiber.StatusNoContent)
	case err == ErrNotFound:
		// Token valid but row gone: class the session as expired (§4.5).
		return httpx.Error(c, fiber.StatusUnauthorized, "token_expired",
			"Missing or invalid access token.")
	default:
		return err
	}
}

// ListMyReports implements GET /users/me/reports (§ api-requirements table:
// "List reports authored by the caller"): the caller's reports, paginated,
// filterable by ?status. Requires auth.
func (h *Handler) ListMyReports(c fiber.Ctx) error {
	id, _ := c.Locals(middleware.LocalUserID).(string)

	filter := report.ListFilter{Page: atoi(c.Query("page")), Limit: atoi(c.Query("limit"))}
	if raw := c.Query("status"); raw != "" {
		status, ok := report.ParseStatus(raw)
		if !ok {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
				"Unknown report status.",
				httpx.FieldError{Field: "status", Message: "Must be one of draft, menunggu, terverifikasi, ditolak, selesai."})
		}
		filter.Status = &status
	}

	result, err := h.reportStore.ListByUser(c.Context(), id, filter)
	if err != nil {
		return err
	}
	views := make([]report.ReportView, 0, len(result.Data))
	for _, r := range result.Data {
		views = append(views, r.View())
	}
	// Empty pages still render [] rather than null (§3.3 collection shape).
	return c.JSON(fiber.Map{"data": views, "meta": result.Meta})
}

// ListMyClaims implements GET /users/me/claims: the caller's location
// claims, paginated, filterable by ?status. Requires auth.
func (h *Handler) ListMyClaims(c fiber.Ctx) error {
	id, _ := c.Locals(middleware.LocalUserID).(string)

	filter := claim.ListFilter{Page: atoi(c.Query("page")), Limit: atoi(c.Query("limit"))}
	if raw := c.Query("status"); raw != "" {
		status, ok := claim.ParseStatus(raw)
		if !ok {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
				"Unknown claim status.",
				httpx.FieldError{Field: "status", Message: "Must be one of menunggu, diterima, ditolak."})
		}
		filter.Status = &status
	}

	result, err := h.claimStore.ListByUser(c.Context(), id, filter)
	if err != nil {
		return err
	}
	views := make([]claim.ClaimView, 0, len(result.Data))
	for _, cl := range result.Data {
		views = append(views, cl.View())
	}
	return c.JSON(fiber.Map{"data": views, "meta": result.Meta})
}

// ListMyVotes implements GET /users/me/votes (§6.22): the caller's votes,
// newest first, each carrying the voted item's current resolution. Requires
// auth. The endpoint promises no ETag; outcomes can change between reads.
func (h *Handler) ListMyVotes(c fiber.Ctx) error {
	id, _ := c.Locals(middleware.LocalUserID).(string)

	filter := verification.ListFilter{Page: atoi(c.Query("page")), Limit: atoi(c.Query("limit"))}

	result, err := h.voteStore.ListByUser(c.Context(), id, filter)
	if err != nil {
		return err
	}
	views := make([]verification.MyVote, 0, len(result.Data))
	for _, v := range result.Data {
		views = append(views, v.View())
	}
	return c.JSON(fiber.Map{"data": views, "meta": result.Meta})
}

// GetPublicUser implements GET /users/{user_id} (§6.4): a public profile —
// id, display_name, is_active, created_at — with no email and no bearer
// requirement. Malformed UUIDs map to 400; unknown well-formed ones to 404
// (§10 UUID validation rule).
func (h *Handler) GetPublicUser(c fiber.Ctx) error {
	raw := c.Params("user_id")
	if _, err := uuid.Parse(raw); err != nil {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"user_id is not a valid UUID.")
	}

	u, err := h.store.FindByID(c.Context(), raw)
	switch {
	case err == nil:
		return httpx.Data(c, fiber.StatusOK, userPublicView(u))
	case err == ErrNotFound:
		return httpx.Error(c, fiber.StatusNotFound, "not_found",
			"User not found.")
	default:
		return err
	}
}

// atoi parses an optional pagination parameter. Empty or unparsable values
// fall back to 0, letting each store's clamp decide the real defaults
// (§10.4: clamp, never reject).
func atoi(raw string) int {
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return n
}
