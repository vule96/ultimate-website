package readers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

type SubscriberHandler struct{ svc *Service }

func NewSubscriberHandler(svc *Service) *SubscriberHandler { return &SubscriberHandler{svc: svc} }

// RegisterRoutes gắn POST /subscribers + POST /subscribers/unsubscribe.
// mw (rate limit [+ RequireJSON]) bọc cả hai — public, chống spam theo IP.
func (h *SubscriberHandler) RegisterRoutes(rg gin.IRouter, mw ...gin.HandlerFunc) {
	g := rg.Group("", mw...)
	g.POST("/subscribers", h.subscribe)
	g.POST("/subscribers/unsubscribe", h.unsubscribe)
}

type subscribeRequest struct {
	Email string `json:"email"`
}

func (h *SubscriberHandler) subscribe(c *gin.Context) {
	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	err := h.svc.Subscribe(c.Request.Context(), req.Email)
	if errors.Is(err, ErrInvalidEmail) {
		httperr.Write(c, http.StatusBadRequest, "INVALID_EMAIL", "invalid email")
		return
	}
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not subscribe")
		return
	}
	// Luôn 201 dù đã tồn tại — không lộ email đã đăng ký (privacy).
	c.Status(http.StatusCreated)
}

type unsubscribeRequest struct {
	Token string `json:"token"`
}

// unsubscribe huỷ đăng ký theo token (POST, không GET — tránh email-client prefetch tự huỷ).
func (h *SubscriberHandler) unsubscribe(c *gin.Context) {
	var req unsubscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	token, err := uuid.Parse(req.Token)
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_TOKEN", "invalid token")
		return
	}
	err = h.svc.Unsubscribe(c.Request.Context(), token)
	if errors.Is(err, ErrSubscriberNotFound) {
		httperr.Write(c, http.StatusNotFound, "NOT_FOUND", "subscription not found")
		return
	}
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not unsubscribe")
		return
	}
	c.Status(http.StatusNoContent)
}
