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
		origin := c.GetHeader("Origin")
		if origin != "" {
			if _, ok := allowed[origin]; ok {
				h := c.Writer.Header()
				h.Set("Access-Control-Allow-Origin", origin)
				h.Set("Access-Control-Allow-Credentials", "true")
				h.Add("Vary", "Origin")
				h.Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
				h.Set("Access-Control-Allow-Headers", "Content-Type")
			}
		}
		if c.Request.Method == http.MethodOptions {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}
		c.Next()
	}
}
