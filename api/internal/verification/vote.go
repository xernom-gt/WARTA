// Package verification models the unified verification queue (§3.11) and its
// votes (§3.12).
package verification

import (
	"context"
	"errors"
	"time"

	"warta.com/api/internal/httpx"
)

// VoteChoice is a citizen's choice on a verification item (§3.12).
type VoteChoice string

// Valid VoteChoice values.
const (
	ChoiceSetuju      VoteChoice = "setuju"
	ChoiceTidakSetuju VoteChoice = "tidak_setuju"
)

// ParseVoteChoice parses a raw string choice.
func ParseVoteChoice(raw string) (VoteChoice, bool) {
	switch VoteChoice(raw) {
	case ChoiceSetuju, ChoiceTidakSetuju:
		return VoteChoice(raw), true
	default:
		return "", false
	}
}

// VoteResolutionStatus is the union status of the voted item (§6.22): a
// report resolves to terverifikasi/ditolak, a claim to diterima/ditolak.
type VoteResolutionStatus string

// Valid VoteResolutionStatus values (openapi VoteResolutionStatus).
const (
	ResolutionMenunggu      VoteResolutionStatus = "menunggu"
	ResolutionTerverifikasi VoteResolutionStatus = "terverifikasi"
	ResolutionDitolak       VoteResolutionStatus = "ditolak"
	ResolutionDiterima      VoteResolutionStatus = "diterima"
)

// Resolution is the current outcome of the voted item (§7.5). It is always
// present, including while the item is still menunggu.
type Resolution struct {
	Status        VoteResolutionStatus `json:"status"`
	VotesAgree    int                  `json:"votes_agree"`
	VotesDisagree int                  `json:"votes_disagree"`
	TargetVotes   int                  `json:"target_votes"`
	ResolvedAt    *string              `json:"resolved_at"`
}

// MyVote is the caller's vote plus the item's current outcome (§7.5).
type MyVote struct {
	ID                 string     `json:"id"`
	VerificationItemID string     `json:"verification_item_id"`
	ProjectID          string     `json:"project_id"`
	ProjectTitle       string     `json:"project_title"`
	ItemType           string     `json:"item_type"`
	AuthorDisplayName  string     `json:"author_display_name"`
	Choice             VoteChoice `json:"choice"`
	CreatedAt          string     `json:"created_at"`
	Resolution         Resolution `json:"resolution"`
}

// ItemVoteView is the public view of a cast vote (openapi Vote, §6.17).
type ItemVoteView struct {
	ID                 string     `json:"id"`
	VerificationItemID string     `json:"verification_item_id"`
	UserID             string     `json:"user_id"`
	Choice             VoteChoice `json:"choice"`
	CreatedAt          string     `json:"created_at"`
}

// ItemVoteListResult is the paginated response for GET /verification-items/{item_id}/votes.
type ItemVoteListResult struct {
	Data []ItemVoteView `json:"data"`
	Meta Meta           `json:"meta"`
}

// Vote is a joined row behind MyVote, straight from the database columns.
type Vote struct {
	ID                 string
	VoterID            string
	VerificationItemID string
	ProjectID          string
	ProjectTitle       string
	ItemType           string
	AuthorDisplayName  string
	Choice             VoteChoice
	CreatedAt          time.Time
	Status             VoteResolutionStatus
	VotesAgree         int
	VotesDisagree      int
	TargetVotes        int
	ResolvedAt         *time.Time
}

// View renders the §7.5 JSON shape.
func (v *Vote) View() MyVote {
	return MyVote{
		ID:                 v.ID,
		VerificationItemID: v.VerificationItemID,
		ProjectID:          v.ProjectID,
		ProjectTitle:       v.ProjectTitle,
		ItemType:           v.ItemType,
		AuthorDisplayName:  v.AuthorDisplayName,
		Choice:             v.Choice,
		CreatedAt:          httpx.ISO8601(v.CreatedAt),
		Resolution: Resolution{
			Status:        v.Status,
			VotesAgree:    v.VotesAgree,
			VotesDisagree: v.VotesDisagree,
			TargetVotes:   v.TargetVotes,
			ResolvedAt:    httpx.ISO8601Ptr(v.ResolvedAt),
		},
	}
}

// ItemView renders the openapi Vote shape.
func (v *Vote) ItemView() ItemVoteView {
	return ItemVoteView{
		ID:                 v.ID,
		VerificationItemID: v.VerificationItemID,
		UserID:             v.VoterID,
		Choice:             v.Choice,
		CreatedAt:          httpx.ISO8601(v.CreatedAt),
	}
}

// ListFilter carries the parsed query parameters of GET /users/me/votes.
type ListFilter struct {
	Page  int
	Limit int
}

// ClampPage applies §10.4 pagination defaults (page >= 1; default limit 20,
// max 100, clamped — never reject).
func ClampPage(page, limit int) (int, int) {
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit
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
	Data []*Vote `json:"data"`
	Meta Meta    `json:"meta"`
}

// Business error sentinels (§6.17)
var (
	ErrDuplicateVote = errors.New("vote: duplicate vote")
	ErrSelfVote      = errors.New("vote: cannot vote on own content")
	ErrItemResolved  = errors.New("vote: verification item is already resolved")
)

// Store reads and writes votes.
type Store interface {
	// ListByUser lists the caller's votes, newest first, each carrying the
	// voted item's current outcome (§6.22).
	ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error)
	// ListByItem lists votes for a specific verification item (§5.5).
	ListByItem(ctx context.Context, itemID string, filter ListFilter) (*ItemVoteListResult, error)
	// CastVote records a citizen's vote, performs atomic counter updates,
	// and triggers automatic resolution upon reaching target_votes.
	CastVote(ctx context.Context, itemID, userID string, choice VoteChoice) (*ItemVoteView, error)
}
