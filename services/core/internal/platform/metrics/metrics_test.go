package metrics_test

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"

	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

func init() { gin.SetMode(gin.TestMode) }

func scrape(t *testing.T, m *metrics.Metrics) string {
	t.Helper()
	rec := httptest.NewRecorder()
	m.Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/metrics", nil))
	return rec.Body.String()
}

func TestGinMiddlewareCountsRequests(t *testing.T) {
	m := metrics.New()
	r := gin.New()
	r.Use(m.GinMiddleware())
	r.GET("/p/:id", func(c *gin.Context) { c.Status(200) })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/p/1", nil))

	body := scrape(t, m)
	if !strings.Contains(body, `http_requests_total{method="GET",route="/p/:id",status="200"} 1`) {
		t.Errorf("thiếu counter http_requests_total: %s", body)
	}
	if !strings.Contains(body, "http_request_duration_seconds_bucket") {
		t.Error("thiếu histogram http_request_duration_seconds")
	}
}

func TestCacheAndWorkerMetrics(t *testing.T) {
	m := metrics.New()
	m.CacheHit("posts_list")
	m.CacheMiss("posts_list")
	m.ViewsDropped()
	m.ViewsFlushed(3)
	m.BlurhashJob("ok")
	m.OutboxProcessed()
	m.SetOutboxPending(7)

	body := scrape(t, m)
	for _, want := range []string{
		`cache_hits_total{key_group="posts_list"} 1`,
		`cache_misses_total{key_group="posts_list"} 1`,
		`views_dropped_total 1`,
		`views_flushed_total 3`,
		`blurhash_jobs_total{result="ok"} 1`,
		`outbox_processed_total 1`,
		`outbox_pending 7`,
	} {
		if !strings.Contains(body, want) {
			t.Errorf("thiếu %s", want)
		}
	}
}
