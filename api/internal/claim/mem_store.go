package claim

import (
	"context"
	"sort"
	"sync"
)

// MemoryStore is the in-memory Store used by handler tests.
type MemoryStore struct {
	mu     sync.Mutex
	claims []*Claim
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore { return &MemoryStore{claims: []*Claim{}} }

// Seed adds one claim fixture.
func (s *MemoryStore) Seed(c *Claim) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.claims = append(s.claims, c)
}

// ListByUser mirrors the query store: caller's rows, newest first, optional
// status filter, clamped pagination.
func (s *MemoryStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)

	s.mu.Lock()
	defer s.mu.Unlock()

	mine := make([]*Claim, 0, len(s.claims))
	for _, c := range s.claims {
		if c.UserID != userID {
			continue
		}
		if filter.Status != nil && c.Status != *filter.Status {
			continue
		}
		mine = append(mine, c)
	}
	sort.Slice(mine, func(i, j int) bool { return mine[i].CreatedAt.After(mine[j].CreatedAt) })

	result := &ListResult{
		Data: []*Claim{},
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