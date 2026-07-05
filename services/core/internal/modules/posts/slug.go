package posts

import (
	"strings"
	"unicode"

	"golang.org/x/text/runes"
	"golang.org/x/text/transform"
	"golang.org/x/text/unicode/norm"
)

// Slugify chuyển một chuỗi (kể cả tiếng Việt có dấu) thành slug URL-friendly:
// bỏ dấu, hạ chữ thường, thay ký tự không phải [a-z0-9] bằng dấu gạch nối,
// gộp gạch nối liên tiếp và cắt gạch nối ở hai đầu.
func Slugify(s string) string {
	// đ/Đ không tách được dấu bằng NFD nên xử lý riêng trước.
	s = strings.NewReplacer("đ", "d", "Đ", "D").Replace(s)

	// NFD tách ký tự cơ sở khỏi dấu kết hợp, rồi loại bỏ các dấu (Mn).
	t := transform.Chain(norm.NFD, runes.Remove(runes.In(unicode.Mn)), norm.NFC)
	if out, _, err := transform.String(t, s); err == nil {
		s = out
	}

	s = strings.ToLower(s)

	var b strings.Builder
	prevDash := false
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
			prevDash = false
		default:
			if !prevDash {
				b.WriteByte('-')
				prevDash = true
			}
		}
	}
	return strings.Trim(b.String(), "-")
}
