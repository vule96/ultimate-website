package posts

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/platform/cache"
	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

// TTL từng nhóm dữ liệu — list đổi thường xuyên hơn detail.
const (
	listTTL = 60 * time.Second
	slugTTL = 5 * time.Minute
	tagsTTL = 5 * time.Minute
)

// verGroup là nhóm version chung cho mọi key module posts (tags gắn với post
// nên dùng chung nhóm — một write bất kỳ vô hiệu toàn bộ).
const verGroup = "posts"

// cachedRepository là decorator cache-aside quanh Repository thật.
// CHỈ cache đường đọc công khai (anonymous); đường đọc admin (Authed,
// publishedOnly=false, Stats...) đi thẳng DB để luôn thấy dữ liệu mới nhất.
type cachedRepository struct {
	Repository
	c cache.Cache
	m *metrics.Metrics
}

// NewCachedRepository bọc repo bằng cache. c = Noop → hành vi y hệt repo gốc.
func NewCachedRepository(inner Repository, c cache.Cache, m *metrics.Metrics) Repository {
	return &cachedRepository{Repository: inner, c: c, m: m}
}

type listPayload struct {
	Posts []Post
	Total int64
}

func (r *cachedRepository) List(ctx context.Context, f ListFilter) ([]Post, int64, error) {
	if f.Authed {
		return r.Repository.List(ctx, f)
	}
	ver := r.c.Version(ctx, verGroup)
	key := cache.Key("posts_list", ver,
		f.Status, f.Tag, f.Search, f.Sort, f.Order,
		strconv.Itoa(f.Limit), strconv.Itoa(f.Offset))

	if raw, ok := r.c.Get(ctx, key); ok {
		var p listPayload
		if err := json.Unmarshal(raw, &p); err == nil {
			r.m.CacheHit("posts_list")
			return p.Posts, p.Total, nil
		}
	}
	r.m.CacheMiss("posts_list")

	posts, total, err := r.Repository.List(ctx, f)
	if err != nil {
		return nil, 0, err
	}
	if raw, err := json.Marshal(listPayload{Posts: posts, Total: total}); err == nil {
		r.c.Set(ctx, key, raw, listTTL)
	}
	return posts, total, nil
}

func (r *cachedRepository) GetBySlug(ctx context.Context, slug string) (*Post, error) {
	// Cache bản thô — service vẫn ép visibility sau khi đọc, nên authed/anon
	// dùng chung an toàn.
	ver := r.c.Version(ctx, verGroup)
	key := cache.Key("posts_slug", ver, slug)

	if raw, ok := r.c.Get(ctx, key); ok {
		var p Post
		if err := json.Unmarshal(raw, &p); err == nil {
			r.m.CacheHit("posts_slug")
			return &p, nil
		}
	}
	r.m.CacheMiss("posts_slug")

	p, err := r.Repository.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if raw, err := json.Marshal(p); err == nil {
		r.c.Set(ctx, key, raw, slugTTL)
	}
	return p, nil
}

func (r *cachedRepository) ListTags(ctx context.Context, publishedOnly bool) ([]Tag, error) {
	if !publishedOnly {
		return r.Repository.ListTags(ctx, publishedOnly)
	}
	ver := r.c.Version(ctx, verGroup)
	key := cache.Key("tags", ver, "published")

	if raw, ok := r.c.Get(ctx, key); ok {
		var tags []Tag
		if err := json.Unmarshal(raw, &tags); err == nil {
			r.m.CacheHit("tags")
			return tags, nil
		}
	}
	r.m.CacheMiss("tags")

	tags, err := r.Repository.ListTags(ctx, publishedOnly)
	if err != nil {
		return nil, err
	}
	if raw, err := json.Marshal(tags); err == nil {
		r.c.Set(ctx, key, raw, tagsTTL)
	}
	return tags, nil
}

// --- Write path: xong việc → bump version, mọi key cũ của module chết ngay. ---

func (r *cachedRepository) Create(ctx context.Context, p *Post) error {
	if err := r.Repository.Create(ctx, p); err != nil {
		return err
	}
	r.c.BumpVersion(ctx, verGroup)
	return nil
}

func (r *cachedRepository) Update(ctx context.Context, p *Post) error {
	if err := r.Repository.Update(ctx, p); err != nil {
		return err
	}
	r.c.BumpVersion(ctx, verGroup)
	return nil
}

func (r *cachedRepository) Delete(ctx context.Context, id uuid.UUID) error {
	if err := r.Repository.Delete(ctx, id); err != nil {
		return err
	}
	r.c.BumpVersion(ctx, verGroup)
	return nil
}
