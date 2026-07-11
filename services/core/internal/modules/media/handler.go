package media

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vule96/ultimate-website/services/core/internal/shared/bodylimit"
	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
	"github.com/vule96/ultimate-website/services/core/internal/shared/reqlog"
)

// Handler expose module media qua HTTP (Gin).
type Handler struct {
	svc *Service
}

// NewHandler tạo Handler từ Service.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes gắn route media. Presign là endpoint ghi → bọc writeMW (auth).
func (h *Handler) RegisterRoutes(rg gin.IRouter, writeMW ...gin.HandlerFunc) {
	write := rg.Group("", writeMW...)
	write.POST("/media/presign", h.presign)
}

type presignRequest struct {
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
}

type presignResponse struct {
	UploadURL string `json:"upload_url"`
	PublicURL string `json:"public_url"`
	Key       string `json:"key"`
	ExpiresIn int    `json:"expires_in"` // giây
}

func (h *Handler) presign(c *gin.Context) {
	var req presignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if bodylimit.IsTooLarge(err) {
			httperr.Write(c, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "request body too large")
			return
		}
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	res, err := h.svc.Presign(c.Request.Context(), PresignInput{
		Filename:    req.Filename,
		ContentType: req.ContentType,
		Size:        req.Size,
	})
	if err != nil {
		if errors.Is(err, ErrValidation) {
			httperr.Write(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
			return
		}
		reqlog.From(c.Request.Context()).Error("presign failed", "err", err)
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "internal server error")
		return
	}
	c.JSON(http.StatusOK, presignResponse{
		UploadURL: res.UploadURL,
		PublicURL: res.PublicURL,
		Key:       res.Key,
		ExpiresIn: int(res.ExpiresIn.Seconds()),
	})
}
