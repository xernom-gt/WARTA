package verification

import (
	"context"
	"errors"
	"time"

	"warta.com/api/internal/httpx"
	"warta.com/api/internal/labels"
)

// ItemStatus represents status of verification item (§3.11).
type ItemStatus string

const (
	ItemStatusMenunggu      ItemStatus = "menunggu"
	ItemStatusTerverifikasi ItemStatus = "terverifikasi"
	ItemStatusDitolak       ItemStatus = "ditolak"
	ItemStatusDiterima      ItemStatus = "diterima"
)

// ParseItemStatus parses raw status query value.
func ParseItemStatus(raw string) (ItemStatus, bool) {
	switch ItemStatus(raw) {
	case ItemStatusMenunggu, ItemStatusTerverifikasi, ItemStatusDitolak, ItemStatusDiterima:
		return ItemStatus(raw), true
	default:
		return "", false
	}
}

// ItemType represents type of subject in verification queue.
type ItemType string

const (
	ItemTypeLaporanKondisi ItemType = "laporan_kondisi"
	ItemTypeKlaimLokasi    ItemType = "klaim_lokasi"
)

// ParseItemType parses raw item_type query value.
func ParseItemType(raw string) (ItemType, bool) {
	switch ItemType(raw) {
	case ItemTypeLaporanKondisi, ItemTypeKlaimLokasi:
		return ItemType(raw), true
	default:
		return "", false
	}
}

// VerificationItem represents a joined queue item row (§7.3).
type VerificationItem struct {
	ID                   string     `json:"id"`
	ProjectID            string     `json:"project_id"`
	ProjectTitle         string     `json:"project_title"`
	SPSECode             string     `json:"spse_code"`
	Satker               string     `json:"satker"`
	PaguAmount           string     `json:"pagu_amount"`
	ItemType             string     `json:"item_type"`
	ReportID             *string    `json:"report_id"`
	ClaimID              *string    `json:"claim_id"`
	AuthorUserID         string     `json:"-"`
	AuthorDisplayName    string     `json:"author_display_name"`
	AuthorIsActive       bool       `json:"-"`
	Category             *string    `json:"-"`
	CategoryLabel        *string    `json:"category_label"`
	Narrative            *string    `json:"narrative"`
	ProposedAddress      *string    `json:"proposed_address"`
	ProposedPrecision    *string    `json:"proposed_precision"`
	Latitude             *float64   `json:"latitude"`
	Longitude            *float64   `json:"longitude"`
	DistanceFromProjectM *float64   `json:"distance_from_project_m"`
	ExifStatus           string     `json:"exif_status"`
	ExifNotice           *string    `json:"exif_notice"`
	PhotoURL             *string    `json:"photo_url"`
	VotesAgree           int        `json:"votes_agree"`
	VotesDisagree        int        `json:"votes_disagree"`
	TargetVotes          int        `json:"target_votes"`
	Voters               []string   `json:"voters"`
	Status               ItemStatus `json:"status"`
	CreatedAt            time.Time  `json:"-"`
	ResolvedAt           *time.Time `json:"-"`
}

// ItemView is the JSON representation of a verification item (§7.3).
type ItemView struct {
	ID                   string     `json:"id"`
	ProjectID            string     `json:"project_id"`
	ProjectTitle         string     `json:"project_title"`
	SPSECode             string     `json:"spse_code"`
	Satker               string     `json:"satker"`
	PaguAmount           string     `json:"pagu_amount"`
	ItemType             string     `json:"item_type"`
	ReportID             *string    `json:"report_id"`
	ClaimID              *string    `json:"claim_id"`
	AuthorDisplayName    string     `json:"author_display_name"`
	CategoryLabel        *string    `json:"category_label"`
	Narrative            *string    `json:"narrative"`
	ProposedAddress      *string    `json:"proposed_address"`
	ProposedPrecision    *string    `json:"proposed_precision"`
	Latitude             *float64   `json:"latitude"`
	Longitude            *float64   `json:"longitude"`
	DistanceFromProjectM *float64   `json:"distance_from_project_m"`
	ExifStatus           string     `json:"exif_status"`
	ExifNotice           *string    `json:"exif_notice"`
	PhotoURL             *string    `json:"photo_url"`
	VotesAgree           int        `json:"votes_agree"`
	VotesDisagree        int        `json:"votes_disagree"`
	TargetVotes          int        `json:"target_votes"`
	Voters               []string   `json:"voters"`
	Status               ItemStatus `json:"status"`
	CreatedAt            string     `json:"created_at"`
	ResolvedAt           *string    `json:"resolved_at"`
}

// View converts VerificationItem to ItemView.
func (it *VerificationItem) View() ItemView {
	var catLabel *string
	if it.Category != nil && *it.Category != "" {
		lbl := labels.CategoryLabel(*it.Category)
		catLabel = &lbl
	} else if it.CategoryLabel != nil {
		catLabel = it.CategoryLabel
	}

	voters := it.Voters
	if voters == nil {
		voters = []string{}
	}

	return ItemView{
		ID:                   it.ID,
		ProjectID:            it.ProjectID,
		ProjectTitle:         it.ProjectTitle,
		SPSECode:             it.SPSECode,
		Satker:               it.Satker,
		PaguAmount:           it.PaguAmount,
		ItemType:             it.ItemType,
		ReportID:             it.ReportID,
		ClaimID:              it.ClaimID,
		AuthorDisplayName:    it.AuthorDisplayName,
		CategoryLabel:        catLabel,
		Narrative:            it.Narrative,
		ProposedAddress:      it.ProposedAddress,
		ProposedPrecision:    it.ProposedPrecision,
		Latitude:             it.Latitude,
		Longitude:            it.Longitude,
		DistanceFromProjectM: it.DistanceFromProjectM,
		ExifStatus:           it.ExifStatus,
		ExifNotice:           it.ExifNotice,
		PhotoURL:             it.PhotoURL,
		VotesAgree:           it.VotesAgree,
		VotesDisagree:        it.VotesDisagree,
		TargetVotes:          it.TargetVotes,
		Voters:               voters,
		Status:               it.Status,
		CreatedAt:            httpx.ISO8601(it.CreatedAt),
		ResolvedAt:           httpx.ISO8601Ptr(it.ResolvedAt),
	}
}

// QueueFilter carries query params for GET /verification-items.
type QueueFilter struct {
	Status    *ItemStatus
	ItemType  *ItemType
	ProjectID string
	Page      int
	Limit     int
}

// QueueResult represents paginated queue response.
type QueueResult struct {
	Data []ItemView `json:"data"`
	Meta Meta       `json:"meta"`
}

// ErrItemNotFound is returned when verification item is not found.
var ErrItemNotFound = errors.New("verification item: not found")

// QueueStore defines reading and managing queue items.
type QueueStore interface {
	// ListQueue returns paginated verification queue matching filters.
	// Filters out items whose author has is_active = false or withdrawn reports.
	ListQueue(ctx context.Context, filter QueueFilter) (*QueueResult, error)
	// GetItemByID returns one queue item with its photo and voter display names.
	GetItemByID(ctx context.Context, itemID string) (*VerificationItem, error)
}

