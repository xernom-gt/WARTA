// Package labels renders the human-readable derived labels the contract
// returns alongside canonical enum values (api-requirements §12.2,
// api-guidelines §3.6): rupiah formats for money, precision badges, and
// snake_case category labels. Labels are presentation-only; clients must
// never parse them back (api-guidelines §3.6).
package labels

import (
	"fmt"
	"math/big"
	"strings"
)

var (
	big100  = big.NewInt(100)
	bigHalf = big.NewInt(2)
)

// RupiahFull renders an exact decimal ("516020000000.00") as grouped rupiah
// with no fraction: "Rp516.020.000.000" (openapi ProjectDerived example).
// Unparsable input never happens for NUMERIC(20,2) columns; it falls back to
// "Rp0" rather than blanking a card.
func RupiahFull(decimal string) string {
	cents, ok := parseCents(decimal)
	if !ok {
		return "Rp0"
	}
	return "Rp" + groupDot(new(big.Int).Div(cents, big100))
}

// compactScales are the named units of the compact format, largest first
// (§12.2 "Indonesian compact rupiah format"). Amounts below one million keep
// the grouped form because compact rupiah never names hundreds/thousands.
var compactScales = []struct {
	exponent uint // 10^exponent rupiah per named unit
	name     string
}{
	{exponent: 12, name: "triliun"},
	{exponent: 9, name: "miliar"},
	{exponent: 6, name: "juta"},
}

// RupiahCompact renders an exact decimal as compact rupiah: the amount
// divided by its largest named scale, two fraction digits half-up rounded
// with trailing zeros trimmed, using the Indonesian decimal comma —
// "Rp516,02 miliar" (openapi ProjectDerived example). Below one million the
// grouped form is used instead ("Rp850.000").
func RupiahCompact(decimal string) string {
	cents, ok := parseCents(decimal)
	if !ok {
		return "Rp0"
	}
	for _, scale := range compactScales {
		if cents.Cmp(pow10(scale.exponent+2)) >= 0 { // rupiah×100 threshold
			return "Rp" + scaledComma(cents, pow10(scale.exponent)) + " " + scale.name
		}
	}
	return "Rp" + groupDot(new(big.Int).Div(cents, big100))
}

// scaledComma renders cents (amount × 100) divided by 10^exponent rupiah —
// the display value with two implicit decimals — as "516" or "516,02",
// folding the half-up-rounded remainder into the quotient and trimming
// trailing zero decimals. Example: cents=51602000000000, exponent=9 →
// cents/10^9 = 51602 (exact) → whole=516, frac=02 → "516,02".
func scaledComma(cents *big.Int, divisor *big.Int) string {
	q, r := new(big.Int).QuoRem(cents, divisor, new(big.Int))
	// Carry = round(r/divisor, half-up) ∈ {0,1}: floor((2r + D) / 2D).
	carry := r.Lsh(r, 1)
	carry.Add(carry, divisor)
	scale := new(big.Int).Lsh(divisor, 1)
	q.Add(q, carry.Quo(carry, scale))
	// q now holds display×100: split into integer part and two decimals.
	whole, frac := new(big.Int).Div(q, big100), new(big.Int).Mod(q, big100)
	fracText := fmt.Sprintf("%02d", frac.Int64())
	for len(fracText) > 0 && fracText[len(fracText)-1] == '0' {
		fracText = fracText[:len(fracText)-1]
	}
	body := groupDot(whole)
	if fracText != "" {
		return body + "," + fracText
	}
	return body
}

// pow10 returns 10^n for the small exponents used here (n ≤ 14).
func pow10(n uint) *big.Int {
	return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil)
}

// parseCents converts an exact decimal string into its amount × 100 without
// float64: "516020000000.00" → 51602000000000. Precision beyond two
// fractional digits is half-up rounded (labels never carry more). Returns
// false for negative or garbage input — the schema constraints rule both
// out, and graceful failure beats a wrong rupiah figure.
func parseCents(decimal string) (*big.Int, bool) {
	value := strings.TrimSpace(decimal)
	value = strings.TrimPrefix(value, "+")
	if value == "" || strings.ContainsAny(value, "-eE") {
		return nil, false
	}

	digits := value
	frac := ""
	if dot := strings.IndexByte(value, '.'); dot >= 0 {
		digits, frac = value[:dot], value[dot+1:]
	}
	if digits == "" {
		digits = "0"
	}
	if digits[0] == '0' && len(digits) > 1 {
		digits = strings.TrimLeft(digits, "0")
		if digits == "" {
			return big.NewInt(0), true
		}
	}
	for i := 0; i < len(digits); i++ {
		if digits[i] < '0' || digits[i] > '9' {
			return nil, false
		}
	}
	for i := 0; i < len(frac); i++ {
		if frac[i] < '0' || frac[i] > '9' {
			return nil, false
		}
	}

	cents, ok := new(big.Int).SetString(digits+frac2(frac), 10)
	if !ok {
		return nil, false
	}
	// Round half-up any digits beyond the two kept.
	if len(frac) > 2 && frac[2] >= '5' {
		cents.Add(cents, big.NewInt(1))
	}
	return cents, true
}

// frac2 pads a fractional digit run to exactly two digits ("5" → "50",
// "" → "00") so string append keeps cent alignment.
func frac2(frac string) string {
	switch {
	case len(frac) == 0:
		return "00"
	case len(frac) == 1:
		return frac + "0"
	default:
		return frac[:2]
	}
}

// groupDot renders a non-negative integer with Indonesian thousands dots:
// 516020000000 → "516.020.000.000".
func groupDot(n *big.Int) string {
	digits := n.String() // no sign: amounts are non-negative
	var b strings.Builder
	b.Grow(len(digits) + len(digits)/3)
	for i, d := range digits {
		if i > 0 && (len(digits)-i)%3 == 0 {
			b.WriteByte('.')
		}
		b.WriteByte(byte(d))
	}
	return b.String()
}

// PrecisionBadge maps a canonical precision_level onto its display label
// (api-requirements §12.2): "kecamatan" → "Kecamatan",
// "kabupaten/kota" → "Kabupaten/Kota". An empty level becomes "" so the
// derived field can render as null.
func PrecisionBadge(level string) string {
	if level == "" {
		return ""
	}
	parts := strings.Split(level, "/")
	for i, part := range parts {
		parts[i] = titleCase(strings.FieldsFunc(part, isSep))
	}
	return strings.Join(parts, "/")
}

// CategoryLabel maps a canonical snake_case category ("papan_tidak_ada")
// onto its display label ("Papan Tidak Ada").
func CategoryLabel(category string) string {
	if category == "" {
		return ""
	}
	return titleCase(strings.FieldsFunc(category, isSep))
}

// isSep delimits words inside snake_case and spacing variants.
func isSep(r rune) bool {
	return r == '_' || r == '-' || r == ' '
}

// titleCase joins already-tokenized words with spaces, capitalizing the
// first rune of each word and lowercasing the rest.
func titleCase(words []string) string {
	out := make([]string, 0, len(words))
	for _, w := range words {
		runes := []rune(strings.ToLower(w))
		if len(runes) == 0 {
			continue
		}
		if runes[0] >= 'a' && runes[0] <= 'z' {
			runes[0] = runes[0] - 'a' + 'A'
		}
		out = append(out, string(runes))
	}
	return strings.Join(out, " ")
}
