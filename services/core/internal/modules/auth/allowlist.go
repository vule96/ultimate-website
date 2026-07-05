// Package auth xử lý đăng nhập admin bằng Google OAuth (BFF pattern).
package auth

import "strings"

// Allowlist là tập email admin được phép đăng nhập.
type Allowlist struct {
	emails map[string]struct{}
}

// NewAllowlist tạo allowlist từ chuỗi CSV (phân tách bằng dấu phẩy).
// Mỗi email được trim + hạ chữ thường; phần tử rỗng bị bỏ qua.
func NewAllowlist(csv string) *Allowlist {
	emails := make(map[string]struct{})
	for _, raw := range strings.Split(csv, ",") {
		e := normalizeEmail(raw)
		if e != "" {
			emails[e] = struct{}{}
		}
	}
	return &Allowlist{emails: emails}
}

// IsAllowed cho biết email có nằm trong allowlist không (so khớp không phân biệt hoa thường).
func (a *Allowlist) IsAllowed(email string) bool {
	e := normalizeEmail(email)
	if e == "" {
		return false
	}
	_, ok := a.emails[e]
	return ok
}

func normalizeEmail(s string) string {
	return strings.ToLower(strings.TrimSpace(s))
}
