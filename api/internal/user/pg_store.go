package user

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// PGStore persists users in PostgreSQL. Uniqueness is enforced by the
// case-insensitive unique indexes from migration M1, which are the authority
// for 409 conflicts (api-guidelines §4.6).
type PGStore struct {
	pool *pgxpool.Pool
}

// NewPGStore wraps an existing connection pool.
func NewPGStore(pool *pgxpool.Pool) *PGStore { return &PGStore{pool: pool} }

const userColumns = `id, display_name, email, password_hash,
	is_active, email_verified_at, created_at, updated_at`

// Create inserts a new citizen. It assigns the UUID and timestamps that the
// server owns (api-requirements §2.5) and maps unique-constraint violations
// onto *DuplicateError.
func (s *PGStore) Create(ctx context.Context, u *User) error {
	if u.ID == "" {
		u.ID = uuid.NewString()
	}
	now := time.Now().UTC()
	u.CreatedAt, u.UpdatedAt = now, now

	_, err := s.pool.Exec(ctx, `
		INSERT INTO users (id, display_name, email, password_hash, is_active,
		                   email_verified_at, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		u.ID, u.DisplayName, u.Email, u.PasswordHash, u.IsActive,
		u.EmailVerifiedAt, u.CreatedAt, u.UpdatedAt)
	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return duplicateFromConstraint(pgErr.ConstraintName)
		}
		return err
	}
	return nil
}

// duplicateFromConstraint maps M1's unique index names to public fields.
func duplicateFromConstraint(constraint string) error {
	switch constraint {
	case "users_display_name_ci_key":
		return &DuplicateError{Field: DuplicateDisplayName}
	case "users_email_ci_key":
		return &DuplicateError{Field: DuplicateEmail}
	default:
		return &DuplicateError{Field: DuplicateEmail}
	}
}

// FindByEmail matches case-insensitively, mirroring the unique index.
func (s *PGStore) FindByEmail(ctx context.Context, email string) (*User, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+userColumns+`
		FROM users WHERE lower(email) = lower($1) LIMIT 1`, email)
	return scanOne(row)
}

// FindByID matches the UUID primary key exactly. Malformed UUIDs simply do
// not match (the cast fails silently); callers decide how missing rows and
// bad shapes map onto the error catalogue.
func (s *PGStore) FindByID(ctx context.Context, id string) (*User, error) {
	row := s.pool.QueryRow(ctx, `SELECT `+userColumns+`
		FROM users WHERE id = $1::uuid LIMIT 1`, id)
	return scanOne(row)
}

// scanOne normalises "no rows" into ErrNotFound for every lookup query.
func scanOne(row pgx.Row) (*User, error) {
	u := &User{}
	err := row.Scan(&u.ID, &u.DisplayName, &u.Email, &u.PasswordHash,
		&u.IsActive, &u.EmailVerifiedAt, &u.CreatedAt, &u.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return u, nil
}
