package readers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

// AdminHandler lộ subscribers/readers cho admin (sau RequireAuth).
type AdminHandler struct{ svc *Service }

func NewAdminHandler(svc *Service) *AdminHandler { return &AdminHandler{svc: svc} }

// RegisterRoutes gắn GET/DELETE subscribers + GET readers. mw = RequireAuth (allowlist).
func (h *AdminHandler) RegisterRoutes(rg gin.IRouter, mw ...gin.HandlerFunc) {
	g := rg.Group("", mw...)
	g.GET("/subscribers", h.listSubscribers)
	g.DELETE("/subscribers/:id", h.deleteSubscriber)
	g.GET("/readers", h.listReaders)
}

type subscriberResponse struct {
	ID        uuid.UUID `json:"id"`
	Email     string    `json:"email"`
	Status    string    `json:"status"`
	CreatedAt time.Time `json:"created_at"`
}

type subscriberListResponse struct {
	Data     []subscriberResponse `json:"data"`
	Total    int64                `json:"total"`
	Page     int                  `json:"page"`
	PageSize int                  `json:"page_size"`
}

type adminReaderResponse struct {
	ID            uuid.UUID `json:"id"`
	Email         string    `json:"email"`
	Name          string    `json:"name"`
	CreatedAt     time.Time `json:"created_at"`
	BookmarkCount int64     `json:"bookmark_count"`
}

type adminReaderListResponse struct {
	Data     []adminReaderResponse `json:"data"`
	Total    int64                 `json:"total"`
	Page     int                   `json:"page"`
	PageSize int                   `json:"page_size"`
}

func paging(c *gin.Context) (page, pageSize int) {
	page, _ = strconv.Atoi(c.Query("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ = strconv.Atoi(c.Query("page_size"))
	if pageSize < 1 {
		pageSize = 20
	}
	return page, pageSize
}

func (h *AdminHandler) listSubscribers(c *gin.Context) {
	page, pageSize := paging(c)
	subs, total, err := h.svc.ListSubscribers(c.Request.Context(), page, pageSize)
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not list subscribers")
		return
	}
	data := make([]subscriberResponse, len(subs))
	for i, s := range subs {
		data[i] = subscriberResponse{ID: s.ID, Email: s.Email, Status: s.Status, CreatedAt: s.CreatedAt}
	}
	c.JSON(http.StatusOK, subscriberListResponse{Data: data, Total: total, Page: page, PageSize: pageSize})
}

func (h *AdminHandler) deleteSubscriber(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_ID", "invalid id")
		return
	}
	err = h.svc.DeleteSubscriber(c.Request.Context(), id)
	if errors.Is(err, ErrSubscriberNotFound) {
		httperr.Write(c, http.StatusNotFound, "NOT_FOUND", "subscriber not found")
		return
	}
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not delete subscriber")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AdminHandler) listReaders(c *gin.Context) {
	page, pageSize := paging(c)
	rs, total, err := h.svc.ListReaders(c.Request.Context(), page, pageSize)
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not list readers")
		return
	}
	data := make([]adminReaderResponse, len(rs))
	for i, r := range rs {
		data[i] = adminReaderResponse{ID: r.ID, Email: r.Email, Name: r.Name, CreatedAt: r.CreatedAt, BookmarkCount: r.BookmarkCount}
	}
	c.JSON(http.StatusOK, adminReaderListResponse{Data: data, Total: total, Page: page, PageSize: pageSize})
}
