package user

import (
	"context"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemoryStore is an in-process Store. It mirrors the PostgreSQL constraints
// (case-insensitive uniqueness of display_name and email) so handler tests
// exercise the same conflict paths without a database.
type MemoryStore struct {
	mu     sync.RWMutex
	byID   map[string]*User
	byMail map[string]string // lower(email)        -> id
	byName map[string]string // lower(display_name) -> id
}

// NewMemoryStore builds an empty store ready for seeding in tests.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		byID:   make(map[string]*User),
		byMail: make(map[string]string),
		byName: make(map[string]string),
	}
}

// MustAdd seeds the store, failing fast so tests crash loudly on bad data.
func (s *MemoryStore) MustAdd(u User) *User {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	if _, clash := s.byMail[strings.ToLower(u.Email)]; clash {
		panic("memstore: seed email conflict")
	}
	if _, clash := s.byName[strings.ToLower(u.DisplayName)]; clash {
		panic("memstore: seed display name conflict")
	}
	stored := u
	s.byID[u.ID] = &stored
	s.byMail[strings.ToLower(u.Email)] = u.ID
	s.byName[strings.ToLower(u.DisplayName)] = u.ID
	return &stored
}

// Create assigns ID and timestamps, enforcing database-like uniqueness.
func (s *MemoryStore) Create(_ context.Context, u *User) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	u.CreatedAt, u.UpdatedAt = now, now

	if _, clash := s.byName[strings.ToLower(u.DisplayName)]; clash {
		return &DuplicateError{Field: DuplicateDisplayName}
	}
	if _, clash := s.byMail[strings.ToLower(u.Email)]; clash {
		return &DuplicateError{Field: DuplicateEmail}
	}

	stored := *u
	s.byID[u.ID] = &stored
	s.byMail[strings.ToLower(u.Email)] = u.ID
	s.byName[strings.ToLower(u.DisplayName)] = u.ID
	return nil
}

// FindByEmail matches case-insensitively like the M1 unique index.
func (s *MemoryStore) FindByEmail(_ context.Context, email string) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	id, ok := s.byMail[strings.ToLower(email)]
	if !ok {
		return nil, ErrNotFound
	}
	stored := *s.byID[id]
	return &stored, nil
}

// FindByID matches the UUID primary key exactly.
func (s *MemoryStore) FindByID(_ context.Context, id string) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if u, ok := s.byID[id]; ok {
		stored := *u
		return &stored, nil
	}
	return nil, ErrNotFound
}

// MarkEmailVerified mirrors the PG store: write-once guard separating
// already-verified (ErrAlreadyVerified) from missing rows (ErrNotFound).
func (s *MemoryStore) MarkEmailVerified(_ context.Context, id string, at time.Time) (*User, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	u, ok := s.byID[id]
	if !ok {
		return nil, ErrNotFound
	}
	if u.EmailVerifiedAt != nil {
		return nil, ErrAlreadyVerified
	}
	stored := *u
	stamp := at.UTC()
	stored.EmailVerifiedAt = &stamp
	stored.UpdatedAt = stamp // stand-in for the M1 updated_at trigger
	s.byID[id] = &stored
	return &stored, nil
}
