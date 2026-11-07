package authtoken

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists tokens in PostgreSQL. Uniqueness of token_hash is the
// database's (§7 unique index), exactly like the users store pattern.
type PGStore struct{ pool *pgxpool.Pool }

// NewPGStore wraps an existing connection pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{pool: pool} }

// Issue is transactional: earlier unused tokens for the same account and
// purpose are stamped used_at in the same commit that inserts the new one,
// and tokens untouched past their 30-day retention window (database-design
// §data retention) are dropped so the table stays small for the whole flow.
func (s *PGStore) Issue(ctx context.Context, t *Token) error {
	if t.ID == "" {
		t.ID = uuid.NewString()
	}
	if t.CreatedAt.IsZero() {
		t.CreatedAt = time.Now().UTC()
	}

	tx, err := s.pool.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background()) // no-op after a successful Commit

	if _, err := tx.Exec(ctx, `
		UPDATE auth_tokens SET used_at = $1
		WHERE user_id = $2 AND purpose = $3 AND used_at IS NULL`,
		t.CreatedAt, t.UserID, t.Purpose); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		DELETE FROM auth_tokens WHERE expires_at < now() - interval '30 days'`); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO auth_tokens (id, user_id, purpose, token_hash,
		                         expires_at, used_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)`,
		t.ID, t.UserID, t.Purpose, t.TokenHash,
		t.ExpiresAt, t.UsedAt, t.CreatedAt); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// Consume is the single-use gate: one UPDATE that flips used_at only while
// the row is unused and unexpired, RETURNING the owner. Two concurrent
// verifications of one raw token can both run the statement, but only the
// first affects a row; the runner-up sees no rows (§3.15 uniform rejection).
func (s *PGStore) Consume(ctx context.Context, raw, purpose string, now time.Time) (string, error) {
	row := s.pool.QueryRow(ctx, `
		UPDATE auth_tokens SET used_at = $1
		WHERE token_hash = $2 AND purpose = $3
		  AND used_at IS NULL AND expires_at > $1
		RETURNING user_id`,
		now.UTC(), Hash(raw), purpose)
	var userID string
	err := row.Scan(&userID)
	switch {
	case errors.Is(err, pgx.ErrNoRows):
		return "", ErrInvalidToken
	case err != nil:
		return "", err
	default:
		return userID, nil
	}
}
