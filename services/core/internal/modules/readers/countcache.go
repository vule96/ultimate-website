package readers

import (
	"context"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// countTTL: đếm subscriber/reader chấp nhận stale ngắn (con số hiển thị admin) để
// tránh COUNT(*) mỗi request. Không bump khi write — hết TTL tự đúng lại.
const countTTL = 30 * time.Second

// redisCountCache là countCache backed Redis. Fail-open: mọi lỗi Redis → coi như miss
// (Get) hoặc bỏ qua (Set) → service tự đếm thẳng DB.
type redisCountCache struct{ rdb redis.Cmdable }

// NewCountCache trả countCache dùng Redis; rdb nil → noop (cache tắt, luôn đếm thẳng).
func NewCountCache(rdb redis.Cmdable) countCache {
	if rdb == nil {
		return noopCountCache{}
	}
	return redisCountCache{rdb: rdb}
}

func (c redisCountCache) Get(ctx context.Context, key string) (int64, bool) {
	s, err := c.rdb.Get(ctx, "count:"+key).Result()
	if err != nil {
		return 0, false
	}
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return 0, false
	}
	return n, true
}

func (c redisCountCache) Set(ctx context.Context, key string, v int64) {
	c.rdb.Set(ctx, "count:"+key, v, countTTL)
}
