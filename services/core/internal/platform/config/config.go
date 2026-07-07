// Package config đọc cấu hình ứng dụng từ biến môi trường.
package config

import (
	"fmt"
	"os"
	"strconv"
)

// Config chứa toàn bộ cấu hình runtime của core service.
type Config struct {
	AppEnv      string // development | production
	Port        string // cổng HTTP, vd "8080"
	DatabaseURL string // DSN Postgres

	// Auth / OAuth (Slice 2)
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	AdminAllowlist     string // CSV email
	AppBaseURL         string // redirect về sau khi login
	CORSAllowedOrigins string // CSV origin được phép gọi API (admin SPA)

	// Session cookie
	SessionSameSite string // lax | none | strict
	SessionSecure   bool

	// Object storage (Slice 3c) — S3-compatible (MinIO dev / R2 prod)
	StorageEndpoint     string // vd http://localhost:9000 (MinIO); rỗng = AWS mặc định
	StorageRegion       string
	StorageAccessKey    string
	StorageSecretKey    string
	StorageBucket       string
	StoragePublicURL    string // base URL công khai để hiển thị ảnh
	StorageUsePathStyle bool   // true cho MinIO
}

// Load đọc cấu hình từ env. DatabaseURL là bắt buộc; các giá trị khác có mặc định.
func Load() (Config, error) {
	appEnv := getEnv("APP_ENV", "development")
	cfg := Config{
		AppEnv:      appEnv,
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),

		GoogleClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:  getEnv("GOOGLE_REDIRECT_URL", "http://localhost:8080/auth/google/callback"),
		AdminAllowlist:     os.Getenv("ADMIN_ALLOWLIST"),
		AppBaseURL:         getEnv("APP_BASE_URL", "http://localhost:8080"),
		CORSAllowedOrigins: os.Getenv("CORS_ALLOWED_ORIGINS"),

		SessionSameSite: getEnv("SESSION_COOKIE_SAMESITE", "lax"),
		SessionSecure:   getBoolEnv("SESSION_COOKIE_SECURE", appEnv == "production"),

		StorageEndpoint:     os.Getenv("STORAGE_ENDPOINT"),
		StorageRegion:       getEnv("STORAGE_REGION", "auto"),
		StorageAccessKey:    os.Getenv("STORAGE_ACCESS_KEY"),
		StorageSecretKey:    os.Getenv("STORAGE_SECRET_KEY"),
		StorageBucket:       os.Getenv("STORAGE_BUCKET"),
		StoragePublicURL:    os.Getenv("STORAGE_PUBLIC_URL"),
		StorageUsePathStyle: getBoolEnv("STORAGE_USE_PATH_STYLE", false),
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("config: DATABASE_URL is required")
	}
	return cfg, nil
}

// IsProduction cho biết có đang chạy ở môi trường production hay không.
func (c Config) IsProduction() bool { return c.AppEnv == "production" }

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getBoolEnv(key string, fallback bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return fallback
	}
	return b
}
