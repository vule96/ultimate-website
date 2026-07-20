// Package readers quản lý người đọc blog (auth Google OAuth — KHÁC admin allowlist),
// bookmark bài viết và đăng ký newsletter.
package readers

import (
	"time"

	"github.com/google/uuid"
)

// Reader là danh tính người đọc đã đăng nhập (domain).
type Reader struct {
	ID        uuid.UUID
	GoogleSub string
	Email     string
	Name      string
}

// Subscriber là người đăng ký newsletter (domain — cho admin xem/quản lý).
type Subscriber struct {
	ID        uuid.UUID
	Email     string
	Status    string
	CreatedAt time.Time
}

// ReaderWithCount là reader kèm số bookmark (admin list).
type ReaderWithCount struct {
	ID            uuid.UUID
	Email         string
	Name          string
	CreatedAt     time.Time
	BookmarkCount int64
}

// readerRow map bảng readers.
type readerRow struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	GoogleSub string    `gorm:"column:google_sub;type:text;not null;uniqueIndex"`
	Email     string    `gorm:"type:text;not null"`
	Name      string    `gorm:"type:text"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now();index:idx_readers_created_at,sort:desc"`
	UpdatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
}

func (readerRow) TableName() string { return "readers" }

// bookmarkRow map bảng bookmarks (khoá chính kép reader_id+post_id).
type bookmarkRow struct {
	ReaderID  uuid.UUID `gorm:"column:reader_id;type:uuid;primaryKey"`
	PostID    uuid.UUID `gorm:"column:post_id;type:uuid;primaryKey"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
}

func (bookmarkRow) TableName() string { return "bookmarks" }

// subscriberRow map bảng subscribers. Email dùng citext (unique không phân biệt hoa/thường).
type subscriberRow struct {
	ID               uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email            string    `gorm:"type:citext;not null;uniqueIndex"`
	Status           string    `gorm:"type:text;not null;default:'active'"`
	UnsubscribeToken uuid.UUID `gorm:"column:unsubscribe_token;type:uuid;not null;default:gen_random_uuid();uniqueIndex:idx_subscribers_unsub_token"`
	// DeletedAt: soft-delete (audit). Không dùng gorm.DeletedAt tự động vì muốn kiểm soát
	// filter tường minh ở query — nil = còn sống.
	DeletedAt *time.Time `gorm:"column:deleted_at;type:timestamptz"`
	CreatedAt time.Time  `gorm:"type:timestamptz;not null;default:now();index:idx_subscribers_created_at,sort:desc"`
}

func (subscriberRow) TableName() string { return "subscribers" }

// Models trả model của package cho Atlas.
func Models() []any { return []any{&readerRow{}, &bookmarkRow{}, &subscriberRow{}} }
