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

# Kèm integration test (repository/handler) → cần DB test
docker exec ultimate_postgres createdb -U blog blog_test   # lần đầu
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
