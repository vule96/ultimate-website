// Package session cấu hình quản lý session server-side (scs + Postgres).
package session

import (
	"database/sql"
	"net/http"
	"time"

	"github.com/alexedwards/scs/postgresstore"
	"github.com/alexedwards/scs/v2"
)

// Config là cấu hình cookie/lifetime cho session manager.
type Config struct {
	Lifetime time.Duration
	SameSite http.SameSite
	Secure   bool
}

// New tạo scs.SessionManager dùng Postgres store.
func New(db *sql.DB, cfg Config) *scs.SessionManager {
	sm := scs.New()
	sm.Store = postgresstore.New(db)
	sm.Lifetime = cfg.Lifetime
	sm.Cookie.HttpOnly = true
	sm.Cookie.Path = "/"
	sm.Cookie.SameSite = cfg.SameSite
	sm.Cookie.Secure = cfg.Secure
	return sm
}

// ParseSameSite chuyển chuỗi env sang http.SameSite (mặc định Lax nếu không hợp lệ).
func ParseSameSite(s string) http.SameSite {
	switch s {
	case "none":
		return http.SameSiteNoneMode
	case "strict":
		return http.SameSiteStrictMode
	default:
		return http.SameSiteLaxMode
	}
}

// gormSession là model để Atlas quản lý bảng "sessions" mà scs dùng runtime.
// Khớp schema mà scs/postgresstore mong đợi (token/data/expiry).
type gormSession struct {
	Token  string    `gorm:"primaryKey;type:text"`
	Data   []byte    `gorm:"type:bytea;not null"`
	Expiry time.Time `gorm:"type:timestamptz;not null;index"`
}

func (gormSession) TableName() string { return "sessions" }

// Models trả về model của package cho công cụ migration (Atlas).
func Models() []any { return []any{&gormSession{}} }
