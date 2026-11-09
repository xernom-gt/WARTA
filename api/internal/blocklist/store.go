package blocklist

import (
	"context"
	"time"
)

// Store persists revoked token identifiers (jti) with their expiry.
// Implementations must be safe for concurrent use.
type Store interface {
	// Add inserts a token jti into the blocklist with the given expiry.
	// The token must be considered revoked from this point until expiry passes.
	Add(ctx context.Context, jti string, expiresAt time.Time) error

	// Contains reports whether a token jti is currently revoked (present and not expired).
	Contains(ctx context.Context, jti string) (bool, error)

	// Cleanup removes expired entries. Called periodically or on startup.
	Cleanup(ctx context.Context) error
}