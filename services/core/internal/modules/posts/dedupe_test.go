package posts

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newRDB(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()}), mr
}

func TestDeduper_FirstThenDup(t *testing.T) {
	rdb, _ := newRDB(t)
	d := NewViewDeduper(rdb, "salt")
	ctx := context.Background()
	require.True(t, d.FirstToday(ctx, "slug-a", "r:1"))  // lần đầu
	require.False(t, d.FirstToday(ctx, "slug-a", "r:1")) // trùng
	require.True(t, d.FirstToday(ctx, "slug-a", "r:2"))  // reader khác
	require.True(t, d.FirstToday(ctx, "slug-b", "r:1"))  // bài khác
}

func TestDeduper_TTLSet(t *testing.T) {
	rdb, mr := newRDB(t)
	d := NewViewDeduper(rdb, "salt")
	d.FirstToday(context.Background(), "slug-a", "r:1")
	keys := mr.Keys()
	require.NotEmpty(t, keys)
	ttl := mr.TTL(keys[0])
	require.Greater(t, ttl, time.Hour) // ~48h
}

func TestDeduper_NilFailOpen(t *testing.T) {
	d := NewViewDeduper(nil, "salt")
	require.True(t, d.FirstToday(context.Background(), "s", "r:1"))
	require.True(t, d.FirstToday(context.Background(), "s", "r:1")) // vẫn true — đếm hết
}
