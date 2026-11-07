package authtoken

import (
	"context"
	"errors"
	"time"
)

// ErrInvalidToken is returned by Consume for expired, used, unknown, or
// tampered tokens. Callers must not distinguish the cause (§3.15: reject
// without revealing which condition failed).
var ErrInvalidToken = errors.New("authtoken: invalid token")

// Store persists hashed tokens.
type Store interface {
	// Issue invalidates the account's earlier unused tokens of the same
	// purpose (§3.15) and inserts t in their place. Where the backend allows
	// it the two steps commit together, so a crash never leaves both the old
	// and the new token live.
	Issue(ctx context.Context, t *Token) error

	// Consume atomically marks a token used and returns the account it was
	// issued for. Issuance candidates may race on the same raw token, but it
	// is usable exactly once; every loser gets ErrInvalidToken.
	Consume(ctx context.Context, raw, purpose string, now time.Time) (userID string, err error)
}
