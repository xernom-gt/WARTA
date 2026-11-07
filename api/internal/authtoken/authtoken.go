// Package authtoken implements the hashed, single-use tokens of auth_tokens
// (database-design.md §3.15). The raw token exists exactly once — inside the
// verification email — while the store keeps only its SHA-256 hash, so a
// database leak cannot mint working links (api-requirements §3.5).
package authtoken

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"time"
)

// StandardTTL is the verification link lifetime (§3.5: 24 hours).
const StandardTTL = 24 * time.Hour

// EmailVerification is the §3.15 purpose value this package issues for. The
// purpose column intentionally has no CHECK constraint: password reset and
// later flows are meant to reuse the table without a schema change.
const EmailVerification = "email_verification"

// Token is one issued token. Raw is never persisted; TokenHash is the only
// representation the server keeps.
type Token struct {
	ID        string
	UserID    string
	Purpose   string
	TokenHash string
	ExpiresAt time.Time
	UsedAt    *time.Time
	CreatedAt time.Time
}

// New generates a fresh token for the account. The raw argument is what the
// email must carry; token is what Issue stores.
func New(userID, purpose string, now time.Time, ttl time.Duration) (raw string, token Token, err error) {
	entropy := make([]byte, 32)
	if _, err = rand.Read(entropy); err != nil {
		return "", Token{}, fmt.Errorf("authtoken: generate: %w", err)
	}
	// RawURLEncoding of 32 bytes: 43 URL-safe characters, no padding.
	raw = base64.RawURLEncoding.EncodeToString(entropy)
	return raw, Token{
		UserID:    userID,
		Purpose:   purpose,
		TokenHash: Hash(raw),
		ExpiresAt: now.Add(ttl),
		CreatedAt: now,
	}, nil
}

// Hash derives the stored representation of a raw token.
func Hash(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}
