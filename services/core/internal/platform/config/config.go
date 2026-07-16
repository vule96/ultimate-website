// Package config đọc cấu hình ứng dụng từ biến môi trường.
package config

import (
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"strconv"
	"strings"
	"time"
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
	StorageEndpoint       string // vd http://localhost:9000 (MinIO); rỗng = AWS mặc định
	StorageRegion         string
	StorageAccessKey      string
	StorageSecretKey      string
	StorageBucket         string
	StoragePublicURL      string        // base URL công khai để hiển thị ảnh
	StorageUsePathStyle   bool          // true cho MinIO
	StoragePresignExpires time.Duration // thời hạn presigned URL (STORAGE_PRESIGN_EXPIRES, mặc định 15m)

	// Giới hạn body request (M4). Ảnh không đi qua core (presigned PUT) nên
	// 2 MiB thoải mái cho content_html bài dài.
	MaxBodyBytes int64

	// Observability & workers (Slice 9)
	LogLevel     string // debug | info | warn | error
	MetricsPort  string // cổng HTTP /metrics (+ pprof nếu bật)
	PprofEnabled bool   // bật /debug/pprof trên metrics server
	RedisURL     string // rỗng = cache tắt (no-op)

	ViewFlushInterval    time.Duration // chu kỳ flush view counter
	ViewBufferSize       int           // buffer channel view counter
	BlurhashWorkers      int           // số goroutine worker blurhash
	BlurhashMaxBytes     int64         // giới hạn size ảnh tải về tính blurhash
	BlurhashFetchTimeout time.Duration // timeout tải ảnh
}

// Load đọc cấu hình từ env. DatabaseURL là bắt buộc; các giá trị khác có mặc định.
func Load() (Config, error) {
	appEnv := getEnv("APP_ENV", "development")

	// Hoist boolean env helpers để fail-fast khi parse error
	sessionSecure, err := getBoolEnv("SESSION_COOKIE_SECURE", appEnv == "production")
	if err != nil {
		return Config{}, err
	}
	usePathStyle, err := getBoolEnv("STORAGE_USE_PATH_STYLE", false)
	if err != nil {
		return Config{}, err
	}

	// Hoist int64 env helper để fail-fast khi parse error
	maxBodyBytes, err := getInt64Env("MAX_BODY_BYTES", 2<<20)
	if err != nil {
		return Config{}, err
	}

	// Hoist duration env helper để fail-fast khi parse error
	presignExpires, err := getDurationEnv("STORAGE_PRESIGN_EXPIRES", 15*time.Minute)
	if err != nil {
		return Config{}, err
	}

	// Slice 9 — observability & workers (fail-fast khi env rác)
	pprofEnabled, err := getBoolEnv("PPROF_ENABLED", appEnv != "production")
	if err != nil {
		return Config{}, err
	}
	viewFlushInterval, err := getDurationEnv("VIEW_FLUSH_INTERVAL", 5*time.Second)
	if err != nil {
		return Config{}, err
	}
	viewBufferSize, err := getIntEnv("VIEW_BUFFER_SIZE", 1024)
	if err != nil {
		return Config{}, err
	}
	blurhashWorkers, err := getIntEnv("BLURHASH_WORKERS", 3)
	if err != nil {
		return Config{}, err
	}
	blurhashMaxBytes, err := getInt64Env("BLURHASH_MAX_BYTES", 10<<20)
	if err != nil {
		return Config{}, err
	}
	blurhashFetchTimeout, err := getDurationEnv("BLURHASH_FETCH_TIMEOUT", 10*time.Second)
	if err != nil {
		return Config{}, err
	}
	logLevel := strings.ToLower(strings.TrimSpace(getEnv("LOG_LEVEL", "info")))
	switch logLevel {
	case "debug", "info", "warn", "error":
	default:
		return Config{}, fmt.Errorf("config: LOG_LEVEL must be debug|info|warn|error, got %q", logLevel)
	}

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

		SessionSameSite: strings.ToLower(strings.TrimSpace(getEnv("SESSION_COOKIE_SAMESITE", "lax"))),
		SessionSecure:   sessionSecure,

		StorageEndpoint:       os.Getenv("STORAGE_ENDPOINT"),
		StorageRegion:         getEnv("STORAGE_REGION", "auto"),
		StorageAccessKey:      os.Getenv("STORAGE_ACCESS_KEY"),
		StorageSecretKey:      os.Getenv("STORAGE_SECRET_KEY"),
		StorageBucket:         os.Getenv("STORAGE_BUCKET"),
		StoragePublicURL:      os.Getenv("STORAGE_PUBLIC_URL"),
		StorageUsePathStyle:   usePathStyle,
		StoragePresignExpires: presignExpires,

		MaxBodyBytes: maxBodyBytes,

		LogLevel:     logLevel,
		MetricsPort:  getEnv("METRICS_PORT", "9091"),
		PprofEnabled: pprofEnabled,
		RedisURL:     os.Getenv("REDIS_URL"),

		ViewFlushInterval:    viewFlushInterval,
		ViewBufferSize:       viewBufferSize,
		BlurhashWorkers:      blurhashWorkers,
		BlurhashMaxBytes:     blurhashMaxBytes,
		BlurhashFetchTimeout: blurhashFetchTimeout,
	}
	if cfg.DatabaseURL == "" {
		return Config{}, fmt.Errorf("config: DATABASE_URL is required")
	}
	// SameSite=None mà không Secure thì browser sẽ drop cookie — fail fast thay vì hỏng im lặng.
	if cfg.SessionSameSite == "none" && !cfg.SessionSecure {
		return Config{}, fmt.Errorf("config: SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true")
	}
	return cfg, nil
}

// IsProduction cho biết có đang chạy ở môi trường production hay không.
func (c Config) IsProduction() bool { return c.AppEnv == "production" }

// LogValue in config lúc boot mà KHÔNG leak secret (slog.LogValuer).
// Secret (password DB/Redis, client secret, storage key) bị redact — chỉ giữ host.
func (c Config) LogValue() slog.Value {
	return slog.GroupValue(
		slog.String("env", c.AppEnv),
		slog.String("port", c.Port),
		slog.String("db", redactURL(c.DatabaseURL)),
		slog.String("redis", redactURL(c.RedisURL)),
		slog.String("metrics_port", c.MetricsPort),
		slog.Bool("pprof", c.PprofEnabled),
		slog.String("log_level", c.LogLevel),
		slog.String("storage_bucket", c.StorageBucket),
		slog.Bool("auth_configured", c.GoogleClientID != "" && c.AdminAllowlist != ""),
	)
}

// redactURL giữ scheme+host để nhận diện môi trường, che credential/path/query.
func redactURL(raw string) string {
	if raw == "" {
		return ""
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "<invalid>"
	}
	u.User = nil
	return u.Scheme + "://" + u.Host
}

func getIntEnv(key string, fallback int) (int, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("config: %s must be a positive integer, got %q", key, v)
	}
	return n, nil
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getBoolEnv(key string, fallback bool) (bool, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return false, fmt.Errorf("config: %s must be a boolean (true/false), got %q", key, v)
	}
	return b, nil
}

func getInt64Env(key string, fallback int64) (int64, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("config: %s must be a positive integer, got %q", key, v)
	}
	return n, nil
}

func getDurationEnv(key string, fallback time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		return 0, fmt.Errorf("config: %s must be a positive duration (e.g. 15m), got %q", key, v)
	}
	return d, nil
}
