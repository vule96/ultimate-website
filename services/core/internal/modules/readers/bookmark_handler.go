package readers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

type BookmarkHandler struct{ svc *Service }

func NewBookmarkHandler(svc *Service) *BookmarkHandler { return &BookmarkHandler{svc: svc} }

// RegisterRoutes gắn /readers/me/bookmarks*. mw (RequireReader [+ RequireJSON cho write]) bọc tất cả.
func (h *BookmarkHandler) RegisterRoutes(rg gin.IRouter, mw ...gin.HandlerFunc) {
	g := rg.Group("/readers/me/bookmarks", mw...)
	g.GET("", h.list)
	g.PUT("/:postId", h.add)
	g.DELETE("/:postId", h.remove)
}

func (h *BookmarkHandler) readerID(c *gin.Context) uuid.UUID {
	return c.MustGet(CtxReaderID).(uuid.UUID)
}

func (h *BookmarkHandler) list(c *gin.Context) {
	ids, err := h.svc.Bookmarks(c.Request.Context(), h.readerID(c))
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not list bookmarks")
		return
	}
	if ids == nil {
		ids = []uuid.UUID{}
	}
	c.JSON(http.StatusOK, ids)
}

func (h *BookmarkHandler) add(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("postId"))
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_ID", "invalid post id")
		return
	}
	if err := h.svc.AddBookmark(c.Request.Context(), h.readerID(c), pid); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not add bookmark")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *BookmarkHandler) remove(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("postId"))
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_ID", "invalid post id")
		return
	}
	if err := h.svc.RemoveBookmark(c.Request.Context(), h.readerID(c), pid); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not remove bookmark")
		return
	}
	c.Status(http.StatusNoContent)
}
