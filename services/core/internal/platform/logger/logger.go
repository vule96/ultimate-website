// Package logger cấu hình structured logging bằng log/slog.
package logger

import (
	"log/slog"
	"os"
)

// New tạo *slog.Logger: JSON handler cho production, text handler cho dev.
func New(production bool) *slog.Logger {
	if production {
		return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug}))
}
