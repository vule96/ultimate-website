// Package posts chứa module quản lý bài viết theo mô hình Clean-lite:
// domain (thuần) ← service (business logic) ← repository/handler (tầng ngoài).
package posts

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

// PostStatus là trạng thái vòng đời của một bài viết.
type PostStatus string

const (
	StatusDraft           PostStatus = "DRAFT"
	StatusPendingApproval PostStatus = "PENDING_APPROVAL"
	StatusPublished       PostStatus = "PUBLISHED"
)

// Valid cho biết trạng thái có nằm trong tập hợp lệ hay không.
func (s PostStatus) Valid() bool {
	switch s {
	case StatusDraft, StatusPendingApproval, StatusPublished:
		return true
	default:
		return false
	}
}

// Tag là nhãn phân loại bài viết.
type Tag struct {
	ID   uuid.UUID
	Name string
	Slug string
}

// Post là entity bài viết thuần domain (không phụ thuộc GORM/HTTP).
type Post struct {
	ID          uuid.UUID
	Title       string
	Slug        string
	ContentJSON json.RawMessage // Tiptap JSON (source of truth)
	ContentHTML string          // HTML render sẵn cho public/SEO
	Excerpt     *string
	CoverImage  *string
	// CoverBlurhash do worker nền tính từ CoverImage (Slice 9) — nil khi chưa có.
	CoverBlurhash *string
	Status        PostStatus
	MetaTitle     *string
	MetaDesc      *string
	PublishedAt   *time.Time
	Version       int64
	// Views cộng dồn bởi ViewCounter batch (Slice 9).
	Views     int64
	Tags      []Tag
	CreatedAt time.Time
	UpdatedAt time.Time
}

// Các lỗi domain (tầng ngoài dùng errors.Is để map sang HTTP).
var (
	ErrPostNotFound = errors.New("post not found")
	ErrSlugTaken    = errors.New("slug already taken")
	ErrValidation   = errors.New("validation error")
	// ErrVersionConflict: update với version cũ — bài đã bị writer khác sửa (M5).
	ErrVersionConflict = errors.New("post version conflict")
)

// validationErrorf tạo lỗi validation có thông điệp, vẫn khớp errors.Is(ErrValidation).
func validationErrorf(format string, args ...any) error {
	return fmt.Errorf("%w: %s", ErrValidation, fmt.Sprintf(format, args...))
}
