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

// RequireAuth chặn request nếu chưa đăng nhập, và re-check allowlist mỗi request
// (M2): email bị gỡ khỏi ADMIN_ALLOWLIST thì session mất hiệu lực ngay (destroy),
// không phải đợi hết hạn 7 ngày.
func RequireAuth(sm *scs.SessionManager, allowlist *Allowlist) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		email := sm.GetString(ctx, sessionKeyAdminEmail)
		if email == "" {
			httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
			c.Abort()
			return
		}
		if !allowlist.IsAllowed(email) {
			_ = sm.Destroy(ctx) // session không còn giá trị; lỗi destroy không chặn việc trả 401
			httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "email no longer permitted")
			c.Abort()
			return
		}
		c.Next()
	}
}
