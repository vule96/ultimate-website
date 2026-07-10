# ultimate-website

Blog cá nhân (FE + BE + AI) — **monorepo**. Modular monolith (Go) + blog công khai (Next.js) + admin dashboard (Vite SPA), dùng chung `packages/*`.

> **Kiến trúc & roadmap:** [`docs/personal-blog-ai-analysis.md`](docs/personal-blog-ai-analysis.md) · **Tiến độ & quy ước:** [`CLAUDE.md`](CLAUDE.md)

## Yêu cầu

- **Docker Desktop** — chạy Postgres + MinIO
- **Go 1.25+** — core backend
- **Node 20+ & pnpm 11** — frontend

## ▶️ Chạy toàn bộ (local dev)

Khởi động **theo thứ tự** — tầng sau cần tầng trước:

```
① Docker Desktop → ② docker compose (Postgres+MinIO) → ③ Core (Go :8080) → ④ Web/Admin
```

### 1. Docker: Postgres + MinIO

Mở **Docker Desktop** (chờ báo *running*), rồi từ gốc repo:

```bash
docker compose up -d
```

Postgres `:5432` · MinIO `:9000` (console `:9001`, minioadmin/minioadmin). Dữ liệu + migration **giữ nguyên** giữa các lần (Docker volume).

> Lần đầu — hoặc sau khi đổi schema — áp migration:
> ```bash
> cd services/core
> ./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"
> ```

### 2. Core — Go backend (`:8080`)

```bash
cd services/core
cp .env.example .env      # lần đầu
go run ./cmd/api
```

Kiểm tra: <http://localhost:8080/healthz> → `{"status":"ok"}`. Chi tiết: [`services/core/README.md`](services/core/README.md).

### 3. Frontend

Mở **2 terminal riêng** (mỗi cái một tiến trình chạy nền):

```bash
pnpm --filter @ultimate/web dev      # Blog công khai  → http://localhost:3000
pnpm --filter @ultimate/admin dev    # Admin dashboard → http://localhost:5173
```

Hoặc chạy cả hai một lệnh: `pnpm dev` (Turborepo). **Lưu ý:** Core (Go) + Docker vẫn phải bật tay — chúng không nằm trong Turborepo JS.

## Cổng & URL

| Thành phần | URL | Cần bật trước |
|---|---|---|
| Blog công khai | <http://localhost:3000> | Docker + core |
| Admin | <http://localhost:5173/login> | Docker + core |
| Core API | <http://localhost:8080/healthz> | Docker |
| MinIO console | <http://localhost:9001> | Docker |

## ⚠️ Lỗi hay gặp

- **Web 500 / trắng trang** → thường do **core chưa chạy** (web cần core lấy dữ liệu). Bật core trước.
- **`Cannot find module './xxx.js'`** (web dev) → cache `.next` hỏng, thường sau khi đổi/xoá route lúc dev đang chạy. Fix: `rm -rf apps/web/.next` rồi chạy lại `pnpm --filter @ultimate/web dev`.
- **Upload ảnh trong admin không hiện dialog** → dùng **trình duyệt thường** (không phải cửa sổ automation/DevTools điều khiển) + MinIO đang chạy.

## Cấu trúc

```
apps/web        Next.js — blog công khai (App Router, SSG/ISR, SEO)
apps/admin      Vite + React + TanStack — dashboard quản trị
packages/ui     shadcn + theme HiveQ (dùng chung web + admin)
packages/types  Zod schemas (dùng chung, single source of truth)
services/core   Go — modular monolith (posts, auth OAuth, media)
docs/           phân tích, spec, plan
```

**Storage ảnh:** S3-compatible, **dev = MinIO / prod = Cloudflare R2** (chỉ đổi env `STORAGE_*`). Xem [`services/core/README.md`](services/core/README.md) mục "Object storage".

## Test

```bash
pnpm --filter @ultimate/web test       # web (Vitest)
pnpm --filter @ultimate/admin test     # admin (Vitest)
cd services/core && go test ./...      # core (Go)
```
