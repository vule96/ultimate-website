package posts

import "testing"

func TestSlugify(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{"basic", "Hello World", "hello-world"},
		{"punctuation dropped", "Golang 101: Concurrency!", "golang-101-concurrency"},
		{"collapse spaces", "  Multiple   Spaces  ", "multiple-spaces"},
		{"trim dashes", "--edge--", "edge"},
		{"vietnamese diacritics", "Lập trình Go", "lap-trinh-go"},
		{"vietnamese d stroke", "Đặng Văn Đủ", "dang-van-du"},
		{"empty", "   ", ""},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			if got := Slugify(c.in); got != c.want {
				t.Errorf("Slugify(%q) = %q, want %q", c.in, got, c.want)
			}
		})
	}
}
