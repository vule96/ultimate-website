package posts

import "testing"

func TestEscapeLike(t *testing.T) {
	cases := map[string]string{
		"50%":   `50\%`,
		"a_b":   `a\_b`,
		`c\d`:   `c\\d`,
		"plain": "plain",
	}
	for in, want := range cases {
		if got := escapeLike(in); got != want {
			t.Errorf("escapeLike(%q) = %q, want %q", in, got, want)
		}
	}
}
