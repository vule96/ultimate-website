package auth

import (
	"errors"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

const (
	sessionKeyState    = "oauth_state"
	sessionKeyVerifier = "oauth_verifier"
)

// Handler expose flow đăng nhập OAuth qua HTTP (Gin).
type Handler struct {
	svc        *Service
	sm         *scs.SessionManager
	appBaseURL string
}

// NewHandler tạo Handler từ service, session manager và URL redirect sau login.
func NewHandler(svc *Service, sm *scs.SessionManager, appBaseURL string) *Handler {
	return &Handler{svc: svc, sm: sm, appBaseURL: appBaseURL}
}

// RegisterRoutes gắn các route /auth/*.
func (h *Handler) RegisterRoutes(rg gin.IRouter) {
	rg.GET("/auth/google/login", h.login)
	rg.GET("/auth/google/callback", h.callback)
	rg.POST("/auth/logout", h.logout)
	rg.GET("/auth/me", h.me)
}

func (h *Handler) login(c *gin.Context) {
	ctx := c.Request.Context()
	state, verifier, url, err := h.svc.StartLogin()
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not start login")
		return
	}
	h.sm.Put(ctx, sessionKeyState, state)
	h.sm.Put(ctx, sessionKeyVerifier, verifier)
	c.Redirect(http.StatusFound, url)
}

func (h *Handler) callback(c *gin.Context) {
	ctx := c.Request.Context()
	wantState := h.sm.GetString(ctx, sessionKeyState)
	verifier := h.sm.GetString(ctx, sessionKeyVerifier)
	// Dữ liệu tạm chỉ dùng một lần.
	h.sm.Remove(ctx, sessionKeyState)
	h.sm.Remove(ctx, sessionKeyVerifier)

	id, err := h.svc.CompleteLogin(ctx, c.Query("code"), c.Query("state"), wantState, verifier)
	if err != nil {
		respondAuthError(c, err)
		return
	}

	// Chống session fixation: cấp token mới rồi mới lưu danh tính.
	if err := h.sm.RenewToken(ctx); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not create session")
		return
	}
	h.sm.Put(ctx, sessionKeyAdminEmail, id.Email)
	c.Redirect(http.StatusFound, h.appBaseURL)
}

func (h *Handler) logout(c *gin.Context) {
	if err := h.sm.Destroy(c.Request.Context()); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not log out")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) me(c *gin.Context) {
	email := h.sm.GetString(c.Request.Context(), sessionKeyAdminEmail)
	if email == "" {
		httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "not authenticated")
		return
	}
	c.JSON(http.StatusOK, gin.H{"email": email})
}

// respondAuthError map lỗi login sang HTTP status.
func respondAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrStateMismatch):
		httperr.Write(c, http.StatusUnauthorized, "STATE_MISMATCH", "invalid oauth state")
	case errors.Is(err, ErrEmailNotVerified):
		httperr.Write(c, http.StatusForbidden, "EMAIL_NOT_VERIFIED", "email not verified")
	case errors.Is(err, ErrNotAllowed):
		httperr.Write(c, http.StatusForbidden, "NOT_ALLOWED", "email not permitted")
	default:
		httperr.Write(c, http.StatusBadGateway, "OAUTH_FAILED", "oauth exchange failed")
	}
}
