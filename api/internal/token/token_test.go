package token

import (
	"testing"
	"time"
)

func TestIssueAndVerifyRoundTrip(t *testing.T) {
	m := NewManager("test-secret-0123456789abcdef", time.Hour)
	subject := "0f0f0f0f-0000-4000-8000-000000000001"

	issued, err := m.Issue(subject)
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	got, err := m.Verify(issued)
	if err != nil {
		t.Fatalf("verify: %v", err)
	}
	if got != subject {
		t.Fatalf("subject mismatch: got %q want %q", got, subject)
	}
}

func TestVerifyRejectsTamperedToken(t *testing.T) {
	m := NewManager("test-secret-0123456789abcdef", time.Hour)
	issued, err := m.Issue("some-user")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}

	// Flip a character in the signature so the MAC no longer matches.
	tampered := issued[:len(issued)-2] + "aa"
	if _, err := m.Verify(tampered); err != ErrInvalid {
		t.Fatalf("want ErrInvalid, got %v", err)
	}
}

func TestVerifyRejectsExpiredToken(t *testing.T) {
	now := time.Now()
	m := NewManagerWithClock("test-secret-0123456789abcdef", -time.Second, func() time.Time { return now })

	issued, err := m.Issue("some-user")
	if err != nil {
		t.Fatalf("issue: %v", err)
	}
	if _, err := m.Verify(issued); err != ErrExpired {
		t.Fatalf("want ErrExpired, got %v", err)
	}
}

func TestVerifyRejectsUnexpectedAlgorithm(t *testing.T) {
	// A token signed with a different MAC key rings the valid-methods check:
	// algorithm confusion must never pass HS256-only verification.
	m := NewManager("test-secret-0123456789abcdef", time.Hour)
	forged := "eyJhbGciOiJIUzM4NCIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1In0.sig"
	if _, err := m.Verify(forged); err != ErrInvalid {
		t.Fatalf("want ErrInvalid, got %v", err)
	}
}

func TestTTLMatchesExpirySpacing(t *testing.T) {
	ttl := 90 * time.Minute
	m := NewManager("test-secret-0123456789abcdef", ttl)
	if m.TTL() != ttl {
		t.Fatalf("ttl mismatch: got %v want %v", m.TTL(), ttl)
	}
}
