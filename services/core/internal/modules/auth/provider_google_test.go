package auth

import (
	"encoding/base64"
	"encoding/json"
	"testing"
	"time"
)

// makeIDToken dựng id_token giả (header.payload.sig) với payload là claims cho trước.
// Chữ ký để rác — parseIDToken không verify chữ ký (kênh token-endpoint đã tin cậy).
func makeIDToken(t *testing.T, claims map[string]any) string {
	t.Helper()
	payload, err := json.Marshal(claims)
	if err != nil {
		t.Fatal(err)
	}
	enc := base64.RawURLEncoding.EncodeToString
	return enc([]byte(`{"alg":"RS256"}`)) + "." + enc(payload) + ".sig"
}

func TestParseIDToken_Valid(t *testing.T) {
	now := time.Unix(1_000_000, 0)
	raw := makeIDToken(t, map[string]any{
		"iss": "https://accounts.google.com", "aud": "client-1",
		"exp": now.Unix() + 3600, "email": "a@b.com", "email_verified": true,
		"sub": "s1", "name": "A",
	})
	id, err := parseIDToken(raw, "client-1", now)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id.Email != "a@b.com" || id.Sub != "s1" || !id.EmailVerified {
		t.Errorf("identity không đúng: %+v", id)
	}
}

func TestParseIDToken_WrongAudience(t *testing.T) {
	now := time.Unix(1_000_000, 0)
	raw := makeIDToken(t, map[string]any{
		"iss": "https://accounts.google.com", "aud": "someone-else",
		"exp": now.Unix() + 3600, "email": "a@b.com",
	})
	if _, err := parseIDToken(raw, "client-1", now); err == nil {
		t.Fatal("mong đợi lỗi audience mismatch, nhận nil")
	}
}

func TestParseIDToken_WrongIssuer(t *testing.T) {
	now := time.Unix(1_000_000, 0)
	raw := makeIDToken(t, map[string]any{
		"iss": "https://evil.example", "aud": "client-1", "exp": now.Unix() + 3600,
	})
	if _, err := parseIDToken(raw, "client-1", now); err == nil {
		t.Fatal("mong đợi lỗi issuer, nhận nil")
	}
}

func TestParseIDToken_Expired(t *testing.T) {
	now := time.Unix(1_000_000, 0)
	raw := makeIDToken(t, map[string]any{
		"iss": "accounts.google.com", "aud": "client-1", "exp": now.Unix() - 1,
	})
	if _, err := parseIDToken(raw, "client-1", now); err == nil {
		t.Fatal("mong đợi lỗi expired, nhận nil")
	}
}
