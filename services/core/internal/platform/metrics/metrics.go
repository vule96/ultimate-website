// Package metrics expose Prometheus metrics cho core: HTTP, DB pool, cache,
// outbox và các background worker (view counter, blurhash).
package metrics

import (
	"database/sql"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/collectors"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

// Metrics gói registry riêng (không dùng global default — test cách li được).
type Metrics struct {
	registry *prometheus.Registry

	httpRequests *prometheus.CounterVec
	httpDuration *prometheus.HistogramVec

	cacheHits   *prometheus.CounterVec
	cacheMisses *prometheus.CounterVec

	viewsBuffered prometheus.Gauge
	viewsFlushed  prometheus.Counter
	viewsDropped  prometheus.Counter

	blurhashJobs *prometheus.CounterVec

	outboxProcessed prometheus.Counter
	outboxPending   prometheus.Gauge
}

// New tạo Metrics với registry riêng + Go/process collectors.
func New() *Metrics {
	reg := prometheus.NewRegistry()
	reg.MustRegister(collectors.NewGoCollector())
	reg.MustRegister(collectors.NewProcessCollector(collectors.ProcessCollectorOpts{}))

	m := &Metrics{
		registry: reg,
		httpRequests: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "http_requests_total", Help: "Tổng số HTTP request theo method/route/status.",
		}, []string{"method", "route", "status"}),
		httpDuration: prometheus.NewHistogramVec(prometheus.HistogramOpts{
			Name: "http_request_duration_seconds", Help: "Độ trễ HTTP request.",
			Buckets: prometheus.DefBuckets,
		}, []string{"method", "route"}),
		cacheHits: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "cache_hits_total", Help: "Cache hit theo nhóm key.",
		}, []string{"key_group"}),
		cacheMisses: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "cache_misses_total", Help: "Cache miss theo nhóm key.",
		}, []string{"key_group"}),
		viewsBuffered: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "views_buffered", Help: "Số view đang gom trong bộ đệm chưa flush.",
		}),
		viewsFlushed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "views_flushed_total", Help: "Tổng số view đã flush xuống DB.",
		}),
		viewsDropped: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "views_dropped_total", Help: "Số view bị drop vì buffer đầy.",
		}),
		blurhashJobs: prometheus.NewCounterVec(prometheus.CounterOpts{
			Name: "blurhash_jobs_total", Help: "Job blurhash theo kết quả (ok/fetch_error/encode_error/store_error/dropped).",
		}, []string{"result"}),
		outboxProcessed: prometheus.NewCounter(prometheus.CounterOpts{
			Name: "outbox_processed_total", Help: "Số event outbox đã xử lý.",
		}),
		outboxPending: prometheus.NewGauge(prometheus.GaugeOpts{
			Name: "outbox_pending", Help: "Số event outbox chờ xử lý (đo mỗi vòng poll).",
		}),
	}
	reg.MustRegister(m.httpRequests, m.httpDuration, m.cacheHits, m.cacheMisses,
		m.viewsBuffered, m.viewsFlushed, m.viewsDropped, m.blurhashJobs,
		m.outboxProcessed, m.outboxPending)
	return m
}

// GinMiddleware đếm request + đo latency. Label route dùng FullPath (template)
// để tránh nổ cardinality theo giá trị param.
func (m *Metrics) GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		route := c.FullPath()
		if route == "" {
			route = "unmatched"
		}
		m.httpRequests.WithLabelValues(c.Request.Method, route, strconv.Itoa(c.Writer.Status())).Inc()
		m.httpDuration.WithLabelValues(c.Request.Method, route).Observe(time.Since(start).Seconds())
	}
}

// RegisterDBStats theo dõi pool database/sql (open/idle/in-use/wait...).
func (m *Metrics) RegisterDBStats(db *sql.DB) {
	m.registry.MustRegister(collectors.NewDBStatsCollector(db, "core"))
}

// Handler trả promhttp handler trên registry riêng.
func (m *Metrics) Handler() http.Handler {
	return promhttp.HandlerFor(m.registry, promhttp.HandlerOpts{})
}

// --- API cho cache/worker (an toàn gọi trên *Metrics nil? Không — luôn truyền non-nil) ---

func (m *Metrics) CacheHit(group string)   { m.cacheHits.WithLabelValues(group).Inc() }
func (m *Metrics) CacheMiss(group string)  { m.cacheMisses.WithLabelValues(group).Inc() }
func (m *Metrics) ViewsBuffered(n float64) { m.viewsBuffered.Set(n) }
func (m *Metrics) ViewsFlushed(n int)      { m.viewsFlushed.Add(float64(n)) }
func (m *Metrics) ViewsDropped()           { m.viewsDropped.Inc() }
func (m *Metrics) BlurhashJob(result string) {
	m.blurhashJobs.WithLabelValues(result).Inc()
}
func (m *Metrics) OutboxProcessed()           { m.outboxProcessed.Inc() }
func (m *Metrics) SetOutboxPending(n float64) { m.outboxPending.Set(n) }
