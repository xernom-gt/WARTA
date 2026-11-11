package verification

import (
	"context"
	"sort"
	"sync"
)

// MemoryQueueStore provides in-memory queue storage for testing.
type MemoryQueueStore struct {
	mu    sync.RWMutex
	items map[string]*VerificationItem
}

// NewMemoryQueueStore builds a new MemoryQueueStore.
func NewMemoryQueueStore() *MemoryQueueStore {
	return &MemoryQueueStore{
		items: map[string]*VerificationItem{},
	}
}

// Seed adds verification items for testing.
func (s *MemoryQueueStore) Seed(items ...*VerificationItem) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, it := range items {
		s.items[it.ID] = it
	}
}

// ListQueue filters, sorts (created_at ASC), and paginates items in memory.
// Filters out items where AuthorIsActive == false.
func (s *MemoryQueueStore) ListQueue(ctx context.Context, filter QueueFilter) (*QueueResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var matching []*VerificationItem
	for _, it := range s.items {
		// Rule: author deactivation rule
		if !it.AuthorIsActive {
			continue
		}
		if filter.Status != nil && it.Status != *filter.Status {
			continue
		}
		if filter.ItemType != nil && it.ItemType != string(*filter.ItemType) {
			continue
		}
		if filter.ProjectID != "" && it.ProjectID != filter.ProjectID {
			continue
		}
		matching = append(matching, it)
	}

	// Default sort: created_at ASC (§10.3)
	sort.SliceStable(matching, func(i, j int) bool {
		if matching[i].CreatedAt.Equal(matching[j].CreatedAt) {
			return matching[i].ID < matching[j].ID
		}
		return matching[i].CreatedAt.Before(matching[j].CreatedAt)
	})

	total := len(matching)
	page, limit := ClampPage(filter.Page, filter.Limit)
	offset := (page - 1) * limit

	var paged []*VerificationItem
	if offset < total {
		end := offset + limit
		if end > total {
			end = total
		}
		paged = matching[offset:end]
	}

	views := make([]ItemView, 0, len(paged))
	for _, it := range paged {
		views = append(views, it.View())
	}

	return &QueueResult{
		Data: views,
		Meta: Meta{
			Page:    page,
			Limit:   limit,
			Total:   total,
			HasNext: offset+len(views) < total,
		},
	}, nil
}

// GetItemByID returns one item from memory.
func (s *MemoryQueueStore) GetItemByID(ctx context.Context, itemID string) (*VerificationItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	it, ok := s.items[itemID]
	if !ok {
		return nil, ErrItemNotFound
	}
	return it, nil
}


// UpdateFollowUp sets the admin status and admin note on an item in memory.
func (s *MemoryQueueStore) UpdateFollowUp(_ context.Context, itemID string, adminStatus string, adminNote *string) (*VerificationItem, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	it, ok := s.items[itemID]
	if !ok {
		return nil, ErrItemNotFound
	}
	it.AdminStatus = &adminStatus
	it.AdminNote = adminNote
	return it, nil
}
