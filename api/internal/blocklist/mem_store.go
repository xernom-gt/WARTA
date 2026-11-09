package blocklist

import (
	"context"
	"sync"
	"time"
)

// MemStore is an in-memory blocklist for revoked token JTIs.
// Suitable for single-instance deployments; replace with a shared store (Redis, PG)
// for multi-instance deployments.
type MemStore struct {
	mu    sync.RWMutex
	items map[string]time.Time // jti -> expiresAt
}

// NewMemStore creates a new in-memory blocklist.
func NewMemStore() *MemStore {
	return &MemStore{items: make(map[string]time.Time)}
}

// Add inserts a token jti with its expiry.
func (s *MemStore) Add(ctx context.Context, jti string, expiresAt time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.items[jti] = expiresAt
	return nil
}

// Contains checks if a token jti is currently revoked.
func (s *MemStore) Contains(ctx context.Context, jti string) (bool, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	expiresAt, ok := s.items[jti]
	if !ok {
		return false, nil
	}
	if time.Now().After(expiresAt) {
		// Expired entry, clean it up lazily
		delete(s.items, jti)
		return false, nil
	}
	return true, nil
}

// Cleanup removes all expired entries.
func (s *MemStore) Cleanup(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for jti, expiresAt := range s.items {
		if now.After(expiresAt) {
			delete(s.items, jti)
		}
	}
	return nil
}