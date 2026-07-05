package posts

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
	"github.com/vule96/ultimate-website/services/core/internal/shared/pagination"
)

// Handler expose module posts qua HTTP (Gin).
type Handler struct {
	svc *Service
}

// NewHandler tạo Handler từ Service.
func NewHandler(svc *Service) *Handler { return &Handler{svc: svc} }

// RegisterRoutes gắn các route của module posts vào router group cho trước.
func (h *Handler) RegisterRoutes(rg gin.IRouter) {
	rg.GET("/posts", h.list)
	rg.GET("/posts/:slug", h.getBySlug)
	rg.POST("/posts", h.create)    // TODO(slice-2): require auth
	rg.PUT("/posts/:id", h.update) // TODO(slice-2): require auth
	rg.DELETE("/posts/:id", h.delete)
	rg.GET("/tags", h.listTags)
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

// --- Handlers ---

func (h *Handler) list(c *gin.Context) {
	page, _ := strconv.Atoi(c.Query("page"))
	pageSize, _ := strconv.Atoi(c.Query("page_size"))
	p := pagination.Normalize(page, pageSize)

	posts, total, err := h.svc.List(c.Request.Context(), ListFilter{
		Status: c.Query("status"),
		Tag:    c.Query("tag"),
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

func (h *Handler) getBySlug(c *gin.Context) {
	post, err := h.svc.GetBySlug(c.Request.Context(), c.Param("slug"))
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
	tags, err := h.svc.ListTags(c.Request.Context())
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
