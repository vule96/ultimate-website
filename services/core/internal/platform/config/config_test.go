package config

import (
	"strings"
	"testing"
)

// setRequiredEnv đặt env tối thiểu để Load() không fail vì thiếu DATABASE_URL.
func setRequiredEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://test")
}

func TestLoad_SameSiteNoneRequiresSecure(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("SESSION_COOKIE_SAMESITE", "none")
	t.Setenv("SESSION_COOKIE_SECURE", "false")

	_, err := Load()
	if err == nil {
		t.Fatal("want error when samesite=none and secure=false, got nil")
	}
	if !strings.Contains(err.Error(), "SESSION_COOKIE_SECURE") {
		t.Errorf("error should mention SESSION_COOKIE_SECURE, got: %v", err)
	}
}

func TestLoad_SameSiteNoneWithSecureOK(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("SESSION_COOKIE_SAMESITE", "None") // viết hoa → phải normalize
	t.Setenv("SESSION_COOKIE_SECURE", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.SessionSameSite != "none" {
		t.Errorf("SessionSameSite = %q, want normalized \"none\"", cfg.SessionSameSite)
	}
}

func TestLoad_DefaultLaxOK(t *testing.T) {
	setRequiredEnv(t)
	if _, err := Load(); err != nil {
		t.Fatalf("unexpected error with defaults: %v", err)
	}
}

func TestLoad_InvalidBoolEnvFails(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("SESSION_COOKIE_SECURE", "ture") // typo cố ý
	if _, err := Load(); err == nil {
		t.Fatal("expected error for invalid bool env, got nil")
	}
}

func TestLoad_InvalidInt64EnvFails(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("MAX_BODY_BYTES", "abc")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for invalid int env, got nil")
	}
}

func TestLoad_EmptyEnvUsesFallback(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("SESSION_COOKIE_SECURE", "")
	t.Setenv("MAX_BODY_BYTES", "")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.MaxBodyBytes != 2<<20 {
		t.Errorf("MaxBodyBytes = %d, want default 2MiB", cfg.MaxBodyBytes)
	}
}
