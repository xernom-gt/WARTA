// Package report models citizens' condition reports (§3.7, §6.11-6.15).
package report

import (
	"context"
	"errors"
	"math"
	"time"

	"warta.com/api/internal/httpx"
)

// ReportStatus is one of the report statuses (§3.7 allowed values).
type ReportStatus string

// Valid ReportStatus values.
const (
	StatusDraft         ReportStatus = "draft"
	StatusMenunggu      ReportStatus = "menunggu"
	StatusTerverifikasi ReportStatus = "terverifikasi"
	StatusDitolak       ReportStatus = "ditolak"
	StatusSelesai       ReportStatus = "selesai"
)

// ParseStatus maps a raw value onto a ReportStatus.
func ParseStatus(raw string) (ReportStatus, bool) {
	switch ReportStatus(raw) {
	case StatusDraft, StatusMenunggu, StatusTerverifikasi, StatusDitolak, StatusSelesai:
		return ReportStatus(raw), true
	default:
		return "", false
	}
}

// Valid report categories (§3.7 allowed values).
const (
	CategoryBelumMulai     = "belum_mulai"
	CategoryLambatMangkrak = "lambat_mangkrak"
	CategoryFisikRusak     = "fisik_rusak"
	CategoryPapanTidakAda  = "papan_tidak_ada"
	CategorySelesai        = "selesai"
)

// ParseCategory checks whether raw is one of the §3.7 report categories.
func ParseCategory(raw string) (string, bool) {
	switch raw {
	case CategoryBelumMulai, CategoryLambatMangkrak, CategoryFisikRusak, CategoryPapanTidakAda, CategorySelesai:
		return raw, true
	default:
		return "", false
	}
}

// Valid EXIF status values (§3.7 allowed values).
const (
	ExifValid   = "valid"
	ExifInvalid = "invalid"
	ExifMissing = "missing"
)

// ParseExifStatus checks whether raw is one of the §3.7 EXIF statuses.
func ParseExifStatus(raw string) (string, bool) {
	switch raw {
	case ExifValid, ExifInvalid, ExifMissing:
		return raw, true
	default:
		return "", false
	}
}

// HaversineMeters computes the great-circle distance in meters between two
// WGS-84 coordinates, rounded to two decimal places to match DECIMAL(10, 2).
func HaversineMeters(lat1, lon1, lat2, lon2 float64) float64 {
	const earthRadiusM = 6371000.0
	toRad := math.Pi / 180.0
	dLat := (lat2 - lat1) * toRad
	dLon := (lon2 - lon1) * toRad
	rLat1 := lat1 * toRad
	rLat2 := lat2 * toRad

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(rLat1)*math.Cos(rLat2)*math.Sin(dLon/2)*math.Sin(dLon/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return math.Round(earthRadiusM*c*100) / 100
}

// Report is a row of the reports table joined with its author's display name.
type Report struct {
	ID                   string       `json:"-"`
	ProjectID            string       `json:"-"`
	UserID               string       `json:"-"`
	AuthorDisplayName    string       `json:"-"`
	Category             *string      `json:"-"`
	Narrative            string       `json:"-"`
	ProposedAddress      *string      `json:"-"`
	Latitude             *float64     `json:"-"`
	Longitude            *float64     `json:"-"`
	DistanceFromProjectM *float64     `json:"-"`
	ExifStatus           string       `json:"-"`
	ExifNotice           *string      `json:"-"`
	Status               ReportStatus `json:"-"`
	DeletedAt            *time.Time   `json:"-"`
	CreatedAt            time.Time    `json:"-"`
	UpdatedAt            time.Time    `json:"-"`
	SubmittedAt          *time.Time   `json:"-"`
	Media                []*Media     `json:"media"`
	EvidencesCount       int          `json:"evidences_count"`
}

// DraftPatch carries the mutable fields of a draft report (§6.13).
// Set* flags distinguish an omitted JSON key from an explicit null or value.
type DraftPatch struct {
	SetCategory        bool
	Category           *string
	SetNarrative       bool
	Narrative          string
	SetProposedAddress bool
	ProposedAddress    *string
	SetCoordinates     bool
	Latitude           *float64
	Longitude          *float64
	UpdatedAt          time.Time
}

// Media is a row of report_media (§3.8).
type Media struct {
	ID            string     `json:"-"`
	ReportID      string     `json:"-"`
	FileURL       string     `json:"-"`
	MediaType     string     `json:"-"`
	ExifLatitude  *float64   `json:"-"`
	ExifLongitude *float64   `json:"-"`
	ExifTakenAt   *time.Time `json:"-"`
	IsGeotagValid *bool      `json:"-"`
	SortOrder     int        `json:"-"`
	CreatedAt     time.Time  `json:"-"`
}

// MediaView is the JSON shape of one report photo (§7 Report.media items).
type MediaView struct {
	ID            string   `json:"id"`
	ReportID      string   `json:"report_id"`
	FileURL       string   `json:"file_url"`
	MediaType     string   `json:"media_type"`
	ExifLatitude  *float64 `json:"exif_latitude"`
	ExifLongitude *float64 `json:"exif_longitude"`
	ExifTakenAt   *string  `json:"exif_taken_at"`
	IsGeotagValid *bool    `json:"is_geotag_valid"`
	SortOrder     int      `json:"sort_order"`
	CreatedAt     string   `json:"created_at"`
}

// View renders the §7.1 JSON shape of a single report_media row.
func (m *Media) View() MediaView {
	return MediaView{
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
	}
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
		media = append(media, m.View())
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

// Sentinel errors returned by Store operations.
var (
	ErrNotFound          = errors.New("report: not found")
	ErrProjectNotFound   = errors.New("report: project not found")
	ErrNotDraft          = errors.New("report: report is not a draft")
	ErrDeleteLocked      = errors.New("report: report cannot be deleted after consensus")
	ErrMediaNotFound     = errors.New("report: media not found")
	ErrPhotoLimitReached = errors.New("report: maximum of 4 photos reached")
	ErrSortOrderTaken    = errors.New("report: sort_order slot already in use")
)

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

// Store reads and writes condition reports and their media (§6.11-6.15).
type Store interface {
	ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error)
	Create(ctx context.Context, r *Report, enqueue bool) (*Report, error)
	FindByID(ctx context.Context, reportID string) (*Report, error)
	Submit(ctx context.Context, reportID string, submittedAt time.Time) (*Report, error)
	UpdateDraft(ctx context.Context, reportID string, patch DraftPatch) (*Report, error)
	Delete(ctx context.Context, reportID string, deletedAt time.Time) error

	// CreateMedia attaches a new report_media row to reportID at requestedSlot
	// (or the lowest free slot 0..3 when requestedSlot is nil) per §6.15.
	CreateMedia(ctx context.Context, reportID string, m *Media, requestedSlot *int) (*Media, error)

	// DeleteMedia removes one report_media row while the report is still a
	// draft (§6.19) and returns its stored file_url so the caller can remove
	// the underlying object from storage.
	DeleteMedia(ctx context.Context, reportID, mediaID string) (string, error)
}
