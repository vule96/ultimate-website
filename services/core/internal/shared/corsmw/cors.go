// Package corsmw cung cấp CORS middleware cho phép admin SPA gọi API kèm cookie.
package corsmw

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

// New tạo middleware CORS: chỉ cho phép origin nằm trong allowedOrigins, bật
// credentials (cookie), và trả 204 cho preflight OPTIONS.
func New(allowedOrigins []string) gin.HandlerFunc {
	allowed := make(map[string]struct{})
	for _, o := range allowedOrigins {
		if o = strings.TrimSpace(o); o != "" {
			allowed[o] = struct{}{}
		}
	}

	return func(c *gin.Context) {
		h := c.Writer.Header()
		// Vary: Origin luôn set (kể cả origin không được phép / không có) — phản hồi phụ
		// thuộc Origin, cache dùng chung cho nhiều origin phải phân biệt theo header này.
		h.Add("Vary", "Origin")
		origin := c.GetHeader("Origin")
		if origin != "" {
			if _, ok := allowed[origin]; ok {
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type")
				// Cache preflight 10 phút — giảm số OPTIONS.
				h.Set("Access-Control-Max-Age", "600")
			}
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
