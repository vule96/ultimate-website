package posts

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Repository là cổng (port) truy cập dữ liệu bài viết. Tầng service phụ thuộc
// interface này, không biết cài đặt cụ thể (GORM/Postgres).
type Repository interface {
	Create(ctx context.Context, p *Post) error
	Update(ctx context.Context, p *Post) error
	GetByID(ctx context.Context, id uuid.UUID) (*Post, error)
	GetBySlug(ctx context.Context, slug string) (*Post, error)
	List(ctx context.Context, f ListFilter) ([]Post, int64, error)
	Delete(ctx context.Context, id uuid.UUID) error
	ListTags(ctx context.Context) ([]Tag, error)
	Stats(ctx context.Context) (StatsResult, error)
}

// ListFilter là điều kiện lọc + phân trang cho danh sách bài viết.
type ListFilter struct {
	Status string // lọc theo trạng thái (rỗng = tất cả)
	Tag    string // lọc theo slug tag (rỗng = tất cả)
	Search string // tìm theo tiêu đề (ILIKE, rỗng = tất cả)
	Limit  int
	Offset int
}

// StatsResult là số liệu tổng hợp về bài viết cho Dashboard.
type StatsResult struct {
	Total     int64 // tổng số bài (mọi trạng thái)
	Published int64 // số bài PUBLISHED
	Draft     int64 // số bài DRAFT
	Tags      int64 // số tag phân biệt
}

// CreateInput là dữ liệu đầu vào tạo bài viết.
type CreateInput struct {
	Title       string
	Slug        string // tuỳ chọn; rỗng → suy ra từ Title
	ContentJSON json.RawMessage
	ContentHTML string
	Excerpt     *string
	CoverImage  *string
	Status      PostStatus // tuỳ chọn; rỗng → DRAFT
	MetaTitle   *string
	MetaDesc    *string
	TagNames    []string
}

// UpdateInput là dữ liệu đầu vào cập nhật bài viết (các trường đều ghi đè).
type UpdateInput struct {
	Title       string
	Slug        string
	ContentJSON json.RawMessage
	ContentHTML string
	Excerpt     *string
	CoverImage  *string
	Status      PostStatus
	MetaTitle   *string
	MetaDesc    *string
	TagNames    []string
}

// Service chứa business logic của module posts.
type Service struct {
	repo Repository
	now  func() time.Time
}

// NewService tạo Service với đồng hồ mặc định time.Now.
func NewService(repo Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

// Create validate đầu vào, chuẩn hoá slug/status/tags rồi lưu bài viết.
func (s *Service) Create(ctx context.Context, in CreateInput) (*Post, error) {
	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, validationErrorf("title is required")
	}

	status := in.Status
	if status == "" {
		status = StatusDraft
	}
	if !status.Valid() {
		return nil, validationErrorf("invalid status %q", in.Status)
	}

	slug := deriveSlug(in.Slug, title)
	if slug == "" {
		return nil, validationErrorf("could not derive slug from title")
	}

	p := &Post{
		Title:       title,
		Slug:        slug,
		ContentJSON: defaultJSON(in.ContentJSON),
		ContentHTML: in.ContentHTML,
		Excerpt:     in.Excerpt,
		CoverImage:  in.CoverImage,
		Status:      status,
		MetaTitle:   in.MetaTitle,
		MetaDesc:    in.MetaDesc,
		Tags:        normalizeTags(in.TagNames),
	}
	if status == StatusPublished {
		t := s.now()
		p.PublishedAt = &t
	}

	if err := s.repo.Create(ctx, p); err != nil {
		return nil, err
	}
	return p, nil
}

// Update tải bài viết hiện có, áp thay đổi và lưu lại.
func (s *Service) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (*Post, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	title := strings.TrimSpace(in.Title)
	if title == "" {
		return nil, validationErrorf("title is required")
	}
	status := in.Status
	if status == "" {
		status = StatusDraft
	}
	if !status.Valid() {
		return nil, validationErrorf("invalid status %q", in.Status)
	}
	slug := deriveSlug(in.Slug, title)
	if slug == "" {
		return nil, validationErrorf("could not derive slug from title")
	}

	existing.Title = title
	existing.Slug = slug
	existing.ContentJSON = defaultJSON(in.ContentJSON)
	existing.ContentHTML = in.ContentHTML
	existing.Excerpt = in.Excerpt
	existing.CoverImage = in.CoverImage
	existing.Status = status
	existing.MetaTitle = in.MetaTitle
	existing.MetaDesc = in.MetaDesc
	existing.Tags = normalizeTags(in.TagNames)

	// Đặt published_at lần đầu chuyển sang PUBLISHED; giữ nguyên nếu đã có.
	if status == StatusPublished && existing.PublishedAt == nil {
		t := s.now()
		existing.PublishedAt = &t
	}
	if status != StatusPublished {
		existing.PublishedAt = nil
	}

	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	return existing, nil
}

// GetBySlug trả về bài viết theo slug.
func (s *Service) GetBySlug(ctx context.Context, slug string) (*Post, error) {
	return s.repo.GetBySlug(ctx, slug)
}

// List trả về danh sách bài viết theo filter + tổng số bản ghi.
func (s *Service) List(ctx context.Context, f ListFilter) ([]Post, int64, error) {
	return s.repo.List(ctx, f)
}

// Delete xoá bài viết theo id.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// ListTags trả về toàn bộ tag.
func (s *Service) ListTags(ctx context.Context) ([]Tag, error) {
	return s.repo.ListTags(ctx)
}

// Stats trả về số liệu tổng hợp bài viết cho Dashboard.
func (s *Service) Stats(ctx context.Context) (StatsResult, error) {
	return s.repo.Stats(ctx)
}

// deriveSlug chọn nguồn slug (ưu tiên explicit) rồi slugify.
func deriveSlug(explicit, title string) string {
	if strings.TrimSpace(explicit) != "" {
		return Slugify(explicit)
	}
	return Slugify(title)
}

// normalizeTags trim, bỏ rỗng và loại trùng theo slug, giữ thứ tự xuất hiện.
func normalizeTags(names []string) []Tag {
	seen := make(map[string]struct{})
	var tags []Tag
	for _, raw := range names {
		name := strings.TrimSpace(raw)
		if name == "" {
			continue
		}
		slug := Slugify(name)
		if slug == "" {
			continue
		}
		if _, dup := seen[slug]; dup {
			continue
		}
		seen[slug] = struct{}{}
		tags = append(tags, Tag{Name: name, Slug: slug})
	}
	return tags
}

// defaultJSON đảm bảo content_json luôn là JSON hợp lệ (mặc định "{}").
func defaultJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`{}`)
	}
	return raw
}
