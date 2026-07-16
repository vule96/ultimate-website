# core — Blog backend (Go)

Modular monolith (Gin + GORM + Atlas). Slice 1: module `posts` (CRUD + tags).

## Yêu cầu

- Go 1.25+
- Docker (chạy Postgres dev)
- Atlas CLI (`atlas.exe` — tải bản Windows từ <https://release.ariga.io/atlas/atlas-windows-amd64-latest.exe>, đã gitignore)

## Chạy local

```bash
# 1. Postgres dev (từ thư mục gốc repo)
docker compose up -d

# 2. Áp migrations
cd services/core
./atlas.exe migrate apply --env gorm \
  --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"

# 3. Cấu hình + chạy server
cp .env.example .env
go run ./cmd/api          # lắng nghe :8080, GET /healthz
```

### Seed dữ liệu mẫu (trang chủ "sống")

Chèn ~12 bài PUBLISHED phủ nhiều category (idempotent, chạy lại an toàn):

```bash
docker compose exec -T postgres psql -U blog -d blog < services/core/seed/seed_articles.sql
```

## Migrations (Atlas, sinh từ GORM model)

Schema là các GORM model trong `internal/modules/*` (khai báo qua `Models()`),
`cmd/atlas-loader` in ra DDL cho Atlas.

```bash
# Sau khi đổi model → sinh migration mới
./atlas.exe migrate diff <ten_migration> --env gorm
# Áp lên DB
./atlas.exe migrate apply --env gorm --url "$DATABASE_URL"
```

## Test

```bash
# Unit test (không cần DB)
go test ./...

# Kèm integration test (repository/handler) → cần DB test `blog_test`
# (volume Postgres mới sẽ tự có nhờ docker/postgres-init; volume cũ tạo 1 lần:)
docker exec ultimate_postgres createdb -U blog blog_test   # chỉ cần với volume cũ
TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable" go test ./...
```

## Kiến trúc (Clean-lite / Hexagonal)

Mỗi module trong `internal/modules/<name>`:

- `domain.go` — entity thuần + lỗi domain (không phụ thuộc GORM/HTTP)
- `service.go` — business logic + interface `Repository`
- `repository.go` — cài đặt GORM (map domain ↔ model)
- `handler.go` — Gin handlers + DTO

## API

| Method | Path | Auth | Ghi chú |
|---|---|---|---|
| GET | `/healthz` | – | health |
| GET | `/auth/google/login` | – | 302 tới Google (OAuth BFF) |
| GET | `/auth/google/callback` | – | đổi code → session cookie |
| POST | `/auth/logout` | – | xoá session |
| GET | `/auth/me` | session | email admin đang đăng nhập |
| GET | `/api/v1/posts` | – | list (`page`,`page_size`,`status`,`tag`) |
| GET | `/api/v1/posts/:slug` | – | chi tiết theo slug |
| POST | `/api/v1/posts` | **✔** | tạo bài (yêu cầu đăng nhập) |
| PUT | `/api/v1/posts/:id` | **✔** | sửa bài (yêu cầu đăng nhập) |
| DELETE | `/api/v1/posts/:id` | **✔** | xoá bài (yêu cầu đăng nhập) |
| GET | `/api/v1/tags` | – | list tags |

**Auth (Slice 2):** Google OAuth theo BFF — session server-side (Postgres qua scs),
cookie httpOnly, allowlist email qua env. Xem `.env.example` (`GOOGLE_*`, `ADMIN_ALLOWLIST`,
`SESSION_COOKIE_*`) và spec `docs/superpowers/specs/2026-07-05-slice2-auth-oauth-design.md`
(kèm hướng dẫn tạo Google OAuth client).

## Object storage (ảnh) — MinIO (dev) / Cloudflare R2 (prod)

Upload ảnh theo **presigned PUT**: admin xin `POST /api/v1/media/presign` (cần đăng nhập) →
browser **PUT thẳng** lên storage (không qua core) → lưu `public_url` vào bài. Cấu hình qua
`STORAGE_*` (map vào `S3Config`) — **đổi môi trường chỉ đổi env, không sửa code**.

**Quy ước:** local dev = **MinIO**, production = **R2**.

- **Dev (MinIO):** `docker compose up -d` tự tạo bucket `blog-media` (public-read). `.env` mặc
  định đã trỏ MinIO — không cần chỉnh. Console MinIO: <http://localhost:9001> (minioadmin/minioadmin).
- **Đổi qua R2 để test tại local:** trong `.env`, comment khối MinIO + bỏ comment khối R2 (xem `.env.example`), rồi restart core.
- **STORAGE_PRESIGN_EXPIRES** (mặc định 15m): thời hạn presigned PUT URL.

### Thiết lập R2 (prod)

1. Cloudflare dashboard → **R2** → Enable (free tier: 10 GB + egress miễn phí).
2. **Create bucket** `blog-media`.
3. **Manage R2 API Tokens → Create Account API Token** (không phải User token — service dùng lâu dài),
   permission **Object Read & Write**, scope bucket `blog-media` → lấy **Access Key ID** + **Secret Access Key**.
4. Lấy **Account ID** → endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
5. Bucket → **Settings → Public access**: bật **r2.dev** (chỉ dev, rate-limited) hoặc gắn **Custom Domain**
   (prod — mới có CDN cache/WAF thật) → dùng làm `STORAGE_PUBLIC_URL`.
6. Bucket → **Settings → CORS Policy** (BẮT BUỘC — browser PUT trực tiếp):

   ```json
   [{ "AllowedOrigins": ["https://admin.tenban.com"], "AllowedMethods": ["PUT","GET"],
      "AllowedHeaders": ["*"], "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 3600 }]
   ```

7. Set `STORAGE_*` = R2 qua **env thật** của nền tảng deploy (KHÔNG commit secret).

> `apps/web` cần `NEXT_PUBLIC_MEDIA_HOST` = host của `STORAGE_PUBLIC_URL` (cho `next/image`). Xem `apps/web/README.md`.
> Giới hạn ảnh: PNG/JPEG/WebP/GIF, ≤ 5 MB (`media/domain.go`).

## Observability & production (Slice 9)

- **Logging**: slog — dev text / prod JSON; `LOG_LEVEL` env. reqlog kèm `request_id, route, ip, user_agent, bytes_out`; 5xx = level ERROR kèm `errors`; panic recovery ghi stack qua slog.
- **Metrics**: Prometheus trên server riêng `:METRICS_PORT` (mặc định 9091, KHÔNG public) — http (route template), DB pool, cache hit/miss, outbox, views, blurhash. `PPROF_ENABLED` bật `/debug/pprof`.
- **Redis cache** (`REDIS_URL`, rỗng = tắt): cache-aside cho read công khai (list/slug/tags), invalidation **key-versioning** (write bump `posts:ver` — O(1), không SCAN). Redis chết → log warn + fallback DB, request không fail. Lưu ý: flush view KHÔNG bump version (views stale tối đa TTL 60s — chủ ý).
- **Goroutine patterns** (để học):
  - `platform/blurhash`: worker pool — buffered channel + N goroutine, enqueue non-blocking từ service khi cover đổi; SSRF guard tầng dial + chặn decompression bomb; `cmd/blurhash-backfill` dùng errgroup `SetLimit(4)`.
  - `posts.ViewCounter`: batch aggregation — `POST /api/v1/posts/:id/view` chỉ đẩy channel (202, không chạm DB), goroutine gom map + flush theo ticker/ngưỡng/shutdown.
- **Docker**: `services/core/Dockerfile` (multi-stage → distroless static, ~95MB). Stack đầy đủ: `docker compose --env-file .env.prod -f docker-compose.prod.yml -f docker-compose.observability.yml up -d` — Grafana `:3001` (dashboard "Ultimate Core" provisioned sẵn, datasource Prometheus + Loki).

### Checklist secrets production

- `.env.prod` KHÔNG commit (đã gitignore) — copy từ `.env.prod.example`.
- Đổi `POSTGRES_PASSWORD`, `GRAFANA_ADMIN_PASSWORD`; DB user least-privilege khi tách managed DB.
- Secret chỉ nằm trong env (12-factor); boot log tự redact (`Config.LogValue`).
- Rotate `STORAGE_SECRET_KEY`/`GOOGLE_CLIENT_SECRET` định kỳ; `PPROF_ENABLED=false` ở production.
