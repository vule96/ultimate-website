package cache

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"github.com/redis/go-redis/v9"
)

// opTimeout chặn mọi lệnh Redis vượt 100ms — cache chậm hơn DB là vô nghĩa,
// và Redis treo không được phép kéo sập latency API.
const opTimeout = 100 * time.Millisecond

// Redis là impl Cache trên go-redis. Lỗi ops → log warn + hành xử như miss.
type Redis struct {
	client *redis.Client
	log    *slog.Logger
}

// NewRedis parse REDIS_URL (redis://[:pass@]host:port/db) và ping thử.
// Ping lỗi chỉ log warn (Redis có thể lên sau) — không chặn boot.
func NewRedis(url string, log *slog.Logger) (*Redis, error) {
	opts, err := redis.ParseURL(url)
	if err != nil {
		return nil, err
	}
	client := redis.NewClient(opts)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := client.Ping(ctx).Err(); err != nil {
		log.Warn("cache: redis ping failed — vẫn tiếp tục, ops sẽ fallback miss", "err", err)
	}
	return &Redis{client: client, log: log}, nil
}

func (r *Redis) Get(ctx context.Context, key string) ([]byte, bool) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	val, err := r.client.Get(ctx, key).Bytes()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			r.log.Warn("cache: get failed", "key", key, "err", err)
		}
		return nil, false
	}
	return val, true
}

func (r *Redis) Set(ctx context.Context, key string, val []byte, ttl time.Duration) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	if err := r.client.Set(ctx, key, val, ttl).Err(); err != nil {
		r.log.Warn("cache: set failed", "key", key, "err", err)
	}
}

func (r *Redis) Version(ctx context.Context, name string) int64 {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	v, err := r.client.Get(ctx, name+":ver").Int64()
	if err != nil {
		if !errors.Is(err, redis.Nil) {
			r.log.Warn("cache: get version failed", "name", name, "err", err)
		}
		return 0
	}
	return v
}

func (r *Redis) BumpVersion(ctx context.Context, name string) {
	ctx, cancel := context.WithTimeout(ctx, opTimeout)
	defer cancel()
	if err := r.client.Incr(ctx, name+":ver").Err(); err != nil {
		r.log.Warn("cache: bump version failed", "name", name, "err", err)
	}
}
