package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// googleIssuers là các giá trị iss hợp lệ Google phát cho id_token.
var googleIssuers = map[string]struct{}{
	"accounts.google.com":         {},
	"https://accounts.google.com": {},
}

// GoogleProvider là cài đặt OAuthProvider dùng Google OAuth2/OIDC.
type GoogleProvider struct {
	cfg *oauth2.Config
}

// NewGoogleProvider tạo provider Google từ client id/secret + redirect URL.
func NewGoogleProvider(clientID, clientSecret, redirectURL string) *GoogleProvider {
	return &GoogleProvider{
		cfg: &oauth2.Config{
			ClientID:     clientID,
			ClientSecret: clientSecret,
			RedirectURL:  redirectURL,
			Scopes:       []string{"openid", "email", "profile"},
			Endpoint:     google.Endpoint,
		},
	}
}

// AuthCodeURL dựng URL consent kèm state + PKCE challenge (S256).
func (g *GoogleProvider) AuthCodeURL(state, verifier string) string {
	return g.cfg.AuthCodeURL(state,
		oauth2.AccessTypeOffline,
		oauth2.S256ChallengeOption(verifier),
	)
}

// Exchange đổi code lấy token, rồi đọc Identity từ id_token (OIDC).
func (g *GoogleProvider) Exchange(ctx context.Context, code, verifier string) (Identity, error) {
	tok, err := g.cfg.Exchange(ctx, code, oauth2.VerifierOption(verifier))
	if err != nil {
		return Identity{}, fmt.Errorf("oauth exchange: %w", err)
	}
	raw, ok := tok.Extra("id_token").(string)
	if !ok || raw == "" {
		return Identity{}, fmt.Errorf("no id_token in token response")
	}
	return parseIDToken(raw, g.cfg.ClientID, time.Now())
}

// idTokenClaims là các claim OIDC cần dùng.
type idTokenClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Sub           string `json:"sub"`
	Name          string `json:"name"`
	Aud           string `json:"aud"`
	Iss           string `json:"iss"`
	Exp           int64  `json:"exp"`
}

// parseIDToken decode payload id_token JWT rồi verify các claim binding/freshness.
// id_token lấy trực tiếp từ token endpoint của Google qua TLS nên chữ ký không cần
// verify (kênh server-to-server đã xác thực); nhưng vẫn kiểm iss/aud/exp làm
// defense-in-depth: đảm bảo token do Google phát, đúng cho client này, còn hạn.
func parseIDToken(raw, clientID string, now time.Time) (Identity, error) {
	parts := strings.Split(raw, ".")
	if len(parts) != 3 {
		return Identity{}, fmt.Errorf("malformed id_token")
	}
	payload, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return Identity{}, fmt.Errorf("decode id_token payload: %w", err)
	}
	var c idTokenClaims
	if err := json.Unmarshal(payload, &c); err != nil {
		return Identity{}, fmt.Errorf("parse id_token claims: %w", err)
	}
	if _, ok := googleIssuers[c.Iss]; !ok {
		return Identity{}, fmt.Errorf("id_token: unexpected issuer %q", c.Iss)
	}
	if c.Aud != clientID {
		return Identity{}, fmt.Errorf("id_token: audience mismatch")
	}
	if c.Exp > 0 && now.Unix() >= c.Exp {
		return Identity{}, fmt.Errorf("id_token: expired")
	}
	return Identity{
		Email:         c.Email,
		EmailVerified: c.EmailVerified,
		Sub:           c.Sub,
		Name:          c.Name,
	}, nil
}
