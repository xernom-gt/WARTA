// Package user defines the citizen model and its persistence interface.
// Columns mirror docs/database/database-design.md §3.1.
package user

import (
	"context"
	"errors"
	"time"
)

// User is a row in the users table.
type User struct {
	ID              string
	DisplayName     string
	Email           string
	PasswordHash    string
	IsActive        bool
	EmailVerifiedAt *time.Time
	CreatedAt       time.Time
	UpdatedAt       time.Time
}

// ErrNotFound is returned by lookups when no row matches.
var ErrNotFound = errors.New("user: not found")

// ErrAlreadyVerified is returned when the account already has
// email_verified_at set and the caller asked to verify again (§6.20: this is
// the catalogue's 409 email_already_verified, distinguishable on the outside
// from an unknown row).
var ErrAlreadyVerified = errors.New("user: email already verified")

// DuplicateField identifies which unique column rejected an insert.
// The rendered error message forms the catalogue 409 body (§9.2: conflict).
type DuplicateField string

// Valid duplicate-field values.
const (
	DuplicateDisplayName DuplicateField = "display_name"
	DuplicateEmail       DuplicateField = "email"
)

// Field returns the public JSON field name for the duplicate.
func (d DuplicateField) Field() string { return string(d) }

// DuplicateError wraps a persisted unique-constraint violation.
type DuplicateError struct{ Field DuplicateField }

func (e *DuplicateError) Error() string { return "user: duplicate " + e.Field.Field() }

// Store persists and looks up citizens. Implementations must enforce the
// case-insensitive uniqueness of display_name and email with database
// constraints as the authority, not just pre-checks (api-guidelines §4.6).
type Store interface {
	// Create inserts a new user. The implementation assigns ID, CreatedAt
	// and UpdatedAt, and returns *DuplicateError on unique violations.
	Create(ctx context.Context, u *User) error

	// FindByEmail performs a case-insensitive match on email.
	FindByEmail(ctx context.Context, email string) (*User, error)

	// FindByID performs an exact match on the UUID primary key.
	FindByID(ctx context.Context, id string) (*User, error)

	// UpdateDisplayName updates the user's display name. The implementation
	// must enforce case-insensitive uniqueness and return *DuplicateError
	// on conflict. Returns ErrNotFound if the user doesn't exist.
	UpdateDisplayName(ctx context.Context, id, displayName string) (*User, error)

	// Deactivate sets is_active = false. Returns ErrNotFound if the user
	// doesn't exist.
	Deactivate(ctx context.Context, id string) (*User, error)

	// MarkEmailVerified stamps the first verification time and returns the
	// updated row. An account already carrying email_verified_at yields
	// *ErrAlreadyVerified; a missing row yields ErrNotFound. The guard
	// `email_verified_at IS NULL` makes the stamp write-once.
	MarkEmailVerified(ctx context.Context, id string, at time.Time) (*User, error)
}
