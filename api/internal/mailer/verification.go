package mailer

import "fmt"

// VerificationEmail is the confirm-your-address message (§3.5, §6.20): the
// body names the account and carries the single-use link exactly once, so
// no other artefact reproduces it. The link's validity (24h) is enforced by
// the token store, not stated claims.
func VerificationEmail(from, to, displayName, verifyLink string) Email {
	subject := "Verifikasi surel akun WARTA Anda"
	text := "Halo " + displayName + ",\n\n" +
		"Konfirmasikan bahwa surel ini milik akun WARTA Anda. " +
		"Tautan berikut berlaku 24 jam dan hanya dapat dipakai sekali:\n\n" +
		verifyLink + "\n\n" +
		"Jika Anda tidak membuat akun ini, abaikan surel ini.\n\n" +
		"WARTA — Transparansi Infrastruktur DKI Jakarta"
	html := "<!DOCTYPE html>\n<html lang=\"id\">\n<body>\n" +
		fmt.Sprintf("<p>Halo %s,</p>\n", displayName) +
		"<p>Konfirmasikan bahwa surel ini milik akun WARTA Anda. " +
		"Tautan berikut berlaku 24 jam dan hanya dapat dipakai sekali:</p>\n" +
		fmt.Sprintf("<p><a href=\"%s\">Verifikasi surel</a></p>\n", verifyLink) +
		"<p>Jika Anda tidak membuat akun ini, abaikan surel ini.</p>\n" +
		"<p>WARTA — Transparansi Infrastruktur DKI Jakarta</p>\n</body>\n</html>"
	return Email{
		From:    from,
		To:      to,
		Subject: subject,
		Text:    text,
		HTML:    html,
	}
}
