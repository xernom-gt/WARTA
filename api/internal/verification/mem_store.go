package verification

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"

	"warta.com/api/internal/httpx"
)

// MemoryStore is the in-memory vote Store used by handler tests.
type MemoryStore struct {
	mu            sync.Mutex
	votes         []*Vote
	queueStore    *MemoryQueueStore
	onVoteSuccess func(item *VerificationItem)
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		votes: []*Vote{},
	}
}

// BindQueueStore links memory queue store for automatic resolution updates in tests.
func (s *MemoryStore) BindQueueStore(qs *MemoryQueueStore) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.queueStore = qs
}

// Seed adds one vote fixture carrying the item's current resolution.
func (s *MemoryStore) Seed(v *Vote) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.votes = append(s.votes, v)
}

// ListByUser mirrors the query store.
func (s *MemoryStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)

	s.mu.Lock()
	defer s.mu.Unlock()

	mine := []*Vote{}
	for _, v := range s.votes {
		if v.VoterID == userID {
			mine = append(mine, v)
		}
	}
	sort.Slice(mine, func(i, j int) bool { return mine[i].CreatedAt.After(mine[j].CreatedAt) })

	result := &ListResult{
		Data: []*Vote{},
		Meta: Meta{Page: page, Limit: limit, Total: len(mine)},
	}
	offset := (page - 1) * limit
	if offset >= len(mine) {
		return result, nil
	}
	end := offset + limit
	if end > len(mine) {
		end = len(mine)
	}
	result.Data = mine[offset:end]
	result.Meta.HasNext = end < len(mine)
	return result, nil
}

// ListByItem returns paginated votes for an item.
func (s *MemoryStore) ListByItem(ctx context.Context, itemID string, filter ListFilter) (*ItemVoteListResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.queueStore != nil {
		if _, ok := s.queueStore.items[itemID]; !ok {
			return nil, ErrItemNotFound
		}
	}

	var itemVotes []*Vote
	for _, v := range s.votes {
		if v.VerificationItemID == itemID {
			itemVotes = append(itemVotes, v)
		}
	}

	sort.Slice(itemVotes, func(i, j int) bool {
		return itemVotes[i].CreatedAt.Before(itemVotes[j].CreatedAt)
	})

	total := len(itemVotes)
	page, limit := ClampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	var paged []*Vote
	if offset < total {
		end := offset + limit
		if end > total {
			end = total
		}
		paged = itemVotes[offset:end]
	}

	views := make([]ItemVoteView, 0, len(paged))
	for _, v := range paged {
		views = append(views, v.ItemView())
	}

	return &ItemVoteListResult{
		Data: views,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(views) < total,
		},
	}, nil
}

// CastVote handles voting logic and automatic resolution in memory.
func (s *MemoryStore) CastVote(ctx context.Context, itemID, userID string, choice VoteChoice) (*ItemVoteView, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var item *VerificationItem
	if s.queueStore != nil {
		it, ok := s.queueStore.items[itemID]
		if !ok {
			return nil, ErrItemNotFound
		}
		item = it
	} else {
		// Mock item if no queue store bound
		item = &VerificationItem{
			ID:          itemID,
			TargetVotes: 3,
			Status:      ItemStatusMenunggu,
		}
	}

	if item.Status != ItemStatusMenunggu {
		return nil, ErrItemResolved
	}

	if item.AuthorUserID == userID {
		return nil, ErrSelfVote
	}

	for _, v := range s.votes {
		if v.VerificationItemID == itemID && v.VoterID == userID {
			return nil, ErrDuplicateVote
		}
	}

	now := time.Now().UTC()
	voteID := uuid.NewString()

	if choice == ChoiceSetuju {
		item.VotesAgree++
	} else {
		item.VotesDisagree++
	}
	item.Voters = append(item.Voters, "voter-"+userID)

	if item.VotesAgree >= item.TargetVotes {
		item.ResolvedAt = &now
		if item.ItemType == string(ItemTypeKlaimLokasi) {
			item.Status = ItemStatusDiterima
		} else {
			item.Status = ItemStatusTerverifikasi
		}
	} else if item.VotesDisagree >= item.TargetVotes {
		item.ResolvedAt = &now
		item.Status = ItemStatusDitolak
	}

	v := &Vote{
		ID:                 voteID,
		VoterID:            userID,
		VerificationItemID: itemID,
		Choice:             choice,
		CreatedAt:          now,
		Status:             VoteResolutionStatus(item.Status),
		VotesAgree:         item.VotesAgree,
		VotesDisagree:      item.VotesDisagree,
		TargetVotes:        item.TargetVotes,
		ResolvedAt:         item.ResolvedAt,
	}
	s.votes = append(s.votes, v)

	return &ItemVoteView{
		ID:                 voteID,
		VerificationItemID: itemID,
		UserID:             userID,
		Choice:             choice,
		CreatedAt:          httpx.ISO8601(now),
	}, nil
}

// clampPage applies §10.4 pagination defaults.
func clampPage(page, limit int) (int, int) {
	return ClampPage(page, limit)
}
