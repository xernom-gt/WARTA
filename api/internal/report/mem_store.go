package report

import (
	"context"
	"sort"
	"sync"
)

// MemoryStore is the in-memory Store used by handler tests. Seeded fixtures
// carry their media and evidence counts together.
type MemoryStore struct {
	mu        sync.Mutex
	reports   []*Report
	media     map[string][]*Media // report_id -> media rows
	evidences map[string]int      // report_id -> evidences_count
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		reports:   []*Report{},
		media:     map[string][]*Media{},
		evidences: map[string]int{},
	}
}

// Seed adds one report fixture with its media photos and evidence count.
func (s *MemoryStore) Seed(r *Report, media []*Media, evidences int) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reports = append(s.reports, r)
	s.media[r.ID] = media
	s.evidences[r.ID] = evidences
}

// ListByUser mirrors the query store: caller's rows, newest first, optional
// status filter, §10.4 clamped pagination.
func (s *MemoryStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)

	s.mu.Lock()
	defer s.mu.Unlock()

	mine := make([]*Report, 0, len(s.reports))
	for _, r := range s.reports {
		if r.UserID != userID {
			continue
		}
		if filter.Status != nil && r.Status != *filter.Status {
			continue
		}
		mine = append(mine, r)
	}
	sort.Slice(mine, func(i, j int) bool { return mine[i].CreatedAt.After(mine[j].CreatedAt) })

	result := &ListResult{
		Data: []*Report{},
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
	for _, r := range mine[offset:end] {
		copied := *r
		copied.Media = []*Media{}
		for _, m := range s.media[r.ID] {
			cm := *m
			copied.Media = append(copied.Media, &cm)
		}
		copied.EvidencesCount = s.evidences[r.ID]
		result.Data = append(result.Data, &copied)
	}
	result.Meta.HasNext = end < len(mine)
	return result, nil
}
