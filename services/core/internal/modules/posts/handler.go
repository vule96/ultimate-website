package posts

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
	"github.com/vule96/ultimate-website/services/core/internal/shared/pagination"
)

// Handler expose module posts qua HTTP (Gin).
type Handler struct {
	svc    *Service
	authed func(ctx context.Context) bool // request hiện tại đã đăng nhập admin chưa
}

// NewHandler tạo Handler từ Service và checker đăng nhập (vd auth.IsAuthenticated(sm)).
func NewHandler(svc *Service, authed func(ctx context.Context) bool) *Handler {
	return &Handler{svc: svc, authed: authed}
}

// RegisterRoutes gắn các route của module posts. GET list/detail/tags công khai
// (service tự ép visibility); stats + endpoint ghi nằm sau protectedMW
// (vd jsonmw.RequireJSON + auth.RequireAuth).
func (h *Handler) RegisterRoutes(rg gin.IRouter, protectedMW ...gin.HandlerFunc) {
	rg.GET("/posts", h.list)
	rg.GET("/posts/:slug", h.getBySlug)
	rg.GET("/tags", h.listTags)

	protected := rg.Group("", protectedMW...)
	protected.GET("/posts/stats", h.stats)
	protected.GET("/posts/stats/timeseries", h.timeseries)
	protected.POST("/posts", h.create)
	protected.PUT("/posts/:id", h.update)
	protected.DELETE("/posts/:id", h.delete)
}

// --- DTOs ---

type upsertRequest struct {
	Title       string          `json:"title"`
	Slug        string          `json:"slug"`
	ContentJSON json.RawMessage `json:"content_json"`
	ContentHTML string          `json:"content_html"`
	Excerpt     *string         `json:"excerpt"`
	CoverImage  *string         `json:"cover_image"`
	Status      PostStatus      `json:"status"`
	MetaTitle   *string         `json:"meta_title"`
	MetaDesc    *string         `json:"meta_desc"`
	Tags        []string        `json:"tags"`
}

type tagResponse struct {
	ID   uuid.UUID `json:"id"`
	Name string    `json:"name"`
	Slug string    `json:"slug"`
}

type postResponse struct {
	ID          uuid.UUID       `json:"id"`
	Title       string          `json:"title"`
	Slug        string          `json:"slug"`
	ContentJSON json.RawMessage `json:"content_json"`
	ContentHTML string          `json:"content_html"`
	Excerpt     *string         `json:"excerpt"`
	CoverImage  *string         `json:"cover_image"`
	Status      PostStatus      `json:"status"`
	MetaTitle   *string         `json:"meta_title"`
	MetaDesc    *string         `json:"meta_desc"`
	PublishedAt *time.Time      `json:"published_at"`
	Tags        []tagResponse   `json:"tags"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type listResponse struct {
	Data     []postResponse `json:"data"`
	Page     int            `json:"page"`
	PageSize int            `json:"page_size"`
	Total    int64          `json:"total"`
}

type statsResponse struct {
	Total     int64 `json:"total"`
	Published int64 `json:"published"`
	Draft     int64 `json:"draft"`
	Tags      int64 `json:"tags"`
}

// --- Handlers ---

func (h *Handler) list(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	p := pagination.Normalize(page, pageSize)

	posts, total, err := h.svc.List(c.Request.Context(), ListFilter{
		Status: c.Query("status"),
		Tag:    c.Query("tag"),
		Search: strings.TrimSpace(c.Query("q")),
		Sort:   c.Query("sort"),
		Order:  c.Query("order"),
		Authed: h.authed(c.Request.Context()),
		Limit:  p.PageSize,
		Offset: p.Offset(),
	})
	if err != nil {
		respondError(c, err)
		return
	}

	data := make([]postResponse, len(posts))
	for i := range posts {
		data[i] = toResponse(posts[i])
	}
	c.JSON(http.StatusOK, listResponse{Data: data, Page: p.Page, PageSize: p.PageSize, Total: total})
}

func (h *Handler) stats(c *gin.Context) {
	s, err := h.svc.Stats(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, statsResponse{
		Total:     s.Total,
		Published: s.Published,
		Draft:     s.Draft,
		Tags:      s.Tags,
	})
}

type monthCountResponse struct {
	Month string `json:"month"`
	Count int64  `json:"count"`
}

func (h *Handler) timeseries(c *gin.Context) {
	months, _ := strconv.Atoi(c.Query("months"))
	series, err := h.svc.TimeSeries(c.Request.Context(), months)
	if err != nil {
		respondError(c, err)
		return
	}
	data := make([]monthCountResponse, len(series))
	for i, mc := range series {
		data[i] = monthCountResponse{Month: mc.Month, Count: mc.Count}
	}
	c.JSON(http.StatusOK, data)
}

func (h *Handler) getBySlug(c *gin.Context) {
	ctx := c.Request.Context()
	post, err := h.svc.GetBySlug(ctx, c.Param("slug"), h.authed(ctx))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toResponse(*post))
}

func (h *Handler) create(c *gin.Context) {
	var req upsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	post, err := h.svc.Create(c.Request.Context(), CreateInput{
		Title:       req.Title,
		Slug:        req.Slug,
		ContentJSON: req.ContentJSON,
		ContentHTML: req.ContentHTML,
		Excerpt:     req.Excerpt,
		CoverImage:  req.CoverImage,
		Status:      req.Status,
		MetaTitle:   req.MetaTitle,
		MetaDesc:    req.MetaDesc,
		TagNames:    req.Tags,
	})
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusCreated, toResponse(*post))
}

func (h *Handler) update(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_ID", "id must be a valid uuid")
		return
	}
	var req upsertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
	post, err := h.svc.Update(c.Request.Context(), id, UpdateInput{
		Title:       req.Title,
		Slug:        req.Slug,
		ContentJSON: req.ContentJSON,
		ContentHTML: req.ContentHTML,
		Excerpt:     req.Excerpt,
		CoverImage:  req.CoverImage,
		Status:      req.Status,
		MetaTitle:   req.MetaTitle,
		MetaDesc:    req.MetaDesc,
		TagNames:    req.Tags,
	})
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toResponse(*post))
}

func (h *Handler) delete(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_ID", "id must be a valid uuid")
		return
	}
	if err := h.svc.Delete(c.Request.Context(), id); err != nil {
		respondError(c, err)
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *Handler) listTags(c *gin.Context) {
	ctx := c.Request.Context()
	tags, err := h.svc.ListTags(ctx, h.authed(ctx))
	if err != nil {
		respondError(c, err)
		return
	}
	data := make([]tagResponse, len(tags))
	for i, t := range tags {
		data[i] = tagResponse{ID: t.ID, Name: t.Name, Slug: t.Slug}
	}
	c.JSON(http.StatusOK, gin.H{"data": data})
}

// respondError map lỗi domain sang HTTP status + envelope lỗi.
func respondError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, ErrPostNotFound):
		httperr.Write(c, http.StatusNotFound, "POST_NOT_FOUND", "post not found")
	case errors.Is(err, ErrSlugTaken):
		httperr.Write(c, http.StatusConflict, "SLUG_TAKEN", "slug already taken")
	case errors.Is(err, ErrValidation):
		httperr.Write(c, http.StatusBadRequest, "VALIDATION_ERROR", err.Error())
	default:
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "internal server error")
	}
}

func toResponse(p Post) postResponse {
	tags := make([]tagResponse, len(p.Tags))
	for i, t := range p.Tags {
		tags[i] = tagResponse{ID: t.ID, Name: t.Name, Slug: t.Slug}
	}
	return postResponse{
		ID:          p.ID,
		Title:       p.Title,
		Slug:        p.Slug,
		ContentJSON: defaultJSON(p.ContentJSON),
		ContentHTML: p.ContentHTML,
		Excerpt:     p.Excerpt,
		CoverImage:  p.CoverImage,
		Status:      p.Status,
		MetaTitle:   p.MetaTitle,
		MetaDesc:    p.MetaDesc,
		PublishedAt: p.PublishedAt,
		Tags:        tags,
		CreatedAt:   p.CreatedAt,
		UpdatedAt:   p.UpdatedAt,
	}
}
