package evidence

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemoryStore is the in-memory Store used by handler tests.
type MemoryStore struct {
	mu        sync.Mutex
	evidences []*Evidence
	media     map[string][]*Media // evidence_id -> media rows
	reports   map[string]string   // report_id -> report status
}

// NewMemoryStore builds an empty in-memory store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		evidences: []*Evidence{},
		media:     map[string][]*Media{},
		reports:   map[string]string{},
	}
}

// SeedReport registers a valid parent report and its status ("draft", "menunggu", etc.).
func (s *MemoryStore) SeedReport(reportID, status string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reports[reportID] = status
}

// Seed adds an evidence fixture with its media rows.
func (s *MemoryStore) Seed(ev *Evidence, media []*Media) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.evidences = append(s.evidences, ev)
	if media == nil {
		media = []*Media{}
	}
	s.media[ev.ID] = media
}

// ListByReport returns a page of evidence items for reportID, newest first.
func (s *MemoryStore) ListByReport(_ context.Context, reportID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)

	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.reports[reportID]; !exists {
		return nil, ErrReportNotFound
	}

	var matches []*Evidence
	for _, ev := range s.evidences {
		if ev.ReportID == reportID {
			matches = append(matches, ev)
		}
	}
	sort.Slice(matches, func(i, j int) bool {
		return matches[i].CreatedAt.After(matches[j].CreatedAt)
	})

	total := len(matches)
	offset := (page - 1) * limit
	result := &ListResult{
		Data: []*Evidence{},
		Meta: Meta{Page: page, Limit: limit, Total: total},
	}
	if offset >= total {
		return result, nil
	}
	end := offset + limit
	if end > total {
		end = total
	}
	for _, ev := range matches[offset:end] {
		result.Data = append(result.Data, s.snapshotLocked(ev))
	}
	result.Meta.HasNext = end < total
	return result, nil
}

// Create inserts an evidence row. Verifies report exists.
func (s *MemoryStore) Create(_ context.Context, ev *Evidence) (*Evidence, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.reports[ev.ReportID]; !exists {
		return nil, ErrReportNotFound
	}

	now := time.Now().UTC()
	created := *ev
	if created.ID == "" {
		created.ID = uuid.NewString()
	}
	if created.CreatedAt.IsZero() {
		created.CreatedAt = now
	}
	if created.UpdatedAt.IsZero() {
		created.UpdatedAt = created.CreatedAt
	}

	stored := created
	s.evidences = append(s.evidences, &stored)
	s.media[stored.ID] = []*Media{}

	return s.snapshotLocked(&stored), nil
}

// FindByID returns a single evidence entry with attached media.
func (s *MemoryStore) FindByID(_ context.Context, evidenceID string) (*Evidence, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, ev := range s.evidences {
		if ev.ID == evidenceID {
			return s.snapshotLocked(ev), nil
		}
	}
	return nil, ErrNotFound
}

// ListMedia lists media rows for evidenceID.
func (s *MemoryStore) ListMedia(_ context.Context, evidenceID string) ([]*Media, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var exists bool
	for _, ev := range s.evidences {
		if ev.ID == evidenceID {
			exists = true
			break
		}
	}
	if !exists {
		return nil, ErrNotFound
	}

	items := s.media[evidenceID]
	out := make([]*Media, len(items))
	for i, m := range items {
		copied := *m
		out[i] = &copied
	}
	return out, nil
}

// CreateMedia adds an evidence photo while enforcing the 8-photo limit.
func (s *MemoryStore) CreateMedia(_ context.Context, evidenceID string, m *Media) (*Media, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var exists bool
	for _, ev := range s.evidences {
		if ev.ID == evidenceID {
			exists = true
			break
		}
	}
	if !exists {
		return nil, ErrNotFound
	}

	if len(s.media[evidenceID]) >= MaxEvidencePhotos {
		return nil, ErrPhotoLimitReached
	}

	created := *m
	if created.ID == "" {
		created.ID = uuid.NewString()
	}
	created.EvidenceID = evidenceID
	if created.CreatedAt.IsZero() {
		created.CreatedAt = time.Now().UTC()
	}

	stored := created
	s.media[evidenceID] = append(s.media[evidenceID], &stored)

	out := stored
	return &out, nil
}

// DeleteMedia deletes an evidence photo unless the parent report is resolved.
func (s *MemoryStore) DeleteMedia(_ context.Context, evidenceID, mediaID string) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var target *Evidence
	for _, ev := range s.evidences {
		if ev.ID == evidenceID {
			target = ev
			break
		}
	}
	if target == nil {
		return "", ErrNotFound
	}

	reportStatus := s.reports[target.ReportID]
	switch reportStatus {
	case "terverifikasi", "ditolak", "selesai":
		return "", ErrDeleteLocked
	}

	items := s.media[evidenceID]
	for idx, m := range items {
		if m.ID == mediaID {
			fileURL := m.FileURL
			s.media[evidenceID] = append(items[:idx], items[idx+1:]...)
			return fileURL, nil
		}
	}
	return "", ErrMediaNotFound
}

func (s *MemoryStore) snapshotLocked(ev *Evidence) *Evidence {
	copied := *ev
	copied.Media = []*Media{}
	for _, m := range s.media[ev.ID] {
		cm := *m
		copied.Media = append(copied.Media, &cm)
	}
	return &copied
}
