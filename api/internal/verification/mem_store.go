package verification

import (
	"context"
	"sort"
	"sync"
)

// MemoryStore is the in-memory vote Store used by handler tests.
type MemoryStore struct {
	mu    sync.Mutex
	votes []*Vote
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore { return &MemoryStore{votes: []*Vote{}} }

// Seed adds one vote fixture carrying the item's current resolution.
func (s *MemoryStore) Seed(v *Vote) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.votes = append(s.votes, v)
}

// ListByUser mirrors the query store: the caller's votes, newest first,
// with clamped pagination.
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