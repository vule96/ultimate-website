// Package cache cung cấp cache-aside với invalidation kiểu key-versioning:
// key chứa version của nhóm dữ liệu; write chỉ cần bump version (INCR) —
// key cũ không ai đọc nữa, TTL tự dọn. O(1), không SCAN/DEL theo prefix.
package cache

import (
	"context"
	"time"
)

// Cache là cổng cache của ứng dụng. MỌI lỗi hạ tầng (Redis down/timeout) được
// impl nuốt + log — caller chỉ thấy miss, request không bao giờ fail vì cache.
type Cache interface {
	// Get trả (value, true) khi hit; miss hoặc lỗi → (nil, false).
	Get(ctx context.Context, key string) ([]byte, bool)
	// Set ghi value với TTL. Lỗi → bỏ qua (best-effort).
	Set(ctx context.Context, key string, val []byte, ttl time.Duration)
	// Version đọc version hiện tại của nhóm (0 khi chưa có/lỗi).
	Version(ctx context.Context, name string) int64
	// BumpVersion tăng version nhóm — vô hiệu hoá mọi key cũ của nhóm đó.
	BumpVersion(ctx context.Context, name string)
}

// Noop là cache tắt (REDIS_URL rỗng): mọi Get miss, Set/Bump no-op.
type Noop struct{}

// NewNoop tạo cache no-op.
func NewNoop() Noop { return Noop{} }

func (Noop) Get(context.Context, string) ([]byte, bool)         { return nil, false }
func (Noop) Set(context.Context, string, []byte, time.Duration) {}
func (Noop) Version(context.Context, string) int64              { return 0 }
func (Noop) BumpVersion(context.Context, string)                {}
