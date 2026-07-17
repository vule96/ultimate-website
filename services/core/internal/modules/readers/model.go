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

// readerRow map bảng readers.
type readerRow struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	GoogleSub string    `gorm:"column:google_sub;type:text;not null;uniqueIndex"`
	Email     string    `gorm:"type:text;not null"`
	Name      string    `gorm:"type:text"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
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
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email     string    `gorm:"type:citext;not null;uniqueIndex"`
	Status    string    `gorm:"type:text;not null;default:'active'"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
}

func (subscriberRow) TableName() string { return "subscribers" }

// Models trả model của package cho Atlas.
func Models() []any { return []any{&readerRow{}, &bookmarkRow{}, &subscriberRow{}} }
