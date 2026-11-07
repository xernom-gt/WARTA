package mailer

import (
	"context"
	"log"
)

// Console is the development transport: nothing leaves the process, and
// every message lands in the server log together with its single-use link,
// so local flows are testable without an SMTP server (§3.5).
type Console struct{}

// Send writes the full plain-text body to the standard logger. It reads the
// message only — logging is in-process, not a network failure surface.
func (Console) Send(_ context.Context, e Email) error {
	log.Printf("mailer(console): to=%s subject=%q\n-----\n\n%s\n-----",
		e.To, e.Subject, e.Text)
	return nil
}
