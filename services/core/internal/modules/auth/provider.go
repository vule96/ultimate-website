package auth

import "context"

// Identity là thông tin danh tính lấy từ nhà cung cấp OAuth sau khi đổi code.
type Identity struct {
	Email         string
	EmailVerified bool
	Sub           string // subject id ổn định của nhà cung cấp
	Name          string
}

// OAuthProvider là cổng (port) tới nhà cung cấp OAuth. Tầng service phụ thuộc
// interface này để test được bằng fake (không gọi Google thật).
type OAuthProvider interface {
	// AuthCodeURL trả về URL redirect người dùng tới trang đồng ý (kèm state + PKCE).
	AuthCodeURL(state, verifier string) string
	// Exchange đổi authorization code lấy Identity (đã xác thực với nhà cung cấp).
	Exchange(ctx context.Context, code, verifier string) (Identity, error)
}
