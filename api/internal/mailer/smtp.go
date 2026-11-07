package mailer

import (
	"bytes"
	"context"
	"crypto/tls"
	"fmt"
	"net"
	"net/mail"
	"net/smtp"
	"strconv"
	"time"
)

// SMTP delivers over an external mail server (§3.5). Port 465 speaks
// implicit TLS; every other port relies on smtp.SendMail's opportunistic
// STARTTLS upgrade. Credentials are optional: unauthenticated relays still
// work, and PLAIN auth is sent only when the server advertises it.
type SMTP struct {
	Host     string
	Port     int
	Username string
	Password string
}

// NewSMTP builds the transport with sane defaults applied by config.
func NewSMTP(host string, port int, username, password string) SMTP {
	return SMTP{Host: host, Port: port, Username: username, Password: password}
}

// Send routes the message through the configured server. The context is not
// honoured by net/smtp; the per-connection deadline instead bounds abuse.
func (s SMTP) Send(_ context.Context, e Email) error {
	from, err := envelopeAddress(e.From)
	if err != nil {
		return fmt.Errorf("mailer: from header %q: %w", e.From, err)
	}
	addr := net.JoinHostPort(s.Host, strconv.Itoa(s.Port))
	msg := buildMessage(e)
	if s.Port == 465 {
		return s.sendImplicitTLS(addr, from, e, msg)
	}
	return smtp.SendMail(addr, s.auth(), from, []string{e.To}, msg)
}

// sendImplicitTLS dials TLS from the first byte (port 465 style) and walks
// the same dialog smtp.SendMail would have run.
func (s SMTP) sendImplicitTLS(addr, from string, e Email, msg []byte) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: s.Host})
	if err != nil {
		return fmt.Errorf("mailer: dial %s: %w", addr, err)
	}
	defer conn.Close()

	client, err := smtp.NewClient(conn, s.Host)
	if err != nil {
		return fmt.Errorf("mailer: hello %s: %w", s.Host, err)
	}
	defer client.Close()

	if err := client.Mail(from); err != nil {
		return fmt.Errorf("mailer: mail from: %w", err)
	}
	if err := client.Rcpt(e.To); err != nil {
		return fmt.Errorf("mailer: rcpt to: %w", err)
	}
	w, err := client.Data()
	if err != nil {
		return fmt.Errorf("mailer: data: %w", err)
	}
	if _, err := w.Write(msg); err != nil {
		w.Close()
		return fmt.Errorf("mailer: body: %w", err)
	}
	if err := w.Close(); err != nil {
		return fmt.Errorf("mailer: body: %w", err)
	}
	return client.Quit()
}

// auth builds the PLAIN mechanism only when credentials are configured.
func (s SMTP) auth() smtp.Auth {
	if s.Username == "" && s.Password == "" {
		return nil
	}
	return smtp.PlainAuth("", s.Username, s.Password, s.Host)
}

// envelopeAddress strips the display name: `WARTA <no-reply@warta.id>` is a
// header form, while the SMTP dialog needs the bare address.
func envelopeAddress(from string) (string, error) {
	addr, err := mail.ParseAddress(from)
	if err != nil {
		return "", err
	}
	return addr.Address, nil
}

// buildMessage renders the wire format: headers, then plain text, or a
// multipart/alternative body when an HTML twin is present.
func buildMessage(e Email) []byte {
	buf := &bytes.Buffer{}
	fmt.Fprintf(buf, "From: %s\r\n", e.From)
	fmt.Fprintf(buf, "To: %s\r\n", e.To)
	fmt.Fprintf(buf, "Subject: %s\r\n", e.Subject)
	fmt.Fprintf(buf, "Date: %s\r\n", time.Now().Format(time.RFC1123Z))
	fmt.Fprintf(buf, "MIME-Version: 1.0\r\n")

	if e.HTML == "" {
		buf.WriteString("Content-Type: text/plain; charset=UTF-8\r\n\r\n")
		buf.WriteString(e.Text)
	} else {
		boundary := fmt.Sprintf("warta-mail-%d", time.Now().UnixNano())
		fmt.Fprintf(buf, "Content-Type: multipart/alternative; boundary=%q\r\n\r\n", boundary)
		fmt.Fprintf(buf, "--%s\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s\r\n", boundary, e.Text)
		fmt.Fprintf(buf, "--%s\r\nContent-Type: text/html; charset=UTF-8\r\n\r\n%s\r\n", boundary, e.HTML)
		fmt.Fprintf(buf, "--%s--\r\n", boundary)
	}
	return buf.Bytes()
}
