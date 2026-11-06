// Package password hashes and verifies citizen passwords.
//
// bcrypt is the hashing algorithm (api-requirements.md §13.2 requires a
// memory-hard algorithm; the 72-byte boundary belongs to bcrypt, §8.1).
// Passwords longer than 72 bytes must be rejected before hashing so the
// boundary never silently truncates.
package password

import "golang.org/x/crypto/bcrypt"

// MaxBytes is the bcrypt input boundary (api-requirements.md §8.1: 8-72).
const MaxBytes = 72

// dummyHash is a valid bcrypt hash of an unrelated constant. It lets the
// login handler spend the same amount of CPU on a miss (unknown email) as on
// a hit, so response timing cannot reveal whether an email is registered
// (§9.3: "401 must not reveal whether an email exists").
var dummyHash = func() []byte {
	// A 15-char constant is well within the 72-byte boundary; generation
	// with DefaultCost cannot fail for it, but the error is checked anyway.
	h, err := bcrypt.GenerateFromPassword([]byte("warta-timing-equalizer"), bcrypt.DefaultCost)
	if err != nil {
		panic("password: bcrypt self-test failed: " + err.Error())
	}
	return h
}()

// Hash returns the bcrypt hash for a plaintext password. The caller is
// responsible for validating the password length before calling Hash.
func Hash(plain string) (string, error) {
	h, err := bcrypt.GenerateFromPassword([]byte(plain), bcrypt.DefaultCost)
	if err != nil {
		return "", err
	}
	return string(h), nil
}

// Compare reports whether the plaintext matches the stored hash.
func Compare(hash, plain string) bool {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(plain)) == nil
}

// Equalize burns the same bcrypt cost a successful comparison would spend.
// Login handlers call it when the account was not found.
func Equalize(plain string) {
	_ = bcrypt.CompareHashAndPassword(dummyHash, []byte(plain))
}
