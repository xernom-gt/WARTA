// Package report models the citizens' condition reports (§3.7). This
// milestone exposes only the caller's own listing (GET /users/me/reports);
// writes arrive with the reports milestone (TASK.md §Reports & Evidence).
package report

import (
	"context"
	"errors"
	"time"

	"warta.com/api/internal/httpx"
)

// ReportStatus is one of the report statuses (§3.7 allowed values).
type ReportStatus string

// Valid ReportStatus values.
const (
	StatusDraft        ReportStatus = "draft"
	StatusMenunggu     ReportStatus = "menunggu"
	StatusTerverifikasi ReportStatus = "terverifikasi"
	StatusDitolak      ReportStatus = "ditolak"
	StatusSelesai      ReportStatus = "selesai"
)

// ParseStatus maps a raw query value onto a ReportStatus, reporting validity
// so handlers can render 422 for unknown values.
func ParseStatus(raw string) (ReportStatus, bool) {
	switch ReportStatus(raw) {
	case StatusDraft, StatusMenunggu, StatusTerverifikasi, StatusDitolak, StatusSelesai:
		return ReportStatus(raw), true
	default:
		return "", false
	}
}

// Report is a row of the reports table joined with its author's display name.
type Report struct {
	ID                   string      `json:"-"`
	ProjectID            string      `json:"-"`
	UserID               string      `json:"-"`
	AuthorDisplayName    string      `json:"-"`
	Category             *string     `json:"-"`
	Narrative            string      `json:"-"`
	ProposedAddress      *string     `json:"-"`
	Latitude             *float64    `json:"-"`
	Longitude            *float64    `json:"-"`
	DistanceFromProjectM *float64    `json:"-"`
	ExifStatus           string      `json:"-"`
	ExifNotice           *string     `json:"-"`
	Status               ReportStatus `json:"-"`
	CreatedAt            time.Time   `json:"-"`
	UpdatedAt            time.Time   `json:"-"`
	SubmittedAt          *time.Time  `json:"-"`
	Media                []*Media    `json:"media"`
	EvidencesCount       int         `json:"evidences_count"`
}

// Media is a row of report_media (§3.8).
type Media struct {
	ID             string     `json:"-"`
	ReportID       string     `json:"-"`
	FileURL        string     `json:"-"`
	MediaType      string     `json:"-"`
	ExifLatitude   *float64   `json:"-"`
	ExifLongitude  *float64   `json:"-"`
	ExifTakenAt    *time.Time `json:"-"`
	IsGeotagValid  *bool      `json:"-"`
	SortOrder      int        `json:"-"`
	CreatedAt      time.Time  `json:"-"`
}

// MediaView is the JSON shape of one report photo (§7 Report.media items).
type MediaView struct {
	ID            string  `json:"id"`
	ReportID      string  `json:"report_id"`
	FileURL       string  `json:"file_url"`
	MediaType     string  `json:"media_type"`
	ExifLatitude  *float64 `json:"exif_latitude"`
	ExifLongitude *float64 `json:"exif_longitude"`
	ExifTakenAt   *string  `json:"exif_taken_at"`
	IsGeotagValid *bool    `json:"is_geotag_valid"`
	SortOrder     int     `json:"sort_order"`
	CreatedAt     string  `json:"created_at"`
}

// ReportView is the JSON shape of the Report resource (§7.1).
type ReportView struct {
	ID                   string       `json:"id"`
	ProjectID            string       `json:"project_id"`
	UserID               string       `json:"user_id"`
	AuthorDisplayName    string       `json:"author_display_name"`
	Category             *string      `json:"category"`
	Narrative            string       `json:"narrative"`
	ProposedAddress      *string      `json:"proposed_address"`
	Latitude             *float64     `json:"latitude"`
	Longitude            *float64     `json:"longitude"`
	DistanceFromProjectM *float64     `json:"distance_from_project_m"`
	ExifStatus           string       `json:"exif_status"`
	ExifNotice           *string      `json:"exif_notice"`
	Status               ReportStatus `json:"status"`
	CreatedAt            string       `json:"created_at"`
	UpdatedAt            string       `json:"updated_at"`
	SubmittedAt          *string      `json:"submitted_at"`
	Media                []MediaView  `json:"media"`
	EvidencesCount       int          `json:"evidences_count"`
}

// View renders the §7.1 JSON shape. It never includes email (§7 note).
func (r *Report) View() ReportView {
	media := make([]MediaView, 0, len(r.Media))
	for _, m := range r.Media {
		media = append(media, MediaView{
			ID:            m.ID,
			ReportID:      m.ReportID,
			FileURL:       m.FileURL,
			MediaType:     m.MediaType,
			ExifLatitude:  m.ExifLatitude,
			ExifLongitude: m.ExifLongitude,
			ExifTakenAt:   httpx.ISO8601Ptr(m.ExifTakenAt),
			IsGeotagValid: m.IsGeotagValid,
			SortOrder:     m.SortOrder,
			CreatedAt:     httpx.ISO8601(m.CreatedAt),
		})
	}
	return ReportView{
		ID:                   r.ID,
		ProjectID:            r.ProjectID,
		UserID:               r.UserID,
		AuthorDisplayName:    r.AuthorDisplayName,
		Category:             r.Category,
		Narrative:            r.Narrative,
		ProposedAddress:      r.ProposedAddress,
		Latitude:             r.Latitude,
		Longitude:            r.Longitude,
		DistanceFromProjectM: r.DistanceFromProjectM,
		ExifStatus:           r.ExifStatus,
		ExifNotice:           r.ExifNotice,
		Status:               r.Status,
		CreatedAt:            httpx.ISO8601(r.CreatedAt),
		UpdatedAt:            httpx.ISO8601(r.UpdatedAt),
		SubmittedAt:          httpx.ISO8601Ptr(r.SubmittedAt),
		Media:                media,
		EvidencesCount:       r.EvidencesCount,
	}
}

// ErrNotFound is returned by lookups when no row matches.
var ErrNotFound = errors.New("report: not found")

// ListFilter carries the parsed query parameters of GET /users/me/reports.
// Page defaults to 1; Limit defaults to 20 and clamps at 100 (§10.4).
type ListFilter struct {
	Status *ReportStatus
	Page   int
	Limit  int
}

// Meta is the pagination envelope (openapi Meta, §3.2 collection shape).
type Meta struct {
	Page    int  `json:"page"`
	Limit   int  `json:"limit"`
	Total   int  `json:"total"`
	HasNext bool `json:"has_next"`
}

// ListResult is one page plus its pagination metadata.
type ListResult struct {
	Data []*Report `json:"data"`
	Meta Meta      `json:"meta"`
}

// Store reads reports for the /users/me family. Writes land with the
// reports milestone and extend this interface.
type Store interface {
	// ListByUser lists the caller's reports, newest first, optionally
	// filtered by status.
	ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error)
}
