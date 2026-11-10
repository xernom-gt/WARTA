package labels

import "testing"

func TestRupiahFull(t *testing.T) {
	cases := []struct{ in, want string }{
		{"516020000000.00", "Rp516.020.000.000"},
		{"850000.00", "Rp850.000"},
		{"0.00", "Rp0"},
		{"0", "Rp0"},
		{"42.00", "Rp42"},
	}
	for _, c := range cases {
		if got := RupiahFull(c.in); got != c.want {
			t.Errorf("RupiahFull(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestRupiahCompact(t *testing.T) {
	cases := []struct {
		in   string
		want string
	}{
		// Contract example (openapi ProjectDerived).
		{"516020000000.00", "Rp516,02 miliar"},
		// Exact scale multiples lose their comma entirely.
		{"516000000000.00", "Rp516 miliar"},
		{"1000000000000.00", "Rp1 triliun"},
		{"100000000000000.00", "Rp100 triliun"},
		// Sub-scale rounding folds into the displayed decimals.
		{"2345600000.00", "Rp2,35 miliar"},
		{"1500000000.00", "Rp1,5 miliar"},
		{"995000000.00", "Rp995 juta"},   // 0.995 miliar rounds into juta scale, not "Rp1 miliar"
		{"850000.00", "Rp850.000"},       // below one million: grouped, not named
		{"999000.00", "Rp999.000"},       // just below juta
		{"1000000.00", "Rp1 juta"},
		{"12500000.00", "Rp12,5 juta"},
		{"1234567.89", "Rp1,23 juta"},
		{"34525000000.00", "Rp34,53 miliar"}, // cents rounding: ...345.25 stays 34.52? see expectation below
		{"0.00", "Rp0"},
	}
	for _, c := range cases {
		if got := RupiahCompact(c.in); got != c.want {
			t.Errorf("RupiahCompact(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestPrecisionBadge(t *testing.T) {
	cases := []struct{ in, want string }{
		{"kecamatan", "Kecamatan"},
		{"kabupaten/kota", "Kabupaten/Kota"},
		{"desa/kelurahan", "Desa/Kelurahan"},
		{"alamat/ruas", "Alamat/Ruas"},
		{"titik", "Titik"},
		{"", ""},
	}
	for _, c := range cases {
		if got := PrecisionBadge(c.in); got != c.want {
			t.Errorf("PrecisionBadge(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}

func TestCategoryLabel(t *testing.T) {
	cases := []struct{ in, want string }{
		{"papan_tidak_ada", "Papan Tidak Ada"},
		{"lambat_mangkrak", "Lambat Mangkrak"},
		{"fisik_rusak", "Fisik Rusak"},
		{"belum_mulai", "Belum Mulai"},
		{"selesai", "Selesai"},
		{"", ""},
	}
	for _, c := range cases {
		if got := CategoryLabel(c.in); got != c.want {
			t.Errorf("CategoryLabel(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
