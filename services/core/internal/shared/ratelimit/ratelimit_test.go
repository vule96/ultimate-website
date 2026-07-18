package ratelimit

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newRDB(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()}), mr
}

func serve(rdb redis.Cmdable, limit int) http.Handler {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(PerIP(rdb, slog.Default(), "test", limit, time.Minute))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func hit(h http.Handler) int {
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.RemoteAddr = "1.2.3.4:5555"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w.Code
}

func TestPerIP_BlocksOverLimit(t *testing.T) {
	rdb, _ := newRDB(t)
	h := serve(rdb, 2)
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusTooManyRequests, hit(h)) // vượt ngưỡng 2
}

func TestPerIP_WindowRollover(t *testing.T) {
	rdb, mr := newRDB(t)
	h := serve(rdb, 1)
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusTooManyRequests, hit(h))
	mr.FastForward(time.Minute + time.Second) // qua window mới
	require.Equal(t, http.StatusOK, hit(h))
}

func TestPerIP_NilRedisFailOpen(t *testing.T) {
	h := serve(nil, 1)
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusOK, hit(h)) // no-op, không chặn
}
