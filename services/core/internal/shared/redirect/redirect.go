// Package redirect cung cấp guard chống open-redirect cho tham số returnTo.
package redirect

import "strings"

// SafePath chỉ chấp nhận path nội bộ: bắt đầu bằng đúng một "/", không phải "//"
// hoặc "/\" (protocol-relative), không chứa scheme. Trả ("", false) nếu không an toàn.
func SafePath(raw string) (string, bool) {
	if raw == "" || raw[0] != '/' {
		return "", false
	}
	if strings.HasPrefix(raw, "//") || strings.HasPrefix(raw, "/\\") {
		return "", false
	}
	return raw, true
}
