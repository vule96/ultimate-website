package posts

import (
	"context"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

// fakeCache là Cache in-memory cho test: map + version int (không cần Redis).
type fakeCache struct {
	mu   sync.Mutex
	data map[string][]byte
	ver  int64
}

func newFakeCache() *fakeCache { return &fakeCache{data: map[string][]byte{}} }

func (f *fakeCache) Get(_ context.Context, key string) ([]byte, bool) {
	f.mu.Lock()
	defer f.mu.Unlock()
	v, ok := f.data[key]
	return v, ok
}
func (f *fakeCache) Set(_ context.Context, key string, val []byte, _ time.Duration) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.data[key] = val
}
func (f *fakeCache) Version(_ context.Context, _ string) int64 {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.ver
}
func (f *fakeCache) BumpVersion(_ context.Context, _ string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.ver++
}

// spyRepo đếm call xuống repo thật.
type spyRepo struct {
	Repository // embed nil — chỉ override method dùng trong test
	listCalls  int
	slugCalls  int
	tagCalls   int
}

func (s *spyRepo) List(context.Context, ListFilter) ([]Post, int64, error) {
	s.listCalls++
	return []Post{{ID: uuid.New(), Title: "Bài A"}}, 1, nil
}
func (s *spyRepo) GetBySlug(context.Context, string) (*Post, error) {
	s.slugCalls++
	return &Post{ID: uuid.New(), Slug: "bai-a"}, nil
}
func (s *spyRepo) ListTags(context.Context, bool) ([]Tag, error) {
	s.tagCalls++
	return []Tag{{Name: "Go", Slug: "go"}}, nil
}
func (s *spyRepo) Create(context.Context, *Post) error { return nil }

func TestCachedRepo_ListPublicHitSkipsInner(t *testing.T) {
	spy := &spyRepo{}
	r := NewCachedRepository(spy, newFakeCache(), metrics.New())
	f := ListFilter{Authed: false, Limit: 10}
	ctx := context.Background()

	if _, _, err := r.List(ctx, f); err != nil {
		t.Fatal(err)
	}
	if _, _, err := r.List(ctx, f); err != nil {
		t.Fatal(err)
	}
	if spy.listCalls != 1 {
		t.Errorf("listCalls = %d, want 1 (lần 2 phải hit cache)", spy.listCalls)
	}
}

func TestCachedRepo_AuthedBypassesCache(t *testing.T) {
	spy := &spyRepo{}
	r := NewCachedRepository(spy, newFakeCache(), metrics.New())
	f := ListFilter{Authed: true, Limit: 10}
	ctx := context.Background()

	_, _, _ = r.List(ctx, f)
	_, _, _ = r.List(ctx, f)
	if spy.listCalls != 2 {
		t.Errorf("listCalls = %d, want 2 (authed không cache)", spy.listCalls)
	}
}

func TestCachedRepo_WriteBumpsVersionInvalidates(t *testing.T) {
	spy := &spyRepo{}
	r := NewCachedRepository(spy, newFakeCache(), metrics.New())
	f := ListFilter{Authed: false, Limit: 10}
	ctx := context.Background()

	_, _, _ = r.List(ctx, f)               // miss → cache
	_ = r.Create(ctx, &Post{Title: "Mới"}) // bump version
	_, _, _ = r.List(ctx, f)               // key mới → miss → gọi inner lần 2
	if spy.listCalls != 2 {
		t.Errorf("listCalls = %d, want 2 (version bump phải vô hiệu key cũ)", spy.listCalls)
	}
}

func TestCachedRepo_GetBySlugAndTagsCached(t *testing.T) {
	spy := &spyRepo{}
	r := NewCachedRepository(spy, newFakeCache(), metrics.New())
	ctx := context.Background()

	_, _ = r.GetBySlug(ctx, "bai-a")
	_, _ = r.GetBySlug(ctx, "bai-a")
	if spy.slugCalls != 1 {
		t.Errorf("slugCalls = %d, want 1", spy.slugCalls)
	}

	_, _ = r.ListTags(ctx, true)
	_, _ = r.ListTags(ctx, true)
	if spy.tagCalls != 1 {
		t.Errorf("tagCalls = %d, want 1", spy.tagCalls)
	}
	_, _ = r.ListTags(ctx, false) // admin → bypass
	if spy.tagCalls != 2 {
		t.Errorf("tagCalls = %d, want 2 (publishedOnly=false bypass)", spy.tagCalls)
	}
}
