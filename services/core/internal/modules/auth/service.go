package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
)

// Lỗi domain của auth (tầng ngoài map sang HTTP status).
var (
	ErrStateMismatch    = errors.New("oauth state mismatch")
	ErrEmailNotVerified = errors.New("email not verified")
	ErrNotAllowed       = errors.New("email not in allowlist")
)

// Service chứa business logic đăng nhập OAuth.
type Service struct {
	provider  OAuthProvider
	allowlist *Allowlist
}

// NewService tạo Service từ provider và allowlist.
func NewService(provider OAuthProvider, allowlist *Allowlist) *Service {
	return &Service{provider: provider, allowlist: allowlist}
}

// StartLogin sinh state + PKCE verifier ngẫu nhiên và trả URL redirect tới nhà cung cấp.
func (s *Service) StartLogin() (state, verifier, url string, err error) {
	state, err = randomToken()
	if err != nil {
		return "", "", "", err
	}
	verifier, err = randomToken()
	if err != nil {
		return "", "", "", err
	}
	return state, verifier, s.provider.AuthCodeURL(state, verifier), nil
}

// CompleteLogin xác thực callback: khớp state, đổi code, bắt buộc email đã verified
// và nằm trong allowlist. Trả Identity khi hợp lệ.
func (s *Service) CompleteLogin(ctx context.Context, code, gotState, wantState, verifier string) (Identity, error) {
	if wantState == "" || gotState != wantState {
		return Identity{}, ErrStateMismatch
	}
	id, err := s.provider.Exchange(ctx, code, verifier)
	if err != nil {
		return Identity{}, err
	}
	if !id.EmailVerified {
		return Identity{}, ErrEmailNotVerified
	}
	if !s.allowlist.IsAllowed(id.Email) {
		return Identity{}, ErrNotAllowed
	}
	return id, nil
}

// randomToken sinh chuỗi ngẫu nhiên an toàn (URL-safe) dùng cho state/PKCE verifier.
func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
