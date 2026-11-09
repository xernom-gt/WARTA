// Package auth implements the HTTP handlers of /auth/* (register, login,
// me, verify-email, resend-verification) per docs/api/api-requirements.md
// §6.1-6.3, §6.20-6.21 and the response shapes pinned in
// docs/api/openapi.yaml (AuthToken, AuthUser, UserPrivate).
package auth

import (
	"regexp"
	"strings"

	"warta.com/api/internal/httpx"
)

// registerRequest mirrors openapi.yaml RegisterRequest.
type registerRequest struct {
	DisplayName string `json:"display_name"`
	Email       string `json:"email"`
	Password    string `json:"password"`
}

// loginRequest mirrors openapi.yaml LoginRequest.
type loginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// verifyEmailRequest mirrors openapi.yaml VerifyEmailRequest.
type verifyEmailRequest struct {
	Token string `json:"token"`
}

// displayNameRe is the canonical identity rule (§8.1): 3-24 chars, letters,
// numbers, underscore.
var displayNameRe = regexp.MustCompile(`^[A-Za-z0-9_]{3,24}$`)

// emailRe is the pragmatic RFC-5322 subset used for input gating: one @,
// no spaces or control bytes, and a non-empty domain with a dot. It stays
// deliberately loose because the authoritative uniqueness check happens in
// the database under a case-insensitive unique index.
var emailRe = regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`)

// maxEmailLen is pinned by the schema (VARCHAR(255)) and RegisterRequest.
const maxEmailLen = 255

// validateRegister checks every field and collects all failures at once
// (api-guidelines §4.3: never stop at the first failing field).
// It normalises email (trim + lowercase) in place, per §8.1.
func validateRegister(r *registerRequest) []httpx.FieldError {
	var details []httpx.FieldError

	if !displayNameRe.MatchString(r.DisplayName) {
		details = append(details, httpx.FieldError{
			Field:   "display_name",
			Message: "Must be 3-24 characters: letters, numbers, or underscore.",
		})
	}

	r.Email = strings.ToLower(strings.TrimSpace(r.Email))
	switch {
	case r.Email == "":
		details = append(details, emailDetail("Email is required."))
	case len(r.Email) > maxEmailLen:
		details = append(details, emailDetail("Must be at most 255 characters."))
	case !emailRe.MatchString(r.Email):
		details = append(details, emailDetail("Must be a valid email address."))
	}

	if n := len(r.Password); n < 8 || n > 72 {
		details = append(details, passwordDetail(
			"Must be between 8 and 72 characters."))
	}

	return details
}

// validateLogin applies the same email normalisation and positivity checks
// to credentials. Note the 8-72 rule is a registration rule only: any
// non-empty password is validated, real checks happen in the database, and a
// wrong guess produces the generic 401 (§9.3).
func validateLogin(r *loginRequest) []httpx.FieldError {
	var details []httpx.FieldError

	r.Email = strings.ToLower(strings.TrimSpace(r.Email))
	switch {
	case r.Email == "":
		details = append(details, emailDetail("Email is required."))
	case len(r.Email) > maxEmailLen:
		details = append(details, emailDetail("Must be at most 255 characters."))
	case !emailRe.MatchString(r.Email):
		details = append(details, emailDetail("Must be a valid email address."))
	}

	if r.Password == "" {
		details = append(details, passwordDetail("Password is required."))
	}

	return details
}

func emailDetail(message string) httpx.FieldError {
	return httpx.FieldError{Field: "email", Message: message}
}

func passwordDetail(message string) httpx.FieldError {
	return httpx.FieldError{Field: "password", Message: message}
}

// maxVerifyTokenLen bounds the token to the token_hash column width. The
// real raw token is 43 characters; the cap only stops abuse bodies from
// ballooning parsing, every token *meaning* problem is answered by the
// store with the uniform 422 (§3.15).
const maxVerifyTokenLen = 255

// validateVerifyEmail checks presence and size only: expired, used, or
// tampered tokens are indistinguishable by design (§3.15) and are detected
// where the truth lives — the store consume — not in field details.
func validateVerifyEmail(r *verifyEmailRequest) []httpx.FieldError {
	var details []httpx.FieldError
	switch {
	case r.Token == "":
		details = append(details, httpx.FieldError{
			Field:   "token",
			Message: "Token is required.",
		})
	case len(r.Token) > maxVerifyTokenLen:
		details = append(details, httpx.FieldError{
			Field:   "token",
			Message: "Must be at most 255 characters.",
		})
	}
	return details
}
