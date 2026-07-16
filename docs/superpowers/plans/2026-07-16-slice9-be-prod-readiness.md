# Slice 9 — BE production-readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Core Go đạt chuẩn production: logging đầy đủ, Prometheus metrics + Grafana/Loki, Redis cache-aside key-versioning, env mở rộng + redact, blurhash worker pool + view counter batch (2 bài học goroutine), Docker multi-stage cho core/web/admin + compose prod/observability.

**Architecture:** Không đổi kiến trúc module (domain→service→repository→handler). Thêm `platform/metrics`, `platform/cache`; cache là decorator quanh `posts.Repository`; blurhash worker + view counter là component riêng nhận vào service/handler qua interface nhỏ; observability là compose profile tách rời.

**Tech Stack:** prometheus/client_golang, redis/go-redis/v9, buckket/go-blurhash, golang.org/x/image/webp, golang.org/x/sync/errgroup, distroless, Next standalone, nginx alpine, Prometheus/Grafana/Loki/Promtail.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-slice9-be-prod-readiness-design.md`.
- Cache lỗi → log warn + fallback DB, KHÔNG fail request. Redis ops timeout 100ms. `REDIS_URL` rỗng = cache off (no-op).
- Chỉ cache đường đọc anonymous (Authed=false); request authed bypass.
- View/blurhash: KHÔNG chạm DB/mạng trong request path — chỉ send channel non-blocking.
- Metrics label `route` dùng Gin `FullPath()` (template), không raw URL (cardinality).
- Test core: `cd services/core && go test ./...` (DB `blog_test` sẵn có). Không test nào cần Redis thật.
- Migration qua Atlas như slice trước: thêm cột vào model → `atlas migrate diff --env gorm`.
- Commit tiếng Việt + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Config mở rộng + LOG_LEVEL + redact secret

**Files:**
- Modify: `services/core/internal/platform/config/config.go`
- Modify: `services/core/internal/platform/logger/logger.go`
- Test: `services/core/internal/platform/config/config_test.go` (thêm case)
- Modify: `services/core/.env.example`

**Interfaces:**
- Produces: `Config` thêm field `LogLevel string; MetricsPort string; PprofEnabled bool; RedisURL string; ViewFlushInterval time.Duration; ViewBufferSize int; BlurhashWorkers int; BlurhashMaxBytes int64; BlurhashFetchTimeout time.Duration`; method `LogValue() slog.Value` (redact); `logger.New(production bool, level string) *slog.Logger`.

- [ ] **Step 1: Test fail** — thêm vào `config_test.go`:

```go
func TestLoadSlice9Defaults(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	cfg, err := config.Load()
	if err != nil { t.Fatal(err) }
	if cfg.MetricsPort != "9091" { t.Errorf("MetricsPort = %q", cfg.MetricsPort) }
	if cfg.ViewFlushInterval != 5*time.Second { t.Errorf("ViewFlushInterval = %v", cfg.ViewFlushInterval) }
	if cfg.ViewBufferSize != 1024 { t.Errorf("ViewBufferSize = %d", cfg.ViewBufferSize) }
	if cfg.BlurhashWorkers != 3 { t.Errorf("BlurhashWorkers = %d", cfg.BlurhashWorkers) }
	if cfg.BlurhashMaxBytes != 10<<20 { t.Errorf("BlurhashMaxBytes = %d", cfg.BlurhashMaxBytes) }
	if cfg.LogLevel != "info" { t.Errorf("LogLevel = %q", cfg.LogLevel) }
}

func TestConfigLogValueRedacts(t *testing.T) {
	cfg := config.Config{DatabaseURL: "postgres://user:secretpw@host/db", GoogleClientSecret: "supersecret", StorageSecretKey: "sk"}
	s := cfg.LogValue().String()
	for _, leak := range []string{"secretpw", "supersecret", `"sk"`} {
		if strings.Contains(s, leak) { t.Errorf("LogValue leaks %q: %s", leak, s) }
	}
}
```

- [ ] **Step 2:** Run `go test ./internal/platform/config/` → FAIL (field không tồn tại).

- [ ] **Step 3: Implement** — `config.go` thêm field + đọc env (dùng helper sẵn có; thêm `getIntEnv` tương tự `getInt64Env`):

```go
	// Observability & workers (Slice 9)
	LogLevel     string // debug | info | warn | error
	MetricsPort  string // cổng HTTP /metrics + pprof (mặc định 9091)
	PprofEnabled bool   // bật /debug/pprof trên metrics server
	RedisURL     string // rỗng = cache off

	ViewFlushInterval    time.Duration
	ViewBufferSize       int
	BlurhashWorkers      int
	BlurhashMaxBytes     int64
	BlurhashFetchTimeout time.Duration
```

Trong `Load()`: `LogLevel: strings.ToLower(getEnv("LOG_LEVEL", "info"))` (validate thuộc {debug,info,warn,error} — sai → error); `MetricsPort: getEnv("METRICS_PORT", "9091")`; `PprofEnabled` = getBoolEnv("PPROF_ENABLED", !isProd); `RedisURL: os.Getenv("REDIS_URL")`; các duration/int qua helper fail-fast: `VIEW_FLUSH_INTERVAL` 5s, `VIEW_BUFFER_SIZE` 1024, `BLURHASH_WORKERS` 3, `BLURHASH_MAX_BYTES` 10<<20, `BLURHASH_FETCH_TIMEOUT` 10s.

`LogValue()`:

```go
// LogValue in config lúc boot mà không leak secret (slog.LogValuer).
func (c Config) LogValue() slog.Value {
	return slog.GroupValue(
		slog.String("env", c.AppEnv), slog.String("port", c.Port),
		slog.String("db", redactURL(c.DatabaseURL)),
		slog.String("redis", redactURL(c.RedisURL)),
		slog.String("metrics_port", c.MetricsPort),
		slog.String("log_level", c.LogLevel),
		slog.String("storage_bucket", c.StorageBucket),
		slog.Bool("auth_configured", c.GoogleClientID != "" && c.AdminAllowlist != ""),
	)
}

// redactURL giữ scheme+host, che credential/path.
func redactURL(raw string) string {
	if raw == "" { return "" }
	u, err := url.Parse(raw)
	if err != nil { return "<invalid>" }
	u.User = nil
	return u.Scheme + "://" + u.Host
}
```

`logger.New(production bool, level string)`: map level string → `slog.Level` (default info), dùng cho cả 2 handler. Cập nhật call site main (`logger.New(cfg.IsProduction(), cfg.LogLevel)` — sửa luôn trong task này cho compile).

- [ ] **Step 4:** `go test ./...` PASS. `.env.example` thêm block Slice 9 (comment tiếng Việt từng biến).

- [ ] **Step 5:** Commit `feat(core): config Slice 9 (metrics/redis/worker env) + LOG_LEVEL + LogValue redact secret`.

---

### Task 2: reqlog enrich + panic recovery qua slog

**Files:**
- Modify: `services/core/internal/shared/reqlog/reqlog.go`
- Test: `services/core/internal/shared/reqlog/reqlog_test.go` (mới)
- Modify: `services/core/cmd/api/main.go` (recovery + version)

**Interfaces:**
- Produces: log completion thêm `ip, user_agent, route, bytes_out`; 5xx thêm `errors`. `main.go` có `var version = "dev"` (ldflags -X main.version).

- [ ] **Step 1: Test fail** — `reqlog_test.go`: dựng gin engine + middleware với slog handler ghi vào buffer JSON, gọi route `/x/:id`, assert log chứa `"route":"/x/:id"`, `"ip"`, `"user_agent":"test-agent"`, `"bytes_out"`. Case 2: handler set `c.Error(...)` + 500 → log chứa `"errors"`.

```go
func TestMiddlewareLogsRequestFields(t *testing.T) {
	gin.SetMode(gin.TestMode)
	var buf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&buf, nil))
	r := gin.New()
	r.Use(reqlog.Middleware(log))
	r.GET("/x/:id", func(c *gin.Context) { c.String(200, "hello") })
	req := httptest.NewRequest("GET", "/x/42", nil)
	req.Header.Set("User-Agent", "test-agent")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	out := buf.String()
	for _, want := range []string{`"route":"/x/:id"`, `"user_agent":"test-agent"`, `"bytes_out":5`, `"status":200`} {
		if !strings.Contains(out, want) { t.Errorf("log missing %s: %s", want, out) }
	}
}
```

- [ ] **Step 2:** FAIL. **Step 3:** sửa completion log trong middleware:

```go
		route := c.FullPath()
		if route == "" { route = "unmatched" }
		attrs := []any{
			"method", c.Request.Method, "path", c.Request.URL.Path, "route", route,
			"status", c.Writer.Status(), "latency_ms", time.Since(start).Milliseconds(),
			"ip", c.ClientIP(), "user_agent", c.Request.UserAgent(),
			"bytes_out", c.Writer.Size(),
		}
		if len(c.Errors) > 0 { attrs = append(attrs, "errors", c.Errors.String()) }
		if c.Writer.Status() >= 500 {
			l.Error("request", attrs...)
		} else {
			l.Info("request", attrs...)
		}
```

`main.go`: `var version = "dev"` + boot log `log.Info("core service starting", "version", version, "config", cfg)`; thay `gin.Recovery()` bằng:

```go
	r.Use(gin.CustomRecoveryWithWriter(io.Discard, func(c *gin.Context, err any) {
		reqlog.From(c.Request.Context()).Error("panic recovered", "panic", err, "stack", string(debug.Stack()))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": gin.H{"code": "INTERNAL", "message": "internal error"}})
	}))
```

- [ ] **Step 4:** PASS toàn bộ. **Step 5:** Commit `feat(core): reqlog đủ field production (ip/ua/route/bytes/errors) + panic recovery qua slog + version ldflags`.

---

### Task 3: Prometheus metrics + server riêng (:9091) + pprof gated

**Files:**
- Create: `services/core/internal/platform/metrics/metrics.go` (registry + HTTP middleware + collectors)
- Create: `services/core/internal/platform/metrics/server.go`
- Test: `services/core/internal/platform/metrics/metrics_test.go`
- Modify: `services/core/cmd/api/main.go`, `go.mod`

**Interfaces:**
- Produces: `metrics.New() *Metrics` với field/method: `GinMiddleware() gin.HandlerFunc`; counters/gauges public: `CacheHit(group string)`, `CacheMiss(group string)`, `ViewsBuffered(n float64)` (gauge set), `ViewsFlushed(n int)`, `ViewsDropped()`, `BlurhashJob(result string)`, `OutboxProcessed()`, `SetOutboxPending(n float64)`; `RegisterDBStats(db *sql.DB)`; `Handler() http.Handler` (promhttp trên registry riêng). `metrics.Serve(ctx, port string, m *Metrics, pprofEnabled bool, log *slog.Logger)` chạy server riêng, shutdown theo ctx.

- [ ] **Step 1:** `go get github.com/prometheus/client_golang@latest`.

- [ ] **Step 2: Test fail** — `metrics_test.go`:

```go
func TestGinMiddlewareCountsRequests(t *testing.T) {
	gin.SetMode(gin.TestMode)
	m := metrics.New()
	r := gin.New()
	r.Use(m.GinMiddleware())
	r.GET("/p/:id", func(c *gin.Context) { c.Status(200) })
	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest("GET", "/p/1", nil))

	rec := httptest.NewRecorder()
	m.Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/metrics", nil))
	body := rec.Body.String()
	if !strings.Contains(body, `http_requests_total{method="GET",route="/p/:id",status="200"} 1`) {
		t.Errorf("missing counter: %s", body)
	}
	if !strings.Contains(body, "http_request_duration_seconds_bucket") { t.Error("missing histogram") }
}

func TestCacheAndWorkerMetrics(t *testing.T) {
	m := metrics.New()
	m.CacheHit("posts_list"); m.CacheMiss("posts_list"); m.ViewsDropped(); m.BlurhashJob("ok")
	rec := httptest.NewRecorder()
	m.Handler().ServeHTTP(rec, httptest.NewRequest("GET", "/metrics", nil))
	body := rec.Body.String()
	for _, want := range []string{
		`cache_hits_total{key_group="posts_list"} 1`,
		`cache_misses_total{key_group="posts_list"} 1`,
		`views_dropped_total 1`,
		`blurhash_jobs_total{result="ok"} 1`,
	} {
		if !strings.Contains(body, want) { t.Errorf("missing %s", want) }
	}
}
```

- [ ] **Step 3:** FAIL. **Step 4: Implement** `metrics.go` — registry riêng (`prometheus.NewRegistry()` + `collectors.NewGoCollector()`, `NewProcessCollector`), promauto With(registry); middleware:

```go
func (m *Metrics) GinMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()
		c.Next()
		route := c.FullPath()
		if route == "" { route = "unmatched" }
		status := strconv.Itoa(c.Writer.Status())
		m.httpRequests.WithLabelValues(c.Request.Method, route, status).Inc()
		m.httpDuration.WithLabelValues(c.Request.Method, route).Observe(time.Since(start).Seconds())
	}
}
```

`RegisterDBStats`: `registry.MustRegister(collectors.NewDBStatsCollector(db, "core"))`. `server.go`:

```go
// Serve chạy metrics server riêng (không session middleware, không public ra internet).
func Serve(ctx context.Context, port string, m *Metrics, pprofEnabled bool, log *slog.Logger) {
	mux := http.NewServeMux()
	mux.Handle("/metrics", m.Handler())
	if pprofEnabled {
		mux.HandleFunc("/debug/pprof/", pprof.Index)
		mux.HandleFunc("/debug/pprof/profile", pprof.Profile)
		mux.HandleFunc("/debug/pprof/symbol", pprof.Symbol)
		mux.HandleFunc("/debug/pprof/trace", pprof.Trace)
	}
	srv := &http.Server{Addr: ":" + port, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() { <-ctx.Done(); shutdownCtx, cancel := context.WithTimeout(context.Background(), 3*time.Second); defer cancel(); _ = srv.Shutdown(shutdownCtx) }()
	log.Info("metrics server listening", "port", port, "pprof", pprofEnabled)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Error("metrics server error", "err", err)
	}
}
```

Wire main: `m := metrics.New(); m.RegisterDBStats(sqlDB); r.Use(m.GinMiddleware())` (sau reqlog); `go metrics.Serve(ctx, cfg.MetricsPort, m, cfg.PprofEnabled, log)`. Outbox dispatcher nhận `m` (thêm param hoặc setter — thêm field optional `Metrics *metrics.Metrics` qua `NewDispatcher(..., m)`), gọi `m.OutboxProcessed()` mỗi event ok + `m.SetOutboxPending(float64(len(events)))` mỗi vòng.

- [ ] **Step 5:** `go test ./...` PASS. **Step 6:** Commit `feat(core): Prometheus metrics (http/cache/worker/db/outbox) + metrics server :9091 + pprof gated`.

---

### Task 4: Cache package + CachedRepository posts (key-versioning)

**Files:**
- Create: `services/core/internal/platform/cache/cache.go` (interface + noop), `cache/redis.go`, `cache/keys.go`
- Create: `services/core/internal/modules/posts/repository_cached.go`
- Test: `services/core/internal/platform/cache/keys_test.go`, `services/core/internal/modules/posts/repository_cached_test.go`
- Modify: `services/core/cmd/api/main.go`, `go.mod`

**Interfaces:**
- Produces:

```go
// platform/cache
type Cache interface {
	Get(ctx context.Context, key string) ([]byte, bool)      // miss/lỗi → false
	Set(ctx context.Context, key string, val []byte, ttl time.Duration)
	Version(ctx context.Context, name string) int64          // GET <name>:ver, lỗi/thiếu → 0
	BumpVersion(ctx context.Context, name string)            // INCR <name>:ver
}
func NewNoop() Cache
func NewRedis(url string, log *slog.Logger) (Cache, error)  // timeout ops 100ms, lỗi ops → log warn + miss
// keys.go
func ListKey(ver int64, f posts.ListFilter) string  // KHÔNG — keys generic: func Key(group string, ver int64, parts ...string) string → "group:v{ver}:sha1(parts)"
// posts
func NewCachedRepository(inner Repository, c cache.Cache, m *metrics.Metrics) Repository
```

- [ ] **Step 1:** `go get github.com/redis/go-redis/v9`.

- [ ] **Step 2: Test fail** — `keys_test.go`: `cache.Key("posts_list", 3, "PUBLISHED", "", "q")` deterministic, đổi 1 part → key khác, đổi ver → key khác. `repository_cached_test.go` dùng fake `Cache` in-memory (map + version int) + fake `Repository` (đếm call):

```go
func TestCachedRepoListPublicHitMiss(t *testing.T) {
	fakeRepo := &spyRepo{}           // List trả 1 post, đếm calls
	fc := newFakeCache()
	r := posts.NewCachedRepository(fakeRepo, fc, metrics.New())
	f := posts.ListFilter{Authed: false, Limit: 10}
	_, _, _ = r.List(ctx, f)         // miss → gọi inner, Set
	_, _, _ = r.List(ctx, f)         // hit → KHÔNG gọi inner
	if fakeRepo.listCalls != 1 { t.Errorf("listCalls = %d, want 1", fakeRepo.listCalls) }
}

func TestCachedRepoAuthedBypass(t *testing.T) { /* Authed:true → 2 lần gọi inner = 2 */ }

func TestCachedRepoWriteBumpsVersion(t *testing.T) {
	// List (cache) → Create → List lại phải gọi inner lần nữa (version bump làm key cũ chết)
}
```

- [ ] **Step 3:** FAIL. **Step 4: Implement**:
- `cache.go`: noop trả miss mọi Get, Version 0, Set/Bump no-op.
- `redis.go`: `redis.ParseURL`; mỗi op bọc `context.WithTimeout(ctx, 100*time.Millisecond)`; lỗi → `log.Warn("cache: op failed", ...)` và trả miss/no-op. `Version`: `Get name+":ver"` parse int64. `BumpVersion`: `Incr`.
- `keys.go`: `Key(group, ver, parts...)` = `fmt.Sprintf("%s:v%d:%x", group, ver, sha1.Sum([]byte(strings.Join(parts, "\x1f"))))`.
- `repository_cached.go`: embed inner; override:
  - `List`: nếu `f.Authed` → inner thẳng. Ngược lại: ver = `c.Version(ctx,"posts")`; key từ toàn bộ field filter; Get hit → gob/json decode `struct{Posts []Post; Total int64}` (+ metric hit) ; miss → inner + Set TTL 60s (+ metric miss).
  - `GetBySlug`: cache TTL 5m — CHÚ Ý: dùng chung cho authed/anon? GetBySlug được service ép visibility sau đó? Kiểm tra service: nếu service quyết định 404 theo status sau khi đọc repo thì cache theo slug an toàn (cache bản thô, service filter). Cache luôn (bản thô), TTL 5m, group `posts_slug`.
  - `ListTags(publishedOnly=true)` cache TTL 5m group `tags` (publishedOnly=false → bypass); `Stats` bypass (chỉ admin gọi).
  - `Create/Update/Delete`: gọi inner, nếu OK → `c.BumpVersion(ctx, "posts")`.
  - Serialize bằng `encoding/json` (Post đã có json tag).
- main: `var cch cache.Cache = cache.NewNoop(); if cfg.RedisURL != "" { cch, err = cache.NewRedis(...); lỗi → log warn + giữ noop }`; `repo := posts.NewCachedRepository(posts.NewGormRepository(db), cch, m)`.

- [ ] **Step 5:** PASS. **Step 6:** Commit `feat(core): Redis cache-aside key-versioning cho posts/tags public read (fallback noop, metrics hit/miss)`.

---

### Task 5: Migration + model — cover_blurhash & views + sort whitelist

**Files:**
- Modify: `services/core/internal/modules/posts/model.go` (2 field), `handler.go` (dto), `repository.go` (sort whitelist + `IncrementViews`), `service.go` nếu cần
- Migration: `services/core/migrations/` qua Atlas

**Interfaces:**
- Produces: model `CoverBlurhash *string \`gorm:"type:text"\``, `Views int64 \`gorm:"not null;default:0"\``; dto `postResponse` thêm `cover_blurhash *string`, `views int64`; sort whitelist thêm `"views"`; repo thêm `IncrementViews(ctx context.Context, counts map[uuid.UUID]int64) error` (batch, 1 transaction, mỗi id: `UPDATE posts SET views = views + ? WHERE id = ?`).

- [ ] **Step 1:** Thêm field model + dto + whitelist (đọc `repository.go` tìm map sort whitelist hiện có, thêm `"views": "views"`). Test fail trước cho `IncrementViews` trong `repository_test.go` (pattern test DB sẵn có): tạo 2 post, `IncrementViews(map{a:3,b:1})`, đọc lại assert views.
- [ ] **Step 2:** Implement `IncrementViews` (transaction + loop Exec). 
- [ ] **Step 3:** Atlas: `./atlas.exe migrate diff add_blurhash_views --env gorm` → sinh migration; `migrate apply` vào dev + test DB. 
- [ ] **Step 4:** `go test ./...` PASS (test cũ + mới; dto mới không phá contract admin — field cộng thêm).
- [ ] **Step 5:** Commit `feat(core): cột cover_blurhash + views, sort whitelist views, IncrementViews batch`.

---

### Task 6: Blurhash worker pool + enqueue + backfill

**Files:**
- Create: `services/core/internal/platform/blurhash/worker.go`, `blurhash/encode.go`
- Create: `services/core/cmd/blurhash-backfill/main.go`
- Test: `services/core/internal/platform/blurhash/worker_test.go`
- Modify: `services/core/internal/modules/posts/service.go` (enqueue hook), `cmd/api/main.go`, `go.mod`

**Interfaces:**
- Produces:

```go
type Job struct { PostID uuid.UUID; URL string }
type Store interface { SetBlurhash(ctx context.Context, id uuid.UUID, hash string) error } // impl bởi posts repo (thêm method SetBlurhash vào Repository? KHÔNG — interface riêng, main wire adapter dùng db trực tiếp hoặc method mới trên GormRepository)
type Fetcher interface { Fetch(ctx context.Context, url string) ([]byte, error) } // impl HTTP limit+timeout
func NewWorker(store Store, fetcher Fetcher, m *metrics.Metrics, log *slog.Logger, workers, queue int) *Worker
func (w *Worker) Start(ctx context.Context)      // spawn N goroutine
func (w *Worker) Enqueue(j Job) bool             // non-blocking; false = queue full (log+metric)
func (w *Worker) Close(timeout time.Duration)    // đóng queue, chờ drain tối đa timeout
func Encode(data []byte) (string, error)         // decode jpeg/png/webp → resize ≤64px → blurhash 4x3
// posts.Service nhận optional hook: SetBlurhashEnqueuer(func(id uuid.UUID, url string))
// gọi sau Create/Update khi cover_image != nil && đổi giá trị.
```

- [ ] **Step 1:** `go get github.com/buckket/go-blurhash golang.org/x/image/webp golang.org/x/image/draw golang.org/x/sync/errgroup`.

- [ ] **Step 2: Test fail** — `worker_test.go`:

```go
// fake fetcher trả PNG 2x2 sinh bằng image/png trong test; fake store ghi map + chan done.
func TestWorkerProcessesJob(t *testing.T) {
	store := newFakeStore()   // SetBlurhash ghi map, signal chan
	w := blurhash.NewWorker(store, fakeFetcher{png2x2()}, metrics.New(), slog.Default(), 2, 4)
	ctx, cancel := context.WithCancel(context.Background()); defer cancel()
	w.Start(ctx)
	if !w.Enqueue(blurhash.Job{PostID: id1, URL: "http://x/a.png"}) { t.Fatal("enqueue failed") }
	select {
	case <-store.done: // ok
	case <-time.After(2 * time.Second): t.Fatal("timeout")
	}
	if store.get(id1) == "" { t.Error("blurhash empty") }
}

func TestEnqueueFullDropsNotBlocks(t *testing.T) {
	// worker chưa Start → queue 1: enqueue 1 = true, enqueue 2 = false (không block)
}

func TestEncodeRejectsNonImage(t *testing.T) { _, err := blurhash.Encode([]byte("not an image")); if err == nil { t.Fatal("want error") } }
```

- [ ] **Step 3:** FAIL. **Step 4: Implement**:
- `encode.go`: `image.Decode` (import _ jpeg/png + `x/image/webp` decode riêng theo sniff), downscale về max 64px cạnh dài bằng `x/image/draw.ApproxBiLinear` (blurhash không cần ảnh to — CPU rẻ), `blurhash.Encode(4, 3, img)`.
- `worker.go`: struct { jobs chan Job; wg sync.WaitGroup }; `Start`: N goroutine `for { select { case <-ctx.Done(): return; case j, ok := <-w.jobs: if !ok { return }; w.process(ctx, j) } }`; `process`: fetch (Fetcher impl HTTP: `http.Client{Timeout}`, check status 200, `io.LimitReader(resp.Body, maxBytes+1)` — vượt max → error), Encode, `store.SetBlurhash`, metric `BlurhashJob("ok"/"fetch_error"/"encode_error"/"store_error")`.
- `Enqueue`: `select { case w.jobs <- j: return true; default: metric+log; return false }`.
- `Close(timeout)`: `close(w.jobs)` + wait wg với timeout.
- posts: `GormRepository` thêm method `SetBlurhash` (UPDATE 1 cột, không đụng version/updated_at); Service thêm field `enqueueBlurhash func(uuid.UUID, string)` (nil-safe) + setter; gọi trong Create/Update sau khi lưu OK và cover mới non-empty + khác cũ.
- `cmd/blurhash-backfill/main.go`: load config/db, query posts thiếu blurhash, `errgroup.WithContext` + `g.SetLimit(4)`, mỗi post fetch+encode+update, log tiến độ, exit code ≠ 0 nếu có lỗi.
- main api: dựng worker, `w.Start(ctx)`, wire setter vào service, sau `<-ctx.Done()` gọi `w.Close(5 * time.Second)`.

- [ ] **Step 5:** PASS. **Step 6:** Commit `feat(core): blurhash worker pool (channel + N goroutine + graceful drain) + backfill errgroup`.

---

### Task 7: View counter batch + endpoint public

**Files:**
- Create: `services/core/internal/modules/posts/viewcounter.go`
- Test: `services/core/internal/modules/posts/viewcounter_test.go`
- Modify: `services/core/internal/modules/posts/handler.go` (route + handler), `cmd/api/main.go`

**Interfaces:**
- Produces:

```go
type ViewSink interface { IncrementViews(ctx context.Context, counts map[uuid.UUID]int64) error } // repo Task 5 thoả
func NewViewCounter(sink ViewSink, m *metrics.Metrics, log *slog.Logger, buffer int, interval time.Duration) *ViewCounter
func (v *ViewCounter) Add(id uuid.UUID) bool      // non-blocking
func (v *ViewCounter) Run(ctx context.Context)     // goroutine chính: gom + flush (ticker | ngưỡng 256) ; ctx done → flush cuối rồi return
func (v *ViewCounter) flushNow(ctx context.Context) // unexported, test qua Run với ctx cancel
// handler: POST /posts/:id/view (public, KHÔNG nằm sau RequireAuth/RequireJSON) → parse uuid (sai → 400), counter.Add, 202.
```

- [ ] **Step 1: Test fail** — `viewcounter_test.go` (fake sink ghi map + chan):

```go
func TestViewCounterBatchesAndFlushesOnShutdown(t *testing.T) {
	sink := newFakeSink()
	v := posts.NewViewCounter(sink, metrics.New(), slog.Default(), 16, time.Hour) // interval dài → chỉ flush khi shutdown
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan struct{})
	go func() { v.Run(ctx); close(done) }()
	v.Add(idA); v.Add(idA); v.Add(idB)
	cancel()
	<-done
	if sink.count(idA) != 2 || sink.count(idB) != 1 { t.Errorf("got %v", sink.all()) }
}

func TestViewCounterFlushesAtThreshold(t *testing.T) {
	// Add 256 id khác nhau → sink nhận flush mà không cần cancel (chờ chan signal, timeout 2s)
}

func TestAddFullDrops(t *testing.T) { /* buffer 1, không Run → Add 1 true, Add 2 false */ }
```

- [ ] **Step 2:** FAIL. **Step 3: Implement** — `Run`: `pending := map[uuid.UUID]int64{}`; select ctx.Done (flush rồi return) / ticker (flush nếu có) / `id := <-ch` (pending[id]++; nếu len ≥ 256 flush). Flush: copy map, reset, `sink.IncrementViews` với context timeout 5s (background khi shutdown), metric ViewsFlushed/ViewsBuffered. Handler + route `rg.POST("/posts/:id/view", h.view)` trong nhóm public. main: `vc := posts.NewViewCounter(repo, m, log, cfg.ViewBufferSize, cfg.ViewFlushInterval); go vc.Run(ctx)`; handler nhận `vc` (NewHandler thêm param hoặc setter — thêm param).

- [ ] **Step 4:** PASS toàn bộ + curl thử `POST /api/v1/posts/<uuid>/view` → 202, sau interval views +1.
- [ ] **Step 5:** Commit `feat(core): view counter batch — channel aggregate + ticker flush + flush-on-shutdown, POST /posts/:id/view public`.

---

### Task 8: Docker multi-stage core/web/admin + compose prod + observability

**Files:**
- Create: `services/core/Dockerfile`, `services/core/.dockerignore`
- Create: `apps/web/Dockerfile`, `apps/web/.dockerignore` (context = repo root)
- Create: `apps/admin/Dockerfile`, `apps/admin/nginx.conf`, `apps/admin/.dockerignore`
- Modify: `apps/web/next.config.mjs` (`output: "standalone"`)
- Create: `docker-compose.prod.yml`, `docker-compose.observability.yml`, `observability/prometheus.yml`, `observability/grafana/provisioning/datasources/ds.yml`, `observability/grafana/provisioning/dashboards/{dashboards.yml,core.json}`, `observability/promtail-config.yml`, `.env.prod.example`

**Interfaces:**
- Consumes: metrics :9091 (Task 3), env Slice 9 (Task 1).

- [ ] **Step 1: core Dockerfile**

```dockerfile
# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY . .
ARG GIT_SHA=dev
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -trimpath -ldflags "-s -w -X main.version=${GIT_SHA}" -o /out/api ./cmd/api

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/api /api
EXPOSE 8080 9091
ENTRYPOINT ["/api"]
```

(Kiểm tra version Go trong `go.mod` — dùng đúng minor.)

- [ ] **Step 2: web Dockerfile** — bật `output: "standalone"` trong `next.config.mjs` trước; context root (monorepo):

```dockerfile
# syntax=docker/dockerfile:1
FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json turbo.json ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/types/package.json packages/types/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ARG NEXT_PUBLIC_MEDIA_HOST
ENV NEXT_PUBLIC_MEDIA_HOST=$NEXT_PUBLIC_MEDIA_HOST
RUN pnpm --filter @ultimate/web build

FROM node:22-alpine AS runner
ENV NODE_ENV=production
RUN addgroup -S app && adduser -S app -G app
USER app
WORKDIR /app
COPY --from=build --chown=app:app /repo/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /repo/apps/web/public ./apps/web/public
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

- [ ] **Step 3: admin Dockerfile + nginx.conf** — build Vite (`ARG VITE_API_URL`), runtime nginx: `try_files $uri /index.html;`, `gzip on` các mime chính, `location /assets/ { add_header Cache-Control "public, max-age=31536000, immutable"; }`.

- [ ] **Step 4: compose prod** — services: postgres (pgvector image sẵn dùng ở dev + healthcheck pg_isready), redis (`redis:7-alpine`, `--appendonly yes`, healthcheck), core (build context `services/core`, env_file `.env.prod`, depends_on healthy, ports 8080; metrics 9091 KHÔNG publish ra host — chỉ network nội bộ), web (build root context dockerfile `apps/web/Dockerfile`), admin. `.env.prod.example` liệt kê biến (không giá trị thật).

- [ ] **Step 5: compose observability** — prometheus (scrape `core:9091` 15s), loki (`grafana/loki`, config mặc định filesystem), promtail (mount `/var/lib/docker/containers` + docker_sd hoặc scrape json-file logs), grafana (provision datasource Prometheus+Loki + dashboard `core.json`: panels — RPS theo route, p95 latency, error rate 5xx, DB pool in-use, cache hit ratio, outbox pending, views flushed, blurhash jobs). Chung network với compose prod (`external network` tên `ultimate_net` khai báo ở cả 2 file).

- [ ] **Step 6: Verify build** — `docker build services/core`, `docker build -f apps/web/Dockerfile .`, `docker build apps/admin` đều xanh; `docker compose -f docker-compose.prod.yml config` hợp lệ.

- [ ] **Step 7:** Commit `feat(infra): Docker multi-stage core(distroless)/web(standalone)/admin(nginx) + compose prod & observability (Prom/Grafana/Loki)`.

---

### Task 9: Docs + verify E2E tổng

**Files:**
- Modify: `services/core/README.md` (mục Observability + Redis + env checklist production), `README.md` gốc (cách chạy compose), `CLAUDE.md`, `docs/status-roadmap.html` + `docs/architecture.md` (sau verify)

- [ ] **Step 1:** `go test ./...` + toàn bộ FE test + build xanh.
- [ ] **Step 2: E2E live**: compose prod + observability up → Grafana (:3001) thấy http metrics khi curl API, log core trong Loki; tạo post ảnh qua admin → `cover_blurhash` có giá trị; `for i in $(seq 20); do curl -X POST .../view; done` → sau 5s `views=20`; `redis-cli keys 'posts:*'` thấy key, update post → `posts:ver` tăng; `docker stop redis` → API vẫn 200.
- [ ] **Step 3:** Cập nhật docs tiến độ + commit + merge theo quy trình.
