// Package config đọc cấu hình ứng dụng từ biến môi trường.
package config

import (
	"fmt"
	"os"
)

// Config chứa toàn bộ cấu hình runtime của core service.
type Config struct {
	AppEnv      string // development | production
	Port        string // cổng HTTP, vd "8080"
	DatabaseURL string // DSN Postgres
}

// Load đọc cấu hình từ env. DatabaseURL là bắt buộc; các giá trị khác có mặc định.
func Load() (Config, error) {
	cfg := Config{
		AppEnv:      getEnv("APP_ENV", "development"),
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
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
