package redirect

import "testing"

func TestSafePath(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"/blog/abc", "/blog/abc", true},
		{"/", "/", true},
		{"/tags/it?x=1", "/tags/it?x=1", true},
		{"", "", false},
		{"//evil.com", "", false},
		{"/\\evil.com", "", false},
		{"http://evil.com", "", false},
		{"https://evil.com", "", false},
		{"javascript:alert(1)", "", false},
		{"evil.com", "", false}, // không bắt đầu bằng /
	}
	for _, c := range cases {
		got, ok := SafePath(c.in)
		if got != c.want || ok != c.ok {
			t.Errorf("SafePath(%q) = (%q,%v), want (%q,%v)", c.in, got, ok, c.want, c.ok)
		}
	}
}
