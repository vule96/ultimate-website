// Package ratelimit cung cấp middleware giới hạn tần suất theo IP (fixed-window, Redis).
package ratelimit

import (
	"context"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

const opTimeout = 100 * time.Millisecond

// PerIP giới hạn `limit` request mỗi `window` cho mỗi IP trong `scope`.
// rdb nil → no-op. Redis lỗi → fail-open (cho qua, log warn).
func PerIP(rdb redis.Cmdable, log *slog.Logger, scope string, limit int, window time.Duration) gin.HandlerFunc {
	if rdb == nil {
		return func(c *gin.Context) { c.Next() }
	}
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), opTimeout)
		defer cancel()

		bucket := time.Now().Unix() / int64(window.Seconds())
		key := "rl:" + scope + ":" + c.ClientIP() + ":" + strconv.FormatInt(bucket, 10)

		n, err := rdb.Incr(ctx, key).Result()
		if err != nil {
			log.Warn("ratelimit: redis incr failed — fail-open", "scope", scope, "err", err)
			c.Next()
			return
		}
		if n == 1 {
			rdb.Expire(ctx, key, window)
		}
		if n > int64(limit) {
			c.Header("Retry-After", strconv.Itoa(int(window.Seconds())))
			httperr.Write(c, http.StatusTooManyRequests, "RATE_LIMITED", "too many requests")
			c.Abort()
			return
		}
		c.Next()
	}
}
