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
