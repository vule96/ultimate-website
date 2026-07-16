# Slice 9 — BE production-readiness (logging, observability, Redis, goroutine, Docker)

**Ngày:** 2026-07-16
**Trạng thái:** Design (đã duyệt qua brainstorm)
**Tiền đề:** core đã có slog + reqlog request_id, graceful shutdown, outbox dispatcher, config fail-fast.

## Quyết định đã chốt (brainstorm 2026-07-16)

- Observability: **Prometheus + Grafana + Loki (+Promtail)** self-host qua docker-compose profile riêng. Chưa làm OTel tracing (để Phase 2 khi có AI worker).
- Goroutine feature: làm **cả hai** — blurhash worker pool + view counter batch.
- Redis: **cache-aside cho read công khai**, key-versioning invalidation. Session giữ Postgres.
- 2 slice: Slice 9 BE (spec này) → Slice 10 FE images (spec riêng).

## 1. Logging

- `reqlog` thêm field: `ip` (ClientIP), `user_agent`, `route` (FullPath template — không raw path, tránh cardinality), `bytes_out`; 5xx kèm `error` từ `c.Errors`.
- `LOG_LEVEL` env (debug|info|warn|error) qua `slog.LevelVar`. Dev = text, prod = JSON (giữ `logger.New`).
- Boot log: `service=core`, `version` (inject `-ldflags -X main.version`), `env`.
- Panic recovery: `gin.CustomRecoveryWithWriter` → log qua slog (`panic`, `stack`).
- Log ra stdout; production: Promtail scrape docker log → Loki → xem bằng Grafana.

## 2. Metrics (Prometheus)

- Package `internal/platform/metrics`: registry + middleware Gin:
  - `http_requests_total{method,route,status}` counter.
  - `http_request_duration_seconds{method,route}` histogram (buckets mặc định).
- Collectors: `sql.DBStats` (open/idle/in-use/wait), outbox (`outbox_pending` gauge poll-time, `outbox_processed_total`), cache (`cache_hits_total`/`cache_misses_total{key_group}`), view counter (`views_buffered`, `views_flushed_total`, `views_dropped_total`), blurhash (`blurhash_jobs_total{result}`).
- Endpoint `/metrics` chạy **HTTP server riêng** cổng `METRICS_PORT` (mặc định 9091), kèm `/debug/pprof` (chỉ bật ngoài production hoặc qua env `PPROF_ENABLED`). Không qua session middleware, không public.

## 3. Redis cache (github.com/redis/go-redis/v9)

- `internal/platform/cache`: interface `Cache` (`Get/Set/Del/IncrVersion/Version`) + impl Redis + impl no-op (khi `REDIS_URL` rỗng → cache off, dev không bắt buộc).
- Áp ở **service layer posts** (decorator quanh repository hoặc trong service — chọn decorator `CachedRepository` để repo interface giữ nguyên):
  - Chỉ cache đường đọc **anonymous/public**: list PUBLISHED (`TTL 60s`), `GetBySlug` published (`TTL 5m`), tags list (`TTL 5m`), stats (`TTL 60s`). Request authenticated bypass cache (thấy draft).
  - Key: `posts:v{ver}:list:{sha1(params)}`, `posts:v{ver}:slug:{slug}`, `tags:v{ver}:all`… `ver` = `GET posts:ver`.
  - **Invalidation key-versioning**: mọi write (create/update/delete post, ảnh hưởng tags) → `INCR posts:ver`. Key cũ hết ai đọc, TTL tự dọn. O(1), không SCAN/DEL prefix.
- Lỗi Redis (down/timeout) → log warn + fallback DB; TUYỆT ĐỐI không fail request vì cache. Timeout Redis ops 100ms.

## 4. Env & bảo mật config

- `config.Load` thêm: `LogLevel`, `MetricsPort`, `PprofEnabled`, `RedisURL`, `ViewFlushInterval` (mặc định 5s), `ViewBufferSize` (1024), `BlurhashWorkers` (3), `BlurhashMaxBytes` (10MiB), `BlurhashFetchTimeout` (10s). Giữ pattern getXxxEnv fail-fast.
- `Config.LogValue()` (slog.LogValuer) — boot log config **redact** secret (DatabaseURL, GoogleClientSecret, StorageSecretKey…): in host/bucket, che credential.
- `.env.example` cập nhật đầy đủ + comment. Docs checklist production trong `services/core/README.md`: secrets qua env_file/secret manager, không commit, least-privilege DB user, rotate key.

## 5. Goroutine A — Blurhash pipeline

- Migration: `posts.cover_blurhash TEXT NULL`.
- `internal/modules/posts/blurhash` (hoặc `internal/platform/blurhash`): 
  - `Worker`: `jobs chan Job{PostID, URL}` buffered 256; N worker (`BlurhashWorkers`) chạy `for job := range jobs`; mỗi job: HTTP GET (timeout, `io.LimitReader` max bytes, content-type check jpeg/png/webp — decode `image` + `x/image/webp`), resize nhỏ trước khi encode (blurhash không cần ảnh to), `blurhash.Encode(4,3)` (github.com/buckket/go-blurhash), `UPDATE posts SET cover_blurhash=?`.
  - Enqueue từ posts service sau create/update khi `cover_image` đổi và khác rỗng: **non-blocking send** (`select { case ch <- job: default: log+metric drop }`) — request không bao giờ chờ.
  - Shutdown: `Close()` đóng channel, worker drain, `Wait()` với timeout gắn vào graceful shutdown main.
- `cmd/blurhash-backfill`: quét bài `cover_image IS NOT NULL AND cover_blurhash IS NULL`, xử lý bằng `errgroup.WithContext` + `SetLimit(4)`. Chạy tay/cron.
- API: `Post` response thêm `cover_blurhash` (nullable).

## 6. Goroutine B — View counter batch

- Migration: `posts.views BIGINT NOT NULL DEFAULT 0`.
- `POST /api/v1/posts/:id/view` — public, không auth, không JSON body; handler validate UUID → `counter.Add(id)` → `202`. **Không chạm DB trong request path.**
- `ViewCounter`: `ch chan string` buffered `ViewBufferSize`; goroutine chính gom `map[string]int64`; flush khi: ticker `ViewFlushInterval` HOẶC map đạt ngưỡng (256 id). Flush = 1 transaction batch `UPDATE posts SET views = views + ? WHERE id = ?` (bỏ qua id không tồn tại). Channel đầy → drop + metric (đếm view không phải dữ liệu tiền bạc).
- Shutdown: đóng nguồn, flush lần cuối trước khi exit (gắn graceful shutdown).
- API list/detail trả `views`. `GET /posts?sort=views` whitelist thêm `views` (cho "Top xem nhiều" Slice 10). Chưa dedupe per-user — note Phase sau (Redis HyperLogLog/session dedupe).

## 7. Docker multi-stage

- `services/core/Dockerfile`: stage build `golang:1.24-alpine` (`CGO_ENABLED=0`, cache mod, `-ldflags "-s -w -X main.version=$GIT_SHA"`) → runtime `gcr.io/distroless/static-debian12:nonroot`. Copy binary + (nếu cần) tz/ca đã có sẵn trong distroless/static.
- `apps/web/Dockerfile`: `next.config.mjs` bật `output: "standalone"`; stage deps (corepack pnpm, `pnpm fetch` theo lockfile monorepo) → build (turbo scope `@ultimate/web`) → runner `node:22-alpine` non-root, copy `.next/standalone` + `.next/static` + `public`.
- `apps/admin/Dockerfile`: build Vite (`VITE_API_URL` build-arg) → `nginx:1.27-alpine`: SPA fallback `try_files /index.html`, gzip, cache-control immutable cho assets.
- `.dockerignore` mỗi context. `docker-compose.prod.yml`: postgres, redis (appendonly), core, web, admin + healthcheck + `env_file: .env.prod` (gitignored). `docker-compose.observability.yml`: prometheus (scrape core:9091), grafana (provisioning datasource Prometheus+Loki + dashboard JSON core), loki, promtail (scrape docker logs). Verify build cả 3 image.

## 8. Kiểm thử & verify

- TDD: cache key/version logic + no-op cache; view counter (flush trigger tay qua method, không sleep thật); blurhash worker với fetcher fake + ảnh PNG bytes nhỏ; config env mới; reqlog fields (recorder).
- Test DB `blog_test` pattern sẵn có; Redis test: dùng no-op + unit logic (không đòi Redis thật trong CI test).
- Verify E2E live: chạy compose prod local — Grafana thấy http metrics + log Loki; tạo post có ảnh → `cover_blurhash` xuất hiện; spam view → `views` tăng theo batch; redis-cli thấy key + bump version khi update; tắt Redis → API vẫn sống.

## Ngoài phạm vi

- OTel tracing, alerting rules (note backlog); dedupe views; CDN; deploy VPS thật (hướng Deploy production riêng).
