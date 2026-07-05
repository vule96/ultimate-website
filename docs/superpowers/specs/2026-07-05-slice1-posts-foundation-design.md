# Slice 1 — Nền móng + Module `posts` (Go core)

> Spec triển khai · Ngày 2026-07-05 · Dự án `ultimate-website`
> Ngữ cảnh tổng thể: xem `docs/personal-blog-ai-analysis.md` (§13, §14).
> Đây là **slice đầu tiên** của Phase 1 (Blog cơ bản). Phase 0 (VPS/CI) làm sau.

## 1. Mục tiêu & phạm vi

Dựng nền móng backend và một module `posts` CRUD chạy được end-to-end trên Postgres local.

**Trong phạm vi Slice 1:**
- Monorepo skeleton (chỉ phần cần cho Go core).
- Go core chạy được với **Gin**.
- Module `posts`: CRUD hoàn chỉnh (list có filter/phân trang, get theo slug, create, update, delete).
- 3 bảng: `posts`, `tags`, `post_tags` (tags chuẩn hoá M-N).
- Migrations bằng **Atlas** (versioned SQL), bật extension `pgvector` sẵn.
- `docker-compose.yml` chạy Postgres 16 + pgvector cho dev.
- Test theo TDD (service unit test + repository integration test + handler HTTP test).

**Ngoài phạm vi (slice/phase sau):**
- Auth / Google OAuth (Slice 2) → endpoint ghi tạm thời **mở**, đánh dấu `TODO(slice-2)`.
- Upload R2/MinIO + editor Tiptap + `apps/admin` SPA (Slice 3).
- `apps/web` Next.js public (Slice 4).
- CI/CD, VPS, monitoring (Phase 0 / Phase 2).

## 2. Quyết định kỹ thuật đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| HTTP router | **Gin** |
| DB access | **GORM** |
| Migration | **Atlas** (sinh diff từ GORM model → SQL versioned) |
| Database | **PostgreSQL 16** (image `pgvector/pgvector:pg16`) |
| Layering | **Hướng A — Clean-lite / Hexagonal** (áp thực dụng) |
| Logger | `log/slog` (structured, chuẩn thư viện) |
| Config | `godotenv` (dev) + `os.Getenv` |
| Test | `stretchr/testify` (assert + mock) |

## 3. Cấu trúc repo (Slice 1)

```
ultimate-website/
├── docker-compose.yml          # DEV: Postgres 16 + pgvector (Phase 0 mở rộng sau)
├── services/
│   └── core/
│       ├── cmd/api/main.go     # entrypoint, wiring thủ công
│       ├── internal/
│       │   ├── modules/posts/
│       │   │   ├── domain.go       # entity thuần + error domain (KHÔNG tag GORM)
│       │   │   ├── service.go      # business logic + interface Repository
│       │   │   ├── service_test.go # unit test (mock repo)
│       │   │   ├── repository.go   # impl GORM (map model↔domain)
│       │   │   ├── repository_test.go # integration test (Postgres docker)
│       │   │   ├── handler.go      # Gin handlers + DTO
│       │   │   └── handler_test.go # httptest
│       │   ├── platform/
│       │   │   ├── config/config.go   # đọc env
│       │   │   ├── database/db.go      # kết nối GORM
│       │   │   └── logger/logger.go    # slog
│       │   └── shared/
│       │       ├── httperr/            # map lỗi domain → HTTP + response chuẩn
│       │       └── pagination/         # helper phân trang
│       ├── migrations/         # Atlas migration files (SQL)
│       ├── atlas.hcl
│       ├── go.mod
│       ├── .env.example
│       └── .gitignore
└── docs/…
```

> `apps/`, `packages/`, pnpm/Turborepo **chưa tạo** ở Slice 1 (chỉ tạo khi có app JS từ Slice 3).

## 4. Kiến trúc module (Hướng A — Clean-lite)

Nguyên tắc **Dependency Rule**: phụ thuộc hướng vào trong; tầng lõi (`domain` + `service`) không biết GORM/HTTP.

- `domain.go`: `Post`, `Tag` là struct Go thuần (không GORM tag); `PostStatus string` + hằng số; error domain (`ErrPostNotFound`, `ErrSlugTaken`, `ErrInvalidStatus`, ...).
- `service.go`: định nghĩa `type Repository interface { ... }`; `Service` chứa logic (validate, sinh slug từ title, upsert tags, chuyển status → set `published_at`). Phụ thuộc `Repository` (interface).
- `repository.go`: `gormPost`/`gormTag`/`gormPostTag` (có GORM tag) + hàm `toDomain`/`toModel`; struct `GormRepository` implement `Repository`.
- `handler.go`: DTO request/response (Gin binding + validate), gọi `Service`, map lỗi domain → HTTP qua `shared/httperr`.
- Wiring thủ công trong `main.go` (chưa dùng wire/DI ở Slice 1).
- **Chỉ** đặt interface ở ranh giới repository — không over-abstract.

## 5. Data model + migrations

### Bảng
```
posts
  id            uuid  PK  DEFAULT gen_random_uuid()
  title         text  NOT NULL
  slug          text  NOT NULL UNIQUE
  content_json  jsonb NOT NULL DEFAULT '{}'      -- Tiptap JSON (source of truth)
  content_html  text  NOT NULL DEFAULT ''         -- render sẵn cho public/SEO
  excerpt       text  NULL                        -- TL;DR (AI điền sau)
  cover_image   text  NULL                        -- URL R2
  status        text  NOT NULL DEFAULT 'DRAFT'    -- CHECK IN (DRAFT,PENDING_APPROVAL,PUBLISHED)
  meta_title    text  NULL
  meta_desc     text  NULL
  published_at  timestamptz NULL
  created_at    timestamptz NOT NULL DEFAULT now()
  updated_at    timestamptz NOT NULL DEFAULT now()

tags
  id    uuid PK DEFAULT gen_random_uuid()
  name  text NOT NULL UNIQUE
  slug  text NOT NULL UNIQUE

post_tags
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE
  tag_id  uuid NOT NULL REFERENCES tags(id)  ON DELETE CASCADE
  PRIMARY KEY (post_id, tag_id)
```

### Quy ước
- `status`: dùng `text + CHECK` (dễ thêm giá trị, dễ migrate) thay vì Postgres enum type.
- Extension: migration đầu chạy `CREATE EXTENSION IF NOT EXISTS vector;` (pgvector dùng ở Phase 3).
- Index: `slug` UNIQUE (đã có), thêm index `status` và `published_at` để list/filter nhanh.
- **Atlas workflow:** khai báo GORM model → `atlas migrate diff` sinh SQL versioned trong `migrations/` → `atlas migrate apply` chạy lên DB. Có history + rollback.
  - Atlas cài bằng `go install ariga.io/atlas/cmd/atlas@latest` (community).
  - `atlas.hcl`: dùng data source `external_schema` từ GORM (gorm.io/gorm loader) hoặc khai báo schema HCL. Slice 1 dùng cách đơn giản: GORM autoload provider của Atlas.

### Xử lý tags
Khi create/update post, client gửi danh sách **tên tag** (`["go","backend"]`). Service:
1. Với mỗi tên → slugify → upsert vào `tags` (theo `slug`, lấy id).
2. Ghi lại quan hệ trong `post_tags` (xoá quan hệ cũ, thêm mới khi update).

## 6. API surface (REST, prefix `/api/v1`)

| Method | Path | Việc | Ghi chú |
|---|---|---|---|
| GET | `/healthz` | health check | trả `{status:"ok"}` |
| GET | `/api/v1/posts` | list, phân trang + filter `status`, `tag` | query: `page`,`page_size`,`status`,`tag` |
| GET | `/api/v1/posts/:slug` | lấy 1 bài theo slug | 404 nếu không có |
| POST | `/api/v1/posts` | tạo bài (kèm tags) | slug sinh từ title nếu trống; 409 nếu slug trùng |
| PUT | `/api/v1/posts/:id` | sửa bài | 404 nếu không có |
| DELETE | `/api/v1/posts/:id` | xoá bài | 204 |
| GET | `/api/v1/tags` | list tags | phục vụ filter/gợi ý |

### Quy ước response
- Thành công list: `{ "data": [...], "page": 1, "page_size": 20, "total": 123 }`.
- Lỗi: `{ "error": { "code": "POST_NOT_FOUND", "message": "..." } }`.
- Map lỗi domain → HTTP: not found → 404; slug trùng → 409; validate → 400; còn lại → 500.
- ⚠️ **Chưa có auth** (Slice 2): POST/PUT/DELETE tạm mở, đánh dấu `// TODO(slice-2): require auth`.

## 7. Config & dev

- `platform/config`: đọc env, có `DATABASE_URL`, `PORT` (default `8080`), `APP_ENV` (default `development`).
- `.env.example` commit; `.env` gitignore.
- `docker-compose.yml`: service `postgres` (image `pgvector/pgvector:pg16`), user/pass/db từ env, volume persist, port `5432:5432`, healthcheck `pg_isready`.
- Logger `slog`: JSON handler ở prod, text ở dev.

## 8. Testing (TDD)

Thứ tự mỗi tầng: **test đỏ → code xanh → refactor.**

- **Service (unit):** mock `Repository`, test: validate input, sinh slug, slug trùng → lỗi, chuyển status PUBLISHED → set `published_at`, upsert tags.
- **Repository (integration):** chạy trên Postgres docker, DB test riêng; mỗi test bọc **transaction rollback** để cô lập. Test: create/get/list/update/delete, filter theo status/tag, cascade xoá post_tags.
- **Handler (HTTP):** `httptest`, test mã trạng thái + JSON cho mỗi endpoint (bao gồm 404/409/400).
- Chạy: `go test ./...`. Integration test skip nếu không có `DATABASE_URL` (build tag hoặc env guard) để `go test` cơ bản không cần DB.

## 9. Tiêu chí hoàn thành (Definition of Done)

1. `docker compose up -d` → Postgres chạy, healthcheck xanh.
2. `atlas migrate apply` → 3 bảng + extension tạo thành công.
3. `go run ./cmd/api` → server lên ở `:8080`, `GET /healthz` trả `ok`.
4. CRUD posts hoạt động thật (kiểm chứng bằng `curl`/HTTP): tạo bài có tags → list → get theo slug → update → delete.
5. `go test ./...` xanh (unit + handler luôn chạy; integration chạy khi có DB).
6. Toàn bộ commit trên branch `slice-1-posts-foundation`.

## 10. Ranh giới slice sau

- **Slice 2:** module `auth` (Google OAuth BFF, sessions, allowlist email) + middleware bọc endpoint ghi.
- **Slice 3:** module `media` (presigned R2/MinIO) + `apps/admin` (Vite SPA + Tiptap); sinh `content_html` khi lưu bài.
- **Slice 4:** `apps/web` (Next.js) đọc `content_html`/`content_json` render public + SEO.
