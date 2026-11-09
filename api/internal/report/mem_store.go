package report

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// ProjectCoords holds a seeded project's optional primary location coordinates.
type ProjectCoords struct {
	Latitude  *float64
	Longitude *float64
}

// VerificationItem represents an in-memory row of verification_items (§3.11)
// created when a report is submitted.
type VerificationItem struct {
	ID          string
	ItemType    string
	ReportID    string
	Status      string
	TargetVotes int
	CreatedAt   time.Time
}

// MemoryStore is the in-memory Store used by handler tests.
type MemoryStore struct {
	mu                sync.Mutex
	reports           []*Report
	media             map[string][]*Media      // report_id -> media rows
	evidences         map[string]int           // report_id -> evidences_count
	projects          map[string]ProjectCoords // project_id -> primary location coords
	verificationItems []VerificationItem
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		reports:           []*Report{},
		media:             map[string][]*Media{},
		evidences:         map[string]int{},
		projects:          map[string]ProjectCoords{},
		verificationItems: []VerificationItem{},
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

// SeedProject registers a project in memory with optional primary coordinates.
func (s *MemoryStore) SeedProject(projectID string, lat, lng *float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.projects[projectID] = ProjectCoords{Latitude: lat, Longitude: lng}
}

// VerificationItems returns a snapshot of the enqueued verification items.
func (s *MemoryStore) VerificationItems() []VerificationItem {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]VerificationItem, len(s.verificationItems))
	copy(out, s.verificationItems)
	return out
}

// Create inserts a new report in memory and optionally enqueues its
// verification item (§6.11).
func (s *MemoryStore) Create(ctx context.Context, r *Report, enqueue bool) (*Report, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	proj, ok := s.projects[r.ProjectID]
	if !ok {
		return nil, ErrProjectNotFound
	}

	now := time.Now().UTC()
	created := *r
	if created.ID == "" {
		created.ID = uuid.NewString()
	}
	if created.CreatedAt.IsZero() {
		created.CreatedAt = now
	}
	if created.UpdatedAt.IsZero() {
		created.UpdatedAt = created.CreatedAt
	}
	if created.ExifStatus == "" {
		created.ExifStatus = ExifMissing
	}
	if created.Latitude != nil && created.Longitude != nil && proj.Latitude != nil && proj.Longitude != nil {
		d := HaversineMeters(*created.Latitude, *created.Longitude, *proj.Latitude, *proj.Longitude)
		created.DistanceFromProjectM = &d
	}

	stored := created
	s.reports = append(s.reports, &stored)
	if _, exists := s.media[stored.ID]; !exists {
		s.media[stored.ID] = []*Media{}
	}

	if enqueue {
		s.verificationItems = append(s.verificationItems, VerificationItem{
			ID:          uuid.NewString(),
			ItemType:    "laporan_kondisi",
			ReportID:    stored.ID,
			Status:      string(StatusMenunggu),
			TargetVotes: 3,
			CreatedAt:   now,
		})
	}

	return s.snapshotLocked(&stored), nil
}

// FindByID returns a copy of the report with its attached media and evidence
// count, or ErrNotFound.
func (s *MemoryStore) FindByID(ctx context.Context, reportID string) (*Report, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, r := range s.reports {
		if r.ID == reportID {
			return s.snapshotLocked(r), nil
		}
	}
	return nil, ErrNotFound
}

// Submit transitions a draft report to menunggu and creates a verification
// item (§6.12).
func (s *MemoryStore) Submit(ctx context.Context, reportID string, submittedAt time.Time) (*Report, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for _, r := range s.reports {
		if r.ID != reportID {
			continue
		}
		if r.Status != StatusDraft {
			return nil, ErrNotDraft
		}
		ts := submittedAt.UTC()
		r.Status = StatusMenunggu
		r.SubmittedAt = &ts
		r.UpdatedAt = ts
		if r.DistanceFromProjectM == nil && r.Latitude != nil && r.Longitude != nil {
			if proj, ok := s.projects[r.ProjectID]; ok && proj.Latitude != nil && proj.Longitude != nil {
				d := HaversineMeters(*r.Latitude, *r.Longitude, *proj.Latitude, *proj.Longitude)
				r.DistanceFromProjectM = &d
			}
		}
		s.verificationItems = append(s.verificationItems, VerificationItem{
			ID:          uuid.NewString(),
			ItemType:    "laporan_kondisi",
			ReportID:    r.ID,
			Status:      string(StatusMenunggu),
			TargetVotes: 3,
			CreatedAt:   ts,
		})
		return s.snapshotLocked(r), nil
	}
	return nil, ErrNotFound
}

func (s *MemoryStore) snapshotLocked(r *Report) *Report {
	copied := *r
	copied.Media = []*Media{}
	for _, m := range s.media[r.ID] {
		cm := *m
		copied.Media = append(copied.Media, &cm)
	}
	copied.EvidencesCount = s.evidences[r.ID]
	return &copied
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
		result.Data = append(result.Data, s.snapshotLocked(r))
	}
	result.Meta.HasNext = end < len(mine)
	return result, nil
}
