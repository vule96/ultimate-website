// Package reqlog cung cấp middleware log request (request ID + contextual slog).
package reqlog

import (
	"context"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ctxKey struct{}

const headerRequestID = "X-Request-ID"

// Middleware sinh/đọc X-Request-ID, đặt *slog.Logger (đã gắn request_id) vào
// context, và log một dòng completion sau khi xử lý xong.
func Middleware(base *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(headerRequestID)
		if id == "" {
			id = uuid.NewString()
		}
		c.Writer.Header().Set(headerRequestID, id)

		l := base.With("request_id", id)
		ctx := context.WithValue(c.Request.Context(), ctxKey{}, l)
		c.Request = c.Request.WithContext(ctx)

		start := time.Now()
		c.Next()

		l.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"latency_ms", time.Since(start).Milliseconds(),
		)
	}
}

// From lấy logger trong context; fallback slog.Default() nếu chưa được set
// (an toàn khi gọi ngoài middleware, vd trong test).
func From(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}
