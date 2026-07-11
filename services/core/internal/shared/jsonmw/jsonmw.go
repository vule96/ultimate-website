// Package jsonmw chứa middleware ép Content-Type JSON cho các endpoint ghi.
//
// Mục đích chống CSRF class khi cookie SameSite=none: cross-site form/fetch chỉ gửi
// được "simple request" (text/plain, form-urlencoded...) không qua preflight; ép
// application/json biến request ghi thành non-simple → bị CORS preflight chặn.
package jsonmw

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

// RequireJSON chặn POST/PUT/PATCH có Content-Type khác application/json (415).
// GET/DELETE (không body) đi qua tự do.
func RequireJSON() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch:
			// c.ContentType() đã strip tham số (vd "; charset=utf-8").
			if c.ContentType() != "application/json" {
				httperr.Write(c, http.StatusUnsupportedMediaType,
					"UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json")
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
