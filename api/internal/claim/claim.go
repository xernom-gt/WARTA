// Package claim models the citizens' location claims (§3.9, §3.10).
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

// Media is a row of claim_media (§3.10).
type Media struct {
	ID             string     `json:"id"`
	ClaimID        string     `json:"claim_id"`
	FileURL        string     `json:"file_url"`
	MediaType      string     `json:"media_type"`
	ExifLatitude   *float64   `json:"exif_latitude"`
	ExifLongitude  *float64   `json:"exif_longitude"`
	ExifTakenAt    *time.Time `json:"-"`
	IsGeotagValid  *bool      `json:"is_geotag_valid"`
	CreatedAt      time.Time  `json:"-"`
}

// MediaView is the JSON representation of claim media.
type MediaView struct {
	ID            string   `json:"id"`
	ClaimID       string   `json:"claim_id"`
	FileURL       string   `json:"file_url"`
	MediaType     string   `json:"media_type"`
	ExifLatitude  *float64 `json:"exif_latitude"`
	ExifLongitude *float64 `json:"exif_longitude"`
	ExifTakenAt   *string  `json:"exif_taken_at"`
	IsGeotagValid *bool    `json:"is_geotag_valid"`
	CreatedAt     string   `json:"created_at"`
}

// View converts Media to MediaView.
func (m *Media) View() MediaView {
	return MediaView{
		ID:            m.ID,
		ClaimID:       m.ClaimID,
		FileURL:       m.FileURL,
		MediaType:     m.MediaType,
		ExifLatitude:  m.ExifLatitude,
		ExifLongitude: m.ExifLongitude,
		ExifTakenAt:   httpx.ISO8601Ptr(m.ExifTakenAt),
		IsGeotagValid: m.IsGeotagValid,
		CreatedAt:     httpx.ISO8601(m.CreatedAt),
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
	Media                *Media      `json:"-"`
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

// ErrMediaNotFound is returned when claim media is not found.
var ErrMediaNotFound = errors.New("claim media: not found")

// ErrProjectHasAcceptedClaim is returned when attempting to create a claim on a project with an accepted claim.
var ErrProjectHasAcceptedClaim = errors.New("project already has an accepted claim")

// ErrPhotoLimitExceeded is returned when attempting to upload more than 1 photo for a claim.
var ErrPhotoLimitExceeded = errors.New("claim photo limit exceeded")

// ErrInvalidClaimState is returned when trying to delete photo when claim is not menunggu.
var ErrInvalidClaimState = errors.New("claim is not in menunggu state")

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

// CreateClaimInput is the payload for creating a new location claim (§6.16).
type CreateClaimInput struct {
	ProposedAddress   string   `json:"proposed_address"`
	AddressLine       *string  `json:"address_line"`
	Kelurahan         *string  `json:"kelurahan"`
	Kecamatan         string   `json:"kecamatan"`
	City              *string  `json:"city"`
	Landmark          *string  `json:"landmark"`
	ProposedPrecision string   `json:"proposed_precision"`
	Latitude          *float64 `json:"latitude"`
	Longitude         *float64 `json:"longitude"`
}

// Store defines persistence operations for location claims and claim media.
type Store interface {
	// ListByUser lists the caller's claims.
	ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error)
	// Create creates a claim, creates verification item, and calculates distance to project's primary location.
	Create(ctx context.Context, projectID, userID string, input CreateClaimInput) (*Claim, error)
	// GetByID retrieves a claim by ID.
	GetByID(ctx context.Context, claimID string) (*Claim, error)
	// GetMedia retrieves the single photo for a claim.
	GetMedia(ctx context.Context, claimID string) (*Media, error)
	// AddMedia attaches a photo to a claim (max 1).
	AddMedia(ctx context.Context, claimID string, media *Media) (*Media, error)
	// DeleteMedia removes the photo from a claim (only allowed when claim is menunggu).
	DeleteMedia(ctx context.Context, claimID, mediaID string) error
	// AcceptClaim marks claim accepted, sets project's primary location, and updates canonical claim flag.
	AcceptClaim(ctx context.Context, claimID string) error
}
