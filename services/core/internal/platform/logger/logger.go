// Package logger cấu hình structured logging bằng log/slog.
package logger

import (
	"log/slog"
	"os"
)

// New tạo *slog.Logger: JSON handler cho production (máy đọc — Loki/Promtail),
// text handler cho dev (người đọc). level: debug|info|warn|error (sai → info).
func New(production bool, level string) *slog.Logger {
	opts := &slog.HandlerOptions{Level: parseLevel(level)}
	if production {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}

func parseLevel(s string) slog.Level {
	switch s {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	default:
		return slog.LevelInfo
	}
}
