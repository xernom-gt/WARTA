package authtoken

import (
	"context"
	"sync"
	"time"

	"github.com/google/uuid"
)

// MemoryStore is an in-process Store mirroring the PostgreSQL semantics so
// handler tests exercise invalidate-on-issue and single-use consumption
// without a database.
type MemoryStore struct {
	mu     sync.Mutex
	tokens map[string]*Token // token_hash -> token (§7 unique index)
}

// NewMemoryStore builds an empty store.
func NewMemoryStore() *MemoryStore {
	return &MemoryStore{tokens: make(map[string]*Token)}
}

// Issue stamps the account's unused same-purpose tokens used (§3.15), then
// inserts. The 30-day retention sweep is a database concern; the mirror
// keeps expiry checks only.
func (s *MemoryStore) Issue(_ context.Context, t *Token) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now().UTC()
	}
	for hash, tok := range s.tokens {
		if tok.UserID == t.UserID && tok.Purpose == t.Purpose && tok.UsedAt == nil {
			stamped := *tok
			at := t.CreatedAt
			stamped.UsedAt = &at
			s.tokens[hash] = &stamped
		}
	}
	stored := *t
	s.tokens[t.TokenHash] = &stored
	return nil
}

// Consume flips used_at for exactly one call per token (§3.15).
func (s *MemoryStore) Consume(_ context.Context, raw, purpose string, now time.Time) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	tok, ok := s.tokens[Hash(raw)]
	if !ok || tok.UsedAt != nil || tok.Purpose != purpose || !tok.ExpiresAt.After(now) {
		return "", ErrInvalidToken
	}
	stamped := *tok
	at := now.UTC()
	stamped.UsedAt = &at
	s.tokens[tok.TokenHash] = &stamped
	return stamped.UserID, nil
}
