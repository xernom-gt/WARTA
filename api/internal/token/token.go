// Package token issues and verifies the API's bearer JWTs.
//
// Contract (api-requirements.md §3.1, §13.2):
//   - HS256 signing, issued by POST /auth/login, 3600s lifetime by default.
//   - Expired tokens are reported distinctly via ErrExpired so handlers can
//     return the catalogue code token_expired (§9.2).
//   - The subject claim is the user's UUID; no personal data rides in tokens.
package token

import (
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// Algorithm is the only signing algorithm the API accepts.
const Algorithm = "HS256"

// Issuer identifies tokens minted by this service.
const Issuer = "warta-api"

var (
	// ErrExpired marks a token whose exp has passed.
	ErrExpired = errors.New("token: expired")

	// ErrInvalid marks missing, malformed, tampered, or wrong-signature
	// tokens, plus any claim-shape surprise.
	ErrInvalid = errors.New("token: invalid")
)

// Manager signs and verifies HS256 access tokens.
type Manager struct {
	secret []byte
	ttl    time.Duration
	now    func() time.Time
}

// NewManager builds a Manager with the system clock.
func NewManager(secret string, ttl time.Duration) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl, now: time.Now}
}

// NewManagerWithClock builds a Manager with an injectable clock for tests.
func NewManagerWithClock(secret string, ttl time.Duration, now func() time.Time) *Manager {
	return &Manager{secret: []byte(secret), ttl: ttl, now: now}
}

// TTL is the configured token lifetime.
func (m *Manager) TTL() time.Duration { return m.ttl }

// Issue mints an access token for the given user ID.
func (m *Manager) Issue(userID string) (string, error) {
	now := m.now()
	claims := jwt.RegisteredClaims{
		Issuer:    Issuer,
		Subject:   userID,
		ID:        uuid.New().String(), // jti claim for revocation
		IssuedAt:  jwt.NewNumericDate(now),
		ExpiresAt: jwt.NewNumericDate(now.Add(m.ttl)),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(m.secret)
}

// Verify returns the user ID carried by the token, or ErrExpired/ErrInvalid.
func (m *Manager) Verify(raw string) (string, error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{Algorithm}),
		jwt.WithIssuer(Issuer),
		jwt.WithExpirationRequired(),
	)
	parsed, err := parser.ParseWithClaims(raw, &jwt.RegisteredClaims{}, func(*jwt.Token) (any, error) {
		return m.secret, nil
	})
	if err != nil {
		if errors.Is(err, jwt.ErrTokenExpired) {
			return "", ErrExpired
		}
		return "", ErrInvalid
	}
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok || claims.Subject == "" {
		return "", ErrInvalid
	}
	return claims.Subject, nil
}

// ExtractJTI returns the JWT ID (jti) claim from a token without verifying signature.
// Used by the blocklist middleware to identify tokens for revocation checks.
func (m *Manager) ExtractJTI(raw string) (string, error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{Algorithm}),
		jwt.WithIssuer(Issuer),
	)
	parsed, err := parser.ParseWithClaims(raw, &jwt.RegisteredClaims{}, func(*jwt.Token) (any, error) {
		return m.secret, nil
	})
	if err != nil {
		return "", ErrInvalid
	}
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok || claims.ID == "" {
		return "", ErrInvalid
	}
	return claims.ID, nil
}

// ExtractExpiry returns the token's expiry time (exp claim) without verifying
// the signature. Returns ErrInvalid if the token is malformed or missing exp.
func (m *Manager) ExtractExpiry(raw string) (time.Time, error) {
	parser := jwt.NewParser(
		jwt.WithValidMethods([]string{Algorithm}),
		jwt.WithIssuer(Issuer),
	)
	parsed, err := parser.ParseWithClaims(raw, &jwt.RegisteredClaims{}, func(*jwt.Token) (any, error) {
		return m.secret, nil
	})
	if err != nil {
		return time.Time{}, ErrInvalid
	}
	claims, ok := parsed.Claims.(*jwt.RegisteredClaims)
	if !ok || claims.ExpiresAt == nil {
		return time.Time{}, ErrInvalid
	}
	return claims.ExpiresAt.Time, nil
}
