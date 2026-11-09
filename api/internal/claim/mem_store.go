package claim

import (
	"context"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemoryStore is the in-memory Store used by handler tests.
type MemoryStore struct {
	mu                  sync.RWMutex
	claims              map[string]*Claim
	media               map[string]*Media // claim_id -> media
	projectHasAccepted  map[string]bool
	projectPrimaryCoords map[string][2]float64 // project_id -> [lat, lon]
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		claims:               map[string]*Claim{},
		media:                map[string]*Media{},
		projectHasAccepted:   map[string]bool{},
		projectPrimaryCoords: map[string][2]float64{},
	}
}

// Seed adds one claim fixture.
func (s *MemoryStore) Seed(c *Claim) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.claims[c.ID] = c
	if c.Status == StatusDiterima {
		s.projectHasAccepted[c.ProjectID] = true
	}
}

// SetProjectPrimaryCoords configures project primary coordinate for distance calculation.
func (s *MemoryStore) SetProjectPrimaryCoords(projectID string, lat, lon float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.projectPrimaryCoords[projectID] = [2]float64{lat, lon}
}

// ListByUser mirrors the query store.
func (s *MemoryStore) ListByUser(ctx context.Context, userID string, filter ListFilter) (*ListResult, error) {
	page, limit := clampPage(filter.Page, filter.Limit)

	s.mu.RLock()
	defer s.mu.RUnlock()

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

// Create inserts a new location claim in memory.
func (s *MemoryStore) Create(ctx context.Context, projectID, userID string, input CreateClaimInput) (*Claim, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.projectHasAccepted[projectID] {
		return nil, ErrProjectHasAcceptedClaim
	}

	var distM *float64
	if coords, ok := s.projectPrimaryCoords[projectID]; ok && input.Latitude != nil && input.Longitude != nil {
		d := HaversineDistanceM(coords[0], coords[1], *input.Latitude, *input.Longitude)
		distM = &d
	}

	now := time.Now().UTC()
	c := &Claim{
		ID:                   uuid.NewString(),
		ProjectID:            projectID,
		UserID:               userID,
		AuthorDisplayName:    "citizen",
		ProposedAddress:      input.ProposedAddress,
		AddressLine:          input.AddressLine,
		Kelurahan:            input.Kelurahan,
		Kecamatan:            input.Kecamatan,
		City:                 input.City,
		Landmark:             input.Landmark,
		ProposedPrecision:    input.ProposedPrecision,
		Latitude:             input.Latitude,
		Longitude:            input.Longitude,
		DistanceFromProjectM: distM,
		ExifStatus:           "missing",
		Status:               StatusMenunggu,
		CreatedAt:            now,
		UpdatedAt:            now,
	}

	s.claims[c.ID] = c
	return c, nil
}

// GetByID returns claim by ID.
func (s *MemoryStore) GetByID(ctx context.Context, claimID string) (*Claim, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c, ok := s.claims[claimID]
	if !ok {
		return nil, ErrNotFound
	}
	return c, nil
}

// GetMedia returns photo for claim.
func (s *MemoryStore) GetMedia(ctx context.Context, claimID string) (*Media, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	m, ok := s.media[claimID]
	if !ok {
		return nil, ErrMediaNotFound
	}
	return m, nil
}

// AddMedia attaches a photo. Max 1 photo.
func (s *MemoryStore) AddMedia(ctx context.Context, claimID string, m *Media) (*Media, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	c, ok := s.claims[claimID]
	if !ok {
		return nil, ErrNotFound
	}
	if _, exists := s.media[claimID]; exists {
		return nil, ErrPhotoLimitExceeded
	}

	now := time.Now().UTC()
	m.ID = uuid.NewString()
	m.ClaimID = claimID
	m.CreatedAt = now

	s.media[claimID] = m
	c.ExifStatus = "valid"
	return m, nil
}

// DeleteMedia deletes photo if claim is in status menunggu.
func (s *MemoryStore) DeleteMedia(ctx context.Context, claimID, mediaID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	c, ok := s.claims[claimID]
	if !ok {
		return ErrNotFound
	}
	if c.Status != StatusMenunggu {
		return ErrInvalidClaimState
	}

	m, ok := s.media[claimID]
	if !ok || m.ID != mediaID {
		return ErrMediaNotFound
	}

	delete(s.media, claimID)
	c.ExifStatus = "missing"
	return nil
}

// AcceptClaim handles consensus acceptance in memory.
func (s *MemoryStore) AcceptClaim(ctx context.Context, claimID string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	c, ok := s.claims[claimID]
	if !ok {
		return ErrNotFound
	}
	if s.projectHasAccepted[c.ProjectID] {
		return ErrProjectHasAcceptedClaim
	}

	now := time.Now().UTC()
	c.Status = StatusDiterima
	c.DecidedAt = &now
	s.projectHasAccepted[c.ProjectID] = true
	return nil
}
