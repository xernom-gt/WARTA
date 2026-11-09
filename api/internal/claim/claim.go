// Package claim models the citizens' location claims (§3.9). This milestone
// exposes only the caller's own listing (GET /users/me/claims); writes arrive
// with the location-claims milestone (TASK.md §Location Claims).
package claim

import (
	"context"
	"errors"
	"time"

	"warta.com/api/internal/httpx"
)

// ClaimStatus is one of the claim statuses (§3.9 allowed values).
type ClaimStatus string

// Valid ClaimStatus values.
const (
	StatusMenunggu ClaimStatus = "menunggu"
	StatusDiterima ClaimStatus = "diterima"
	StatusDitolak  ClaimStatus = "ditolak"
)

// ParseStatus maps a raw query value onto a ClaimStatus, reporting validity
// so handlers can render 422 for unknown values.
func ParseStatus(raw string) (ClaimStatus, bool) {
	switch ClaimStatus(raw) {
	case StatusMenunggu, StatusDiterima, StatusDitolak:
		return ClaimStatus(raw), true
	default:
		return "", false
	}
}

// Claim is a joined row of location_claims + the author's display name.
type Claim struct {
	ID                   string      `json:"-"`
	ProjectID            string      `json:"-"`
	UserID               string      `json:"-"`
	AuthorDisplayName    string      `json:"-"`
	ProposedAddress      string      `json:"-"`
	AddressLine          *string     `json:"-"`
	Kelurahan            *string     `json:"-"`
	Kecamatan            string      `json:"-"`
	City                 *string     `json:"-"`
	Landmark             *string     `json:"-"`
	ProposedPrecision    string      `json:"-"`
	Latitude             *float64    `json:"-"`
	Longitude            *float64    `json:"-"`
	DistanceFromProjectM *float64    `json:"-"`
	ExifStatus           string      `json:"-"`
	ExifNotice           *string     `json:"-"`
	Status               ClaimStatus `json:"-"`
	CreatedAt            time.Time   `json:"-"`
	UpdatedAt            time.Time   `json:"-"`
	DecidedAt            *time.Time  `json:"-"`
}

// ClaimView is the JSON shape of the LocationClaim resource (§7.2).
type ClaimView struct {
	ID                   string      `json:"id"`
	ProjectID            string      `json:"project_id"`
	UserID               string      `json:"user_id"`
	AuthorDisplayName    string      `json:"author_display_name"`
	ProposedAddress      string      `json:"proposed_address"`
	AddressLine          *string     `json:"address_line"`
	Kelurahan            *string     `json:"kelurahan"`
	Kecamatan            string      `json:"kecamatan"`
	City                 *string     `json:"city"`
	Landmark             *string     `json:"landmark"`
	ProposedPrecision    string      `json:"proposed_precision"`
	Latitude             *float64    `json:"latitude"`
	Longitude            *float64    `json:"longitude"`
	DistanceFromProjectM *float64    `json:"distance_from_project_m"`
	ExifStatus           string      `json:"exif_status"`
	ExifNotice           *string     `json:"exif_notice"`
	Status               ClaimStatus `json:"status"`
	CreatedAt            string      `json:"created_at"`
	UpdatedAt            string      `json:"updated_at"`
	DecidedAt            *string     `json:"decided_at"`
}

// View renders the §7.2 JSON shape. It never includes email (§7 note).
func (c *Claim) View() ClaimView {
	return ClaimView{
		ID:                   c.ID,
		ProjectID:            c.ProjectID,
		UserID:               c.UserID,
		AuthorDisplayName:    c.AuthorDisplayName,
		ProposedAddress:      c.ProposedAddress,
		AddressLine:          c.AddressLine,
		Kelurahan:            c.Kelurahan,
		Kecamatan:            c.Kecamatan,
		City:                 c.City,
		Landmark:             c.Landmark,
		ProposedPrecision:    c.ProposedPrecision,
		Latitude:             c.Latitude,
		Longitude:            c.Longitude,
		DistanceFromProjectM: c.DistanceFromProjectM,
		ExifStatus:           c.ExifStatus,
		ExifNotice:           c.ExifNotice,
		Status:               c.Status,
		CreatedAt:            httpx.ISO8601(c.CreatedAt),
		UpdatedAt:            httpx.ISO8601(c.UpdatedAt),
		DecidedAt:            httpx.ISO8601Ptr(c.DecidedAt),
	}
}

// ErrNotFound is returned by lookups when no row matches.
var ErrNotFound = errors.New("claim: not found")

// ListFilter carries the parsed query parameters of GET /users/me/claims.
type ListFilter struct {
	Status *ClaimStatus
	Page   int
	Limit  int
}

// Meta is the pagination envelope (openapi Meta).
type Meta struct {
	Page    int  `json:"page"`
	Limit   int  `json:"limit"`
	Total   int  `json:"total"`
	HasNext bool `json:"has_next"`
}

// ListResult is one page plus its pagination metadata.
type ListResult struct {
	Data []*Claim `json:"data"`
	Meta Meta     `json:"meta"`
}

// Store reads location claims for the /users/me family.
type Store interface {
	// ListByUser lists the caller's claims, newest first, optionally
	// filtered by status.
	ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error)
}