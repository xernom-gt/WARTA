// Package mailer delivers transactional email (api-requirements §3.5). The
// Service abstraction keeps handlers transport-agnostic: SMTP when a host is
// configured, a console fallback that prints every message into the server
// log for local development.
package mailer

import (
	"context"
	"sync"
)

// Email is one outgoing message. Text is always required; HTML is optional
// and only used by transports that can carry a multipurpose body.
type Email struct {
	From    string // RFC 5322 form, e.g. `WARTA <no-reply@warta.id>`
	To      string
	Subject string
	Text    string
	HTML    string
}

// Service is the transport-agnostic delivery interface. Senders treat
// failures as send failures only: the HTTP-visible consequence stays with
// the caller per contract (§6.1 register and §6.21 resend answer regardless
// of delivery, so an SMTP outage never voids an already-created account).
type Service interface {
	Send(ctx context.Context, e Email) error
}

// Recorder is a Service that keeps messages in memory instead of delivering
// them. It is the test double for assertion suites and a last-resort probe.
type Recorder struct {
	// Fail, when non-nil, makes Send return it without recording — the
	// broken-outage case handlers must survive without abandoning success.
	Fail error

	mu   sync.Mutex
	sent []Email
}

// Send records the message verbatim (or surfaces Fail).
func (r *Recorder) Send(_ context.Context, e Email) error {
	if r.Fail != nil {
		return r.Fail
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	r.sent = append(r.sent, e)
	return nil
}

// Sent returns a copy of the recorded messages in send order.
func (r *Recorder) Sent() []Email {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]Email, len(r.sent))
	copy(out, r.sent)
	return out
}
