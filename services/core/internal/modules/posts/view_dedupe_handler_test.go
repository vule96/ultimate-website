package posts

import (
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"

	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

// newViewHandlerServer dựng engine chỉ với route POST /posts/:slug/view, gắn
// ViewCounter (chưa Run — assert qua Buffered()) + ViewDeduper thật (miniredis)
// + readerIdentity tuỳ chọn. svc không được view() dùng nên để nil an toàn.
func newViewHandlerServer(t *testing.T, readerID func(context.Context) string) (*gin.Engine, *ViewCounter, *miniredis.Miniredis) {
	t.Helper()
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})

	vc := NewViewCounter(newFakeSink(), metrics.New(), slog.Default(), 16, time.Hour) // interval dài — không tự flush giữa test
	h := NewHandler(nil, func(context.Context) bool { return false }).
		WithViewCounter(vc).
		WithDeduper(NewViewDeduper(rdb, "salt"), "salt")
	if readerID != nil {
		h.WithReaderIdentity(readerID)
	}

	r := gin.New()
	h.RegisterRoutes(r.Group("/api/v1"))
	return r, vc, mr
}

func postView(r *gin.Engine, id, remoteAddr string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/api/v1/posts/"+id+"/view", nil)
	req.RemoteAddr = remoteAddr
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestViewDedupe_SecondRequestSameIPShortCircuits(t *testing.T) {
	r, vc, _ := newViewHandlerServer(t, nil)
	id := uuid.NewString()

	w1 := postView(r, id, "203.0.113.1:1234")
	if w1.Code != http.StatusAccepted {
		t.Fatalf("first view status = %d, want 202; body=%s", w1.Code, w1.Body.String())
	}
	buffered1 := vc.Buffered()

	w2 := postView(r, id, "203.0.113.1:1234") // IP giống — dedupe
	if w2.Code != http.StatusAccepted {
		t.Fatalf("second view status = %d, want 202; body=%s", w2.Code, w2.Body.String())
	}
	buffered2 := vc.Buffered()

	if buffered1 != 1 {
		t.Fatalf("buffered sau request 1 = %d, want 1", buffered1)
	}
	if buffered2 != 1 {
		t.Fatalf("buffered sau request 2 = %d, want vẫn 1 (bị dedupe, không enqueue thêm)", buffered2)
	}
}

func TestViewDedupe_DifferentIPNotDeduped(t *testing.T) {
	r, vc, _ := newViewHandlerServer(t, nil)
	id := uuid.NewString()

	postView(r, id, "203.0.113.1:1234")
	postView(r, id, "203.0.113.2:1234") // IP khác — không dedupe

	if got := vc.Buffered(); got != 2 {
		t.Fatalf("buffered = %d, want 2 (2 IP khác nhau, không bị dedupe)", got)
	}
}

func TestViewDedupe_ReaderIdentityTakesPriorityOverIP(t *testing.T) {
	r, vc, mr := newViewHandlerServer(t, func(context.Context) string { return "42" })
	id := uuid.NewString()

	// Hai request từ 2 IP khác nhau nhưng cùng reader id → dedupe theo reader, không theo IP.
	w1 := postView(r, id, "203.0.113.1:1234")
	if w1.Code != http.StatusAccepted {
		t.Fatalf("first view status = %d, want 202", w1.Code)
	}
	w2 := postView(r, id, "203.0.113.2:9999")
	if w2.Code != http.StatusAccepted {
		t.Fatalf("second view status = %d, want 202", w2.Code)
	}

	if got := vc.Buffered(); got != 1 {
		t.Fatalf("buffered = %d, want 1 (cùng reader id, khác IP vẫn phải dedupe)", got)
	}

	// Key dedupe trong Redis phải chứa identity "r:42", không phải hash IP.
	key := "views:seen:" + id + ":" + time.Now().UTC().Format("20060102")
	members, err := mr.SMembers(key)
	require.NoError(t, err)
	require.Contains(t, members, "r:42")
}
