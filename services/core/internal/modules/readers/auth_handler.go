package readers

import (
	"context"
	"errors"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
	"github.com/vule96/ultimate-website/services/core/internal/shared/jsonmw"
	"github.com/vule96/ultimate-website/services/core/internal/shared/redirect"
)

const (
	// SessionKeyReaderID là key session lưu reader id — export để dùng ở
	// nơi wiring khác (vd main.go WithReaderIdentity) thay vì hardcode string.
	SessionKeyReaderID       = "reader_id"
	sessionKeyReaderState    = "reader_oauth_state"
	sessionKeyReaderVerifier = "reader_oauth_verifier"
	sessionKeyReaderReturnTo = "reader_return_to"
	// CtxReaderID là key đặt reader id vào gin.Context sau RequireReader.
	CtxReaderID = "reader_id_ctx"
)

type AuthHandler struct {
	svc        *Service
	sm         *scs.SessionManager
	webBaseURL string
}

func NewAuthHandler(svc *Service, sm *scs.SessionManager, webBaseURL string) *AuthHandler {
	return &AuthHandler{svc: svc, sm: sm, webBaseURL: webBaseURL}
}

// RegisterRoutes gắn /auth/reader/*. loginMW (rate limit) chỉ bọc login.
func (h *AuthHandler) RegisterRoutes(rg gin.IRouter, loginMW ...gin.HandlerFunc) {
	login := rg.Group("", loginMW...)
	login.GET("/auth/reader/google/login", h.login)
	rg.GET("/auth/reader/google/callback", h.callback)
	// RequireJSON chặn CSRF simple-request (form cross-site POST không set
	// Content-Type: application/json được) — logout đăng ký top-level nên
	// không đi qua writeMW của /api/v1, phải tự bọc ở đây.
	rg.POST("/auth/reader/logout", jsonmw.RequireJSON(), h.logout)
	rg.GET("/auth/reader/me", h.me)
	// GDPR: reader tự xoá tài khoản (+ bookmark cascade). RequireReader đảm bảo có session.
	rg.DELETE("/auth/reader/me", RequireReader(h.sm), h.deleteMe)
}

func (h *AuthHandler) login(c *gin.Context) {
	ctx := c.Request.Context()
	state, verifier, url, err := h.svc.StartLogin()
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not start login")
		return
	}
	h.sm.Put(ctx, sessionKeyReaderState, state)
	h.sm.Put(ctx, sessionKeyReaderVerifier, verifier)
	if p, ok := redirect.SafePath(c.Query("returnTo")); ok {
		h.sm.Put(ctx, sessionKeyReaderReturnTo, p)
	}
	c.Redirect(http.StatusFound, url)
}

func (h *AuthHandler) callback(c *gin.Context) {
	ctx := c.Request.Context()
	wantState := h.sm.GetString(ctx, sessionKeyReaderState)
	verifier := h.sm.GetString(ctx, sessionKeyReaderVerifier)
	returnTo := h.sm.GetString(ctx, sessionKeyReaderReturnTo)
	h.sm.Remove(ctx, sessionKeyReaderState)
	h.sm.Remove(ctx, sessionKeyReaderVerifier)
	h.sm.Remove(ctx, sessionKeyReaderReturnTo)

	rd, err := h.svc.CompleteLogin(ctx, c.Query("code"), c.Query("state"), wantState, verifier)
	if err != nil {
		respondAuthError(c, err)
		return
	}
	if err := h.sm.RenewToken(ctx); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not create session")
		return
	}
	h.sm.Put(ctx, SessionKeyReaderID, rd.ID.String())

	// SECURITY: dest luôn bắt đầu bằng webBaseURL (scheme+host cố định) rồi mới nối path đã
	// qua SafePath — không bao giờ redirect thẳng tới `p` một mình, vì SafePath chỉ đảm bảo
	// path không bắt đầu bằng "//" hay chứa scheme; ký tự tab/CRLF vẫn có thể lọt qua và trở
	// nên vô hại chỉ khi được nối phía sau origin cố định.
	dest := h.webBaseURL
	if p, ok := redirect.SafePath(returnTo); ok {
		dest = h.webBaseURL + p
	}
	c.Redirect(http.StatusFound, dest)
}

// logout chỉ gỡ phần reader — KHÔNG destroy toàn session (giữ admin nếu cùng browser).
func (h *AuthHandler) logout(c *gin.Context) {
	ctx := c.Request.Context()
	h.sm.Remove(ctx, SessionKeyReaderID)
	if err := h.sm.RenewToken(ctx); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not log out")
		return
	}
	c.Status(http.StatusNoContent)
}

// deleteMe xoá tài khoản reader hiện tại (GDPR) + bookmark, rồi gỡ reader session.
func (h *AuthHandler) deleteMe(c *gin.Context) {
	ctx := c.Request.Context()
	id := c.MustGet(CtxReaderID).(uuid.UUID)
	if err := h.svc.DeleteReader(ctx, id); err != nil && !errors.Is(err, ErrReaderNotFound) {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not delete account")
		return
	}
	h.sm.Remove(ctx, SessionKeyReaderID)
	if err := h.sm.RenewToken(ctx); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not clear session")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) me(c *gin.Context) {
	ctx := c.Request.Context()
	id, ok := readerIDFrom(ctx, h.sm)
	if !ok {
		httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "not authenticated")
		return
	}
	rd, err := h.svc.GetReader(ctx, id)
	if err != nil {
		// Reader bị xoá khỏi DB → gỡ session, trả 401.
		h.sm.Remove(ctx, SessionKeyReaderID)
		httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "not authenticated")
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": rd.ID, "email": rd.Email, "name": rd.Name})
}

func respondAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, auth.ErrStateMismatch):
		httperr.Write(c, http.StatusUnauthorized, "STATE_MISMATCH", "invalid oauth state")
	case errors.Is(err, auth.ErrEmailNotVerified):
		httperr.Write(c, http.StatusForbidden, "EMAIL_NOT_VERIFIED", "email not verified")
	default:
		httperr.Write(c, http.StatusBadGateway, "OAUTH_FAILED", "oauth exchange failed")
	}
}

// readerIDFrom đọc reader id từ session (parse uuid).
func readerIDFrom(ctx context.Context, sm *scs.SessionManager) (uuid.UUID, bool) {
	s := sm.GetString(ctx, SessionKeyReaderID)
	if s == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

// RequireReader chặn request thiếu reader session; đặt reader id vào gin.Context.
func RequireReader(sm *scs.SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := readerIDFrom(c.Request.Context(), sm)
		if !ok {
			httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
			c.Abort()
			return
		}
		c.Set(CtxReaderID, id)
		c.Next()
	}
}
