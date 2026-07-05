package pagination

import "testing"

func TestNormalize(t *testing.T) {
	cases := []struct {
		name                           string
		inPage, inSize                 int
		wantPage, wantSize, wantOffset int
	}{
		{"defaults when zero", 0, 0, 1, 20, 0},
		{"negatives clamped to defaults", -5, -1, 1, 20, 0},
		{"page size capped at 100", 1, 500, 1, 100, 0},
		{"offset computed", 3, 10, 3, 10, 20},
		{"normal", 2, 20, 2, 20, 20},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			p := Normalize(c.inPage, c.inSize)
			if p.Page != c.wantPage || p.PageSize != c.wantSize {
				t.Errorf("Normalize(%d,%d) = {Page:%d PageSize:%d}, want {Page:%d PageSize:%d}",
					c.inPage, c.inSize, p.Page, p.PageSize, c.wantPage, c.wantSize)
			}
			if p.Offset() != c.wantOffset {
				t.Errorf("Offset() = %d, want %d", p.Offset(), c.wantOffset)
			}
		})
	}
}
