package posts

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

const dedupeTTL = 48 * time.Hour
const dedupeOpTimeout = 100 * time.Millisecond

// ViewDeduper chặn đếm trùng: 1 identity (reader id hoặc IP hash) chỉ tính 1 view
// mỗi bài mỗi ngày. Dùng Redis SET + TTL. nil/redis lỗi → fail-open (đếm bình thường).
type ViewDeduper struct {
	rdb  redis.Cmdable
	salt string
}

func NewViewDeduper(rdb redis.Cmdable, salt string) *ViewDeduper {
	return &ViewDeduper{rdb: rdb, salt: salt}
}

// FirstToday: true nếu (identity, slug) mới trong ngày (nên đếm). SADD trả 1 = mới.
func (d *ViewDeduper) FirstToday(ctx context.Context, slug, identity string) bool {
	if d == nil || d.rdb == nil {
		return true
	}
	ctx, cancel := context.WithTimeout(ctx, dedupeOpTimeout)
	defer cancel()
	key := "views:seen:" + slug + ":" + time.Now().UTC().Format("20060102")
	added, err := d.rdb.SAdd(ctx, key, identity).Result()
	if err != nil {
		return true // fail-open
	}
	if added == 1 {
		d.rdb.Expire(ctx, key, dedupeTTL)
	}
	return added == 1
}
