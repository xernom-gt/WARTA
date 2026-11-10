package httpx

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"strings"

	"github.com/gofiber/fiber/v3"
)

// HeaderETag is the entity-tag header of cacheable public GETs
// (api-guidelines §3.9).
const HeaderETag = "ETag"

// DataETag sends a success response wrapped in the top-level "data"
// envelope, stamped with an opaque strong ETag derived from the response
// body (openapi GET /projects and GET /projects/{id} declare the header).
// When the request's If-None-Match matches — exact, weak, or `*` — the body
// is withheld and 304 sent instead (§3.10). Marshaling happens once, so the
// header always describes the bytes on the wire.
func DataETag(c fiber.Ctx, payload any) error {
	return EnvelopeETag(c, fiber.Map{"data": payload})
}

// EnvelopeETag is DataETag for custom envelopes — list pages pass
// {"data", "meta"} so the tag covers the whole representation.
func EnvelopeETag(c fiber.Ctx, envelope fiber.Map) error {
	body, err := json.Marshal(envelope)
	if err != nil {
		return err
	}
	sum := sha256.Sum256(body)
	tag := `"` + hex.EncodeToString(sum[:16]) + `"`
	resp := c.Response()
	resp.Header.SetContentType("application/json")
	resp.Header.Set(HeaderETag, tag)
	if ifNoneMatch(c, tag) {
		resp.Reset()
		resp.SetStatusCode(fiber.StatusNotModified)
		return nil
	}
	resp.SetStatusCode(fiber.StatusOK)
	resp.SetBodyRaw(body)
	return nil
}

// ifNoneMatch implements §3.10's 304 precondition: any listed opaque tag
// (weak or strong) matching the current tag counts, and a bare `*` matches
// whatever the client thinks it has.
func ifNoneMatch(c fiber.Ctx, tag string) bool {
	raw := strings.TrimSpace(string(c.Request().Header.Peek("If-None-Match")))
	if raw == "" {
		return false
	}
	for _, entry := range strings.Split(raw, ",") {
		entry = strings.TrimSpace(entry)
		entry = strings.TrimPrefix(entry, "W/")
		if entry == "*" || strings.EqualFold(entry, tag) {
			return true
		}
	}
	return false
}
