package auth

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"strings"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

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
	return parseIDToken(raw)
}

// idTokenClaims là các claim OIDC cần dùng.
type idTokenClaims struct {
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
	Sub           string `json:"sub"`
	Name          string `json:"name"`
}

// parseIDToken decode phần payload của id_token JWT.
// id_token lấy trực tiếp từ token endpoint của Google qua TLS nên tin cậy được
// mà không cần verify chữ ký (kênh đã xác thực server-to-server).
func parseIDToken(raw string) (Identity, error) {
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
	return Identity{
		Email:         c.Email,
		EmailVerified: c.EmailVerified,
		Sub:           c.Sub,
		Name:          c.Name,
	}, nil
}
