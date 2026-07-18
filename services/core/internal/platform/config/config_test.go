package config

import (
	"strings"
	"testing"
	"time"
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

func TestLoad_InvalidDurationEnvFails(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("STORAGE_PRESIGN_EXPIRES", "fifteen")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for invalid duration env, got nil")
	}
}

func TestLoad_PresignExpiresDefault(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("STORAGE_PRESIGN_EXPIRES", "")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.StoragePresignExpires != 15*time.Minute {
		t.Errorf("StoragePresignExpires = %v, want 15m", cfg.StoragePresignExpires)
	}
}

func TestLoad_Slice9Defaults(t *testing.T) {
	setRequiredEnv(t)
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.MetricsPort != "9091" {
		t.Errorf("MetricsPort = %q, want 9091", cfg.MetricsPort)
	}
	if cfg.LogLevel != "info" {
		t.Errorf("LogLevel = %q, want info", cfg.LogLevel)
	}
	if cfg.ViewFlushInterval != 5*time.Second {
		t.Errorf("ViewFlushInterval = %v, want 5s", cfg.ViewFlushInterval)
	}
	if cfg.ViewBufferSize != 1024 {
		t.Errorf("ViewBufferSize = %d, want 1024", cfg.ViewBufferSize)
	}
	if cfg.BlurhashWorkers != 3 {
		t.Errorf("BlurhashWorkers = %d, want 3", cfg.BlurhashWorkers)
	}
	if cfg.BlurhashMaxBytes != 10<<20 {
		t.Errorf("BlurhashMaxBytes = %d, want 10MiB", cfg.BlurhashMaxBytes)
	}
	if cfg.BlurhashFetchTimeout != 10*time.Second {
		t.Errorf("BlurhashFetchTimeout = %v, want 10s", cfg.BlurhashFetchTimeout)
	}
}

func TestLoad_InvalidLogLevelFails(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("LOG_LEVEL", "verbose")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for invalid LOG_LEVEL, got nil")
	}
}

func TestLoad_ViewDedupSaltRequiredWhenRedisSet(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("REDIS_URL", "redis://localhost:6379/0")
	t.Setenv("VIEW_DEDUP_SALT", "")

	_, err := Load()
	if err == nil {
		t.Fatal("want error when REDIS_URL set and VIEW_DEDUP_SALT empty, got nil")
	}
	if !strings.Contains(err.Error(), "VIEW_DEDUP_SALT") {
		t.Errorf("error should mention VIEW_DEDUP_SALT, got: %v", err)
	}
}

func TestLoad_ViewDedupSaltNotRequiredWhenRedisUnset(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("REDIS_URL", "")
	t.Setenv("VIEW_DEDUP_SALT", "")

	if _, err := Load(); err != nil {
		t.Fatalf("unexpected error when REDIS_URL unset: %v", err)
	}
}

func TestLoad_ReaderAuthDefaults(t *testing.T) {
	setRequiredEnv(t)
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.ReaderRedirectURL != "http://localhost:8080/auth/reader/google/callback" {
		t.Errorf("ReaderRedirectURL = %q, want default", cfg.ReaderRedirectURL)
	}
	if cfg.WebBaseURL != "http://localhost:3000" {
		t.Errorf("WebBaseURL = %q, want default", cfg.WebBaseURL)
	}
}

func TestConfig_LogValueRedactsSecrets(t *testing.T) {
	cfg := Config{
		DatabaseURL:        "postgres://user:secretpw@host:5432/db",
		RedisURL:           "redis://:redispw@rhost:6379/0",
		GoogleClientSecret: "supersecret",
		StorageSecretKey:   "storagesecret",
		ViewDedupSalt:      "dedupsalt123",
	}
	s := cfg.LogValue().String()
	for _, leak := range []string{"secretpw", "redispw", "supersecret", "storagesecret", "dedupsalt123"} {
		if strings.Contains(s, leak) {
			t.Errorf("LogValue leaks %q: %s", leak, s)
		}
	}
	if !strings.Contains(s, "host:5432") {
		t.Errorf("LogValue should keep db host: %s", s)
	}
}
