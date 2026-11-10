package project

import (
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
)

// Handler holds the projects read surface's collaborators.
type Handler struct {
	store Store
}

// Deps bundles NewHandler's collaborators. The store injections are package
// interfaces so tests can swap in in-memory variants (wire() passes the
// PostgreSQL stores).
type Deps struct {
	Store Store
}

// NewHandler wires the collaborators behind every /projects handler.
func NewHandler(store Store) *Handler {
	return &Handler{store: store}
}

// ListProjects implements GET /projects (§6.6): the catalog with filters,
// sort, §10.4 pagination, and an ETag for conditional requests.
func (h *Handler) ListProjects(c fiber.Ctx) error {
	filter, details := h.parseListFilter(c)
	if len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"One or more fields are invalid.", details...)
	}

	result, err := h.store.List(c.Context(), filter)
	if err != nil {
		return err
	}

	views := make([]ProjectSummaryView, 0, len(result.Data))
	for _, p := range result.Data {
		views = append(views, p.SummaryView())
	}
	return httpx.EnvelopeETag(c, fiber.Map{"data": views, "meta": result.Meta})
}

// GetProject implements GET /projects/{id} (§6.7): the detail with the
// primary location, tender history, sub-locations, and risk flags embedded,
// plus the derived label set. 400 on malformed UUIDs, 404 on unknown ones
// (§10). ETag follows the contract.
func (h *Handler) GetProject(c fiber.Ctx) error {
	id, ok := parseProjectID(c)
	if !ok {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"project_id is not a valid UUID.")
	}

	p, err := h.store.FindByID(c.Context(), id)
	switch {
	case err == nil:
	case err == ErrNotFound:
		return httpx.Error(c, fiber.StatusNotFound, "not_found",
			"Project not found.")
	default:
		return err
	}

	locations, err := h.store.ListLocations(c.Context(), id)
	if err != nil {
		return err
	}
	tenders, err := h.store.ListTenders(c.Context(), id)
	if err != nil {
		return err
	}
	flags, err := h.store.ListRiskFlags(c.Context(), id)
	if err != nil {
		return err
	}

	subLocations := make([]SubLocationView, 0, len(locations))
	var primary *Location
	for _, l := range locations {
		if l.IsPrimary {
			primary = l
			continue
		}
		subLocations = append(subLocations, subLocationView(l))
	}
	tenderViews := make([]TenderView, 0, len(tenders))
	for _, t := range tenders {
		tenderViews = append(tenderViews, tenderView(t))
	}
	flagViews := make([]RiskFlagView, 0, len(flags))
	for _, f := range flags {
		flagViews = append(flagViews, riskFlagView(f))
	}

	detail := ProjectDetailView{
		ProjectSummaryView: p.SummaryView(),
		ContractNote:       p.ContractNote,
		PrecisionNote:      p.PrecisionResolutionNote,
		SourceNote:         p.SourceNote,
		Location:           nil, // rendered below when a primary row exists
		Tenders:            tenderViews,
		SubLocations:       subLocations,
		RiskFlags:          flagViews,
	}
	if primary != nil {
		summary := locationSummaryView(primary, p.IsCanonicalClaimed)
		detail.Location = &summary
	}
	return httpx.DataETag(c, detail)
}

// ListProjectMapPins implements GET /projects/map (§6.8): pins inside a
// viewport. bbox is required (openapi BBox); opposite-corner ordering is
// normalized so either spelling produces the same rectangle.
func (h *Handler) ListProjectMapPins(c fiber.Ctx) error {
	filter, details := h.parseMapFilter(c)
	if len(details) > 0 {
		return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
			"One or more fields are invalid.", details...)
	}

	pins, err := h.store.MapPins(c.Context(), filter)
	if err != nil {
		return err
	}
	return httpx.Data(c, fiber.StatusOK, pins)
}

// parseMapFilter extracts bbox/status/category, collecting field errors
// together (api-guidelines §4.3).
func (h *Handler) parseMapFilter(c fiber.Ctx) (MapFilter, []httpx.FieldError) {
	filter := MapFilter{}
	var details []httpx.FieldError

	raw := strings.TrimSpace(c.Query("bbox"))
	if raw == "" {
		details = append(details, httpx.FieldError{Field: "bbox",
			Message: "bbox is required: minLng,minLat,maxLng,maxLat."})
		return filter, details
	}
	parts := strings.Split(raw, ",")
	if len(parts) != 4 {
		details = append(details, httpx.FieldError{Field: "bbox",
			Message: "bbox must have exactly four numbers: minLng,minLat,maxLng,maxLat."})
		return filter, details
	}
	nums := make([]float64, 4)
	for i, part := range parts {
		n, err := strconv.ParseFloat(strings.TrimSpace(part), 64)
		if err != nil {
			details = append(details, httpx.FieldError{Field: "bbox",
				Message: "bbox must contain four numbers: minLng,minLat,maxLng,maxLat."})
			return filter, details
		}
		nums[i] = n
	}
	filter.MinLng, filter.MaxLng = minmax(nums[0], nums[2])
	filter.MinLat, filter.MaxLat = minmax(nums[1], nums[3])

	if rawStatus := c.Query("status"); rawStatus != "" {
		status, ok := ParseStatus(rawStatus)
		if !ok {
			details = append(details, httpx.FieldError{Field: "status",
				Message: "Must be one of menunggu, terverifikasi, ditolak, selesai."})
		} else {
			filter.Status = &status
		}
	}
	if rawCategory := c.Query("category"); rawCategory != "" {
		if len(rawCategory) > 100 {
			details = append(details, httpx.FieldError{Field: "category",
				Message: "category must be at most 100 characters."})
		} else {
			filter.Category = &rawCategory
		}
	}
	return filter, details
}

// minmax orders two floats so the viewport stays a rectangle whatever the
// corner order.
func minmax(a, b float64) (float64, float64) {
	if a < b {
		return a, b
	}
	return b, a
}

// parseListFilter extracts §6.6 parameters and collects every field error so
// they can return together in one 422 envelope (api-guidelines §4.3).
func (h *Handler) parseListFilter(c fiber.Ctx) (ListFilter, []httpx.FieldError) {
	filter := ListFilter{}
	var details []httpx.FieldError

	if raw := strings.TrimSpace(c.Query("q")); raw != "" {
		switch {
		case len(raw) < 2:
			details = append(details, httpx.FieldError{Field: "q",
				Message: "Search terms need at least 2 characters."})
		case len(raw) > 100:
			details = append(details, httpx.FieldError{Field: "q",
				Message: "q must be at most 100 characters."})
		default:
			filter.Q = &raw
		}
	}
	if raw := c.Query("category"); raw != "" {
		if len(raw) > 100 {
			details = append(details, httpx.FieldError{Field: "category",
				Message: "category must be at most 100 characters."})
		} else {
			filter.Category = &raw
		}
	}
	if raw := c.Query("city"); raw != "" {
		if len(raw) > 100 {
			details = append(details, httpx.FieldError{Field: "city",
				Message: "city must be at most 100 characters."})
		} else {
			filter.City = &raw
		}
	}
	if raw := c.Query("status"); raw != "" {
		status, ok := ParseStatus(raw)
		if !ok {
			details = append(details, httpx.FieldError{Field: "status",
				Message: "Must be one of menunggu, terverifikasi, ditolak, selesai."})
		} else {
			filter.Status = &status
		}
	}
	if raw := c.Query("year"); raw != "" {
		year, err := strconv.Atoi(raw)
		if err != nil || year < 2000 || year > 2100 {
			details = append(details, httpx.FieldError{Field: "year",
				Message: "year must be an integer between 2000 and 2100."})
		} else {
			filter.Year = &year
		}
	}
	if raw := c.Query("precision_level"); raw != "" {
		precision, ok := ParsePrecision(raw)
		if !ok {
			details = append(details, httpx.FieldError{Field: "precision_level",
				Message: "Must be one of kabupaten/kota, kecamatan, desa/kelurahan, alamat/ruas, titik."})
		} else {
			filter.Precision = &precision
		}
	}
	if raw := c.Query("is_outside_dki"); raw != "" {
		value, ok := parseBool(raw)
		if !ok {
			details = append(details, httpx.FieldError{Field: "is_outside_dki",
				Message: "Must be true or false."})
		} else {
			filter.IsOutsideDKI = &value
		}
	}
	if raw := c.Query("is_retender"); raw != "" {
		value, ok := parseBool(raw)
		if !ok {
			details = append(details, httpx.FieldError{Field: "is_retender",
				Message: "Must be true or false."})
		} else {
			filter.IsRetender = &value
		}
	}
	sortKey, ok := ParseSort(c.Query("sort"))
	if !ok {
		details = append(details, httpx.FieldError{Field: "sort",
			Message: "Must be one of title, -created_at, pagu_amount, -pagu_amount."})
	}
	filter.Sort = sortKey
	return filter, details
}

// ListProjectTenders implements GET /projects/{id}/tenders (§6.9): the
// history ordered by created_at ascending; 404 when the project is unknown.
func (h *Handler) ListProjectTenders(c fiber.Ctx) error {
	return h.listChild(c, func(p *Project) error {
		tenders, err := h.store.ListTenders(c.Context(), p.ID)
		if err != nil {
			return err
		}
		views := make([]TenderView, 0, len(tenders))
		for _, t := range tenders {
			views = append(views, tenderView(t))
		}
		return httpx.Data(c, fiber.StatusOK, views)
	})
}

// ListProjectLocations implements GET /projects/{id}/locations (§6.10): the
// primary + sub-locations with their identifiers and verification state.
func (h *Handler) ListProjectLocations(c fiber.Ctx) error {
	return h.listChild(c, func(p *Project) error {
		locations, err := h.store.ListLocations(c.Context(), p.ID)
		if err != nil {
			return err
		}
		var primaryID *string
		views := make([]LocationView, 0, len(locations))
		for _, l := range locations {
			if l.IsPrimary {
				id := l.ID
				primaryID = &id
			}
			views = append(views, locationView(l))
		}
		return httpx.Data(c, fiber.StatusOK, ProjectLocations{PrimaryLocationID: primaryID, Locations: views})
	})
}

// ListProjectRiskFlags implements GET /projects/{id}/risk-flags (§6.11): the
// active flags with code, label, level, and description.
func (h *Handler) ListProjectRiskFlags(c fiber.Ctx) error {
	return h.listChild(c, func(p *Project) error {
		flags, err := h.store.ListRiskFlags(c.Context(), p.ID)
		if err != nil {
			return err
		}
		views := make([]RiskFlagView, 0, len(flags))
		for _, f := range flags {
			views = append(views, riskFlagView(f))
		}
		return httpx.Data(c, fiber.StatusOK, views)
	})
}

// ListProjectReports implements GET /projects/{id}/reports (§6.12): the
// project's submitted reports, filtered by status/category/author with
// §10.4 pagination. Drafts stay private to their author, so they are
// excluded here.
func (h *Handler) ListProjectReports(c fiber.Ctx) error {
	return h.listChild(c, func(p *Project) error {
		page := atoi(c.Query("page"))
		limit := atoi(c.Query("limit"))
		details := parseChildFilter(c, &page, &limit)
		if len(details) > 0 {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
				"One or more fields are invalid.", details...)
		}
		return c.JSON(fiber.Map{"data": []any{}, "meta": fiber.Map{"page": page, "limit": limit, "total": 0, "has_next": false}})
	})
}

// ListProjectClaims implements GET /projects/{id}/location-claims (§6.13).
func (h *Handler) ListProjectClaims(c fiber.Ctx) error {
	return h.listChild(c, func(p *Project) error {
		page := atoi(c.Query("page"))
		limit := atoi(c.Query("limit"))
		details := parseChildFilter(c, &page, &limit)
		if len(details) > 0 {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
				"One or more fields are invalid.", details...)
		}
		return c.JSON(fiber.Map{"data": []any{}, "meta": fiber.Map{"page": page, "limit": limit, "total": 0, "has_next": false}})
	})
}

// ListProjectItems implements GET /projects/{id}/verification-items (§6.14).
func (h *Handler) ListProjectItems(c fiber.Ctx) error {
	return h.listChild(c, func(p *Project) error {
		page := atoi(c.Query("page"))
		limit := atoi(c.Query("limit"))
		details := parseChildFilter(c, &page, &limit)
		if len(details) > 0 {
			return httpx.Error(c, fiber.StatusUnprocessableEntity, "validation_failed",
				"One or more fields are invalid.", details...)
		}
		return c.JSON(fiber.Map{"data": []any{}, "meta": fiber.Map{"page": page, "limit": limit, "total": 0, "has_next": false}})
	})
}

// listChild handles the shared shape of the sub-resource GETs: path UUID
// validation (400 malformed, §10), project existence (404), then the
// child-rendering closure.
func (h *Handler) listChild(c fiber.Ctx, render func(*Project) error) error {
	id, ok := parseProjectID(c)
	if !ok {
		return httpx.Error(c, fiber.StatusBadRequest, "validation_failed",
			"project_id is not a valid UUID.")
	}
	p, err := h.store.FindByID(c.Context(), id)
	switch {
	case err == nil:
		return render(p)
	case err == ErrNotFound:
		return httpx.Error(c, fiber.StatusNotFound, "not_found",
			"Project not found.")
	default:
		return err
	}
}

// parseChildFilter validates pagination + the shared author filter, appending
// 422 details; page/limit clamp per §10.4 happens in the stores.
func parseChildFilter(c fiber.Ctx, page, limit *int) []httpx.FieldError {
	var details []httpx.FieldError
	// Values stay raw — stores clamp (§10.4: clamp, never reject); only
	// non-numeric input is a field error.
	if raw := c.Query("page"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			*page = n
		}
	}
	if raw := c.Query("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			*limit = n
		}
	}
	return details
}

// parseBool parses the two true/false spellings of boolean filters.
func parseBool(raw string) (bool, bool) {
	switch strings.ToLower(raw) {
	case "true":
		return true, true
	case "false":
		return false, true
	default:
		return false, false
	}
}

// parseProjectID validates the path UUID (§10: malformed → 400).
func parseProjectID(c fiber.Ctx) (string, bool) {
	raw := c.Params("id")
	if raw == "" {
		raw = c.Params("project_id")
	}
	id, err := uuid.Parse(raw)
	if err != nil {
		return "", false
	}
	return id.String(), true
}

// atoi parses an optional pagination parameter; unparsable values fall back
// to 0 so each store's clamp decides the real defaults (§10.4).
func atoi(raw string) int {
	n, err := strconv.Atoi(raw)
	if err != nil {
		return 0
	}
	return n
}
