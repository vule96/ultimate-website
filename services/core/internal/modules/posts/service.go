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
	ListTags(ctx context.Context, publishedOnly bool) ([]Tag, error)
	Stats(ctx context.Context) (StatsResult, error)
	CountByMonth(ctx context.Context, since time.Time) (map[string]int64, error)
}

// ListFilter là điều kiện lọc + phân trang cho danh sách bài viết.
type ListFilter struct {
	Status string // lọc theo trạng thái (rỗng = tất cả)
	Tag    string // lọc theo slug tag (rỗng = tất cả)
	Search string // tìm theo tiêu đề (ILIKE, rỗng = tất cả)
	Sort   string // cột sắp xếp (whitelist; rỗng/lạ = created_at)
	Order  string // asc | desc (mặc định desc)
	Authed bool   // request đã đăng nhập admin chưa; false → chỉ thấy PUBLISHED
	Limit  int
	Offset int
}

// StatsResult là số liệu tổng hợp về bài viết cho Dashboard.
type StatsResult struct {
	Total      int64 // tổng số bài (mọi trạng thái)
	Published  int64 // số bài PUBLISHED
	Draft      int64 // số bài DRAFT
	Tags       int64 // số tag phân biệt
	TotalViews int64 // tổng lượt xem tất cả bài
}

// MonthCount là số bài viết trong một tháng ("YYYY-MM").
type MonthCount struct {
	Month string
	Count int64
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
	Version     int64 // optimistic locking (M5)
}

// Service chứa business logic của module posts.
type Service struct {
	repo Repository
	now  func() time.Time
	// enqueueBlurhash đẩy job tính blurhash cho cover (worker nền, Slice 9).
	// nil = tính năng tắt. KHÔNG blocking — impl là channel send non-blocking.
	enqueueBlurhash func(id uuid.UUID, coverURL string)
	// enqueueContentMeta đẩy job tính meta ảnh trong content (Slice 12).
	enqueueContentMeta func(id uuid.UUID, contentHTML string)
}

// NewService tạo Service với đồng hồ mặc định time.Now.
func NewService(repo Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

// WithBlurhashEnqueuer gắn hook enqueue blurhash (chainable, optional).
func (s *Service) WithBlurhashEnqueuer(fn func(id uuid.UUID, coverURL string)) *Service {
	s.enqueueBlurhash = fn
	return s
}

// WithContentMetaEnqueuer gắn hook enqueue meta ảnh content (chainable, optional).
func (s *Service) WithContentMetaEnqueuer(fn func(id uuid.UUID, contentHTML string)) *Service {
	s.enqueueContentMeta = fn
	return s
}

// maybeEnqueueContentMeta đẩy job khi content đổi và không rỗng — worker tự
// bỏ qua nếu không có ảnh (parse rẻ).
func (s *Service) maybeEnqueueContentMeta(p *Post, oldContent string) {
	if s.enqueueContentMeta == nil || p.ContentHTML == "" || p.ContentHTML == oldContent {
		return
	}
	s.enqueueContentMeta(p.ID, p.ContentHTML)
}

// maybeEnqueueBlurhash đẩy job khi cover mới non-empty và khác cover cũ.
func (s *Service) maybeEnqueueBlurhash(p *Post, oldCover *string) {
	if s.enqueueBlurhash == nil || p.CoverImage == nil || *p.CoverImage == "" {
		return
	}
	if oldCover != nil && *oldCover == *p.CoverImage {
		return // cover không đổi — blurhash cũ vẫn đúng
	}
	s.enqueueBlurhash(p.ID, *p.CoverImage)
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
	s.maybeEnqueueBlurhash(p, nil)
	s.maybeEnqueueContentMeta(p, "")
	return p, nil
}

// Update tải bài viết hiện có, áp thay đổi và lưu lại.
func (s *Service) Update(ctx context.Context, id uuid.UUID, in UpdateInput) (*Post, error) {
	existing, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	// Giữ cover + content cũ trước khi ghi đè — quyết định có cần tính lại meta không.
	existingCoverBeforeUpdate := existing.CoverImage
	existingContentBeforeUpdate := existing.ContentHTML

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
	// M5: version phải là bản client đang cầm (không phải bản vừa GetByID) —
	// repo dùng nó làm điều kiện WHERE để phát hiện lost-update.
	existing.Version = in.Version

	// Đặt published_at lần đầu chuyển sang PUBLISHED; giữ nguyên nếu đã có.
	if status == StatusPublished && existing.PublishedAt == nil {
		t := s.now()
		existing.PublishedAt = &t
	}
	if status != StatusPublished {
		existing.PublishedAt = nil
	}

	oldCover := existingCoverBeforeUpdate
	if err := s.repo.Update(ctx, existing); err != nil {
		return nil, err
	}
	s.maybeEnqueueBlurhash(existing, oldCover)
	s.maybeEnqueueContentMeta(existing, existingContentBeforeUpdate)
	return existing, nil
}

// GetBySlug trả về bài viết theo slug. Request chưa đăng nhập chỉ thấy bài
// PUBLISHED — bài khác trả ErrPostNotFound (404, không lộ tồn tại của slug).
func (s *Service) GetBySlug(ctx context.Context, slug string, authed bool) (*Post, error) {
	p, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if !authed && p.Status != StatusPublished {
		return nil, ErrPostNotFound
	}
	return p, nil
}

// List trả về danh sách bài viết theo filter + tổng số bản ghi. Request chưa
// đăng nhập bị ép Status=PUBLISHED bất kể filter xin gì (trust boundary ở API).
func (s *Service) List(ctx context.Context, f ListFilter) ([]Post, int64, error) {
	if !f.Authed {
		f.Status = string(StatusPublished)
	}
	return s.repo.List(ctx, f)
}

// Delete xoá bài viết theo id.
func (s *Service) Delete(ctx context.Context, id uuid.UUID) error {
	return s.repo.Delete(ctx, id)
}

// ListTags trả về tag. Request chưa đăng nhập chỉ thấy tag gắn với ít nhất một
// bài PUBLISHED — tránh lộ metadata (tên/slug tag) của bài DRAFT/PENDING.
func (s *Service) ListTags(ctx context.Context, authed bool) ([]Tag, error) {
	return s.repo.ListTags(ctx, !authed)
}

// Stats trả về số liệu tổng hợp bài viết cho Dashboard.
func (s *Service) Stats(ctx context.Context) (StatsResult, error) {
	return s.repo.Stats(ctx)
}

// TimeSeries trả về số bài viết theo tháng cho `months` tháng gần nhất (tính cả
// tháng hiện tại), zero-fill các tháng không có bài. months bị chặn trong [1, 24].
func (s *Service) TimeSeries(ctx context.Context, months int) ([]MonthCount, error) {
	if months < 1 {
		months = 8
	}
	if months > 24 {
		months = 24
	}

	now := s.now().UTC()
	start := time.Date(now.Year(), now.Month(), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -(months - 1), 0)

	counts, err := s.repo.CountByMonth(ctx, start)
	if err != nil {
		return nil, err
	}

	series := make([]MonthCount, months)
	for i := 0; i < months; i++ {
		m := start.AddDate(0, i, 0).Format("2006-01")
		series[i] = MonthCount{Month: m, Count: counts[m]}
	}
	return series, nil
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
