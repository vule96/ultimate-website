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

## API (Slice 1)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/healthz` | health |
| GET | `/api/v1/posts` | list (`page`,`page_size`,`status`,`tag`) |
| GET | `/api/v1/posts/:slug` | chi tiết theo slug |
| POST | `/api/v1/posts` | tạo (chưa auth — Slice 2) |
| PUT | `/api/v1/posts/:id` | sửa (chưa auth — Slice 2) |
| DELETE | `/api/v1/posts/:id` | xoá |
| GET | `/api/v1/tags` | list tags |
