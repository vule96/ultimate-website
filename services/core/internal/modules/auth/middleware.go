package auth

import (
	"context"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

// sessionKeyAdminEmail là khoá lưu email admin đã đăng nhập trong session.
const sessionKeyAdminEmail = "admin_email"

// IsAuthenticated trả về checker cho biết request (qua ctx đã đi qua scs LoadAndSave)
// đã đăng nhập admin hay chưa. Module khác (vd posts) nhận checker này khi wiring
// để quyết định visibility mà không cần import auth.
func IsAuthenticated(sm *scs.SessionManager) func(ctx context.Context) bool {
	return func(ctx context.Context) bool {
		return sm.GetString(ctx, sessionKeyAdminEmail) != ""
	}
}

// RequireAuth chặn request nếu chưa đăng nhập (session không có admin_email).
func RequireAuth(sm *scs.SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		if sm.GetString(c.Request.Context(), sessionKeyAdminEmail) == "" {
			httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
			c.Abort()
			return
		}
		c.Next()
	}
}
