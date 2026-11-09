// Package evidence models supplementary evidence submitted by citizens (§3.13, §6.18).
package evidence

import (
	"context"
	"errors"
	"time"

	"warta.com/api/internal/httpx"
)

// Limits for evidence submissions (§6.18, §11.2).
const (
	MaxEvidencePhotos = 8
	MaxPhotoBytes     = 5 * 1024 * 1024
	MinDescLen        = 1
	MaxDescLen        = 2000
)

// Evidence is a row of the evidences table joined with its author's display name.
type Evidence struct {
	ID                string    `json:"-"`
	ReportID          string    `json:"-"`
	UserID            string    `json:"-"`
	AuthorDisplayName string    `json:"-"`
	Description       string    `json:"-"`
	CreatedAt         time.Time `json:"-"`
	UpdatedAt         time.Time `json:"-"`
	Media             []*Media  `json:"media"`
}

// Media is a row of evidence_media (§3.14).
type Media struct {
	ID             string     `json:"-"`
	EvidenceID     string     `json:"-"`
	FileURL        string     `json:"-"`
	MediaType      string     `json:"-"`
	ExifLatitude   *float64   `json:"-"`
	ExifLongitude  *float64   `json:"-"`
	ExifTakenAt    *time.Time `json:"-"`
	IsGeotagValid  *bool      `json:"-"`
	CreatedAt      time.Time  `json:"-"`
}

// MediaView is the JSON shape of an evidence photo (§7 EvidenceMedia).
type MediaView struct {
	ID         string `json:"id"`
	EvidenceID string `json:"evidence_id"`
	FileURL    string `json:"file_url"`
	MediaType  string `json:"media_type"`
	CreatedAt  string `json:"created_at"`
}

// View renders the §7 JSON shape of an evidence photo.
func (m *Media) View() MediaView {
	return MediaView{
		ID:         m.ID,
		EvidenceID: m.EvidenceID,
		FileURL:    m.FileURL,
		MediaType:  m.MediaType,
		CreatedAt:  httpx.ISO8601(m.CreatedAt),
	}
}

// EvidenceView is the JSON shape of the Evidence resource (§7 Evidence).
type EvidenceView struct {
	ID                string      `json:"id"`
	ReportID          string      `json:"report_id"`
	UserID            string      `json:"user_id"`
	AuthorDisplayName string      `json:"author_display_name"`
	Description       string      `json:"description"`
	CreatedAt         string      `json:"created_at"`
	UpdatedAt         string      `json:"updated_at"`
	Media             []MediaView `json:"media"`
}

// View renders the §7 JSON shape. Email is never exposed.
func (e *Evidence) View() EvidenceView {
	media := make([]MediaView, 0, len(e.Media))
	for _, m := range e.Media {
		media = append(media, m.View())
	}
	return EvidenceView{
		ID:                e.ID,
		ReportID:          e.ReportID,
		UserID:            e.UserID,
		AuthorDisplayName: e.AuthorDisplayName,
		Description:       e.Description,
		CreatedAt:         httpx.ISO8601(e.CreatedAt),
		UpdatedAt:         httpx.ISO8601(e.UpdatedAt),
		Media:             media,
	}
}

// Sentinel errors returned by Store operations.
var (
	ErrNotFound          = errors.New("evidence: not found")
	ErrReportNotFound    = errors.New("evidence: report not found")
	ErrMediaNotFound     = errors.New("evidence: media not found")
	ErrPhotoLimitReached = errors.New("evidence: maximum of 8 photos reached")
	ErrDeleteLocked      = errors.New("evidence: media cannot be deleted after report consensus")
)

// ListFilter carries the parsed query parameters of GET /reports/{report_id}/evidences.
type ListFilter struct {
	Page  int
	Limit int
}

// Meta is the pagination envelope (openapi Meta).
type Meta struct {
	Page    int  `json:"page"`
	Limit   int  `json:"limit"`
	Total   int  `json:"total"`
	HasNext bool `json:"has_next"`
}

// ListResult is one page of evidence items plus pagination metadata.
type ListResult struct {
	Data []*Evidence `json:"data"`
	Meta Meta        `json:"meta"`
}

// Store reads and writes evidence rows and their media (§6.18, §6.19).
type Store interface {
	// ListByReport lists additional evidence for reportID, newest first.
	ListByReport(ctx context.Context, reportID string, filter ListFilter) (*ListResult, error)

	// Create inserts an evidence row under reportID. Does NOT create a verification item.
	Create(ctx context.Context, ev *Evidence) (*Evidence, error)

	// FindByID returns a single evidence entry with author display name and media rows.
	FindByID(ctx context.Context, evidenceID string) (*Evidence, error)

	// ListMedia returns the media photos attached to evidenceID.
	ListMedia(ctx context.Context, evidenceID string) ([]*Media, error)

	// CreateMedia attaches a photo to evidenceID, enforcing the 8-photo limit.
	CreateMedia(ctx context.Context, evidenceID string, m *Media) (*Media, error)

	// DeleteMedia removes an evidence media row and returns its file_url for storage cleanup.
	// Returns ErrDeleteLocked if the parent report has reached consensus.
	DeleteMedia(ctx context.Context, evidenceID, mediaID string) (string, error)
}
