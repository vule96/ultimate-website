package auth

import "testing"

func TestAllowlist(t *testing.T) {
	al := NewAllowlist(" Admin@Gmail.com , second@example.com ,, ")

	cases := []struct {
		email string
		want  bool
	}{
		{"admin@gmail.com", true},     // case-insensitive
		{"ADMIN@GMAIL.COM", true},     // case-insensitive input
		{"  admin@gmail.com  ", true}, // trimmed input
		{"second@example.com", true},  // second entry
		{"stranger@evil.com", false},  // not listed
		{"", false},                   // empty
	}
	for _, c := range cases {
		if got := al.IsAllowed(c.email); got != c.want {
			t.Errorf("IsAllowed(%q) = %v, want %v", c.email, got, c.want)
		}
	}
}

func TestAllowlist_EmptyDeniesAll(t *testing.T) {
	al := NewAllowlist("")
	if al.IsAllowed("anyone@gmail.com") {
		t.Error("empty allowlist must deny everyone")
	}
}
