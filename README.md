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

> **Seed dữ liệu mẫu** (để trang chủ "sống" — ~12 bài phủ nhiều category, idempotent):
> ```bash
> docker compose exec -T postgres psql -U blog -d blog < services/core/seed/seed_articles.sql
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

## Production edge (Slice 16)

Reverse-proxy **Caddy** đứng trước stack → HTTPS auto-TLS trên `80/443`, app không publish port trần. Backup DB `pg_dump → R2` theo cron.

```bash
# Cần .env.prod điền: WEB_DOMAIN/API_DOMAIN/ADMIN_DOMAIN, ACME_EMAIL,
# TLS_MODE (internal=test | email@domain=ACME thật), CLOUDFLARE_API_TOKEN (DNS-01).
docker compose --env-file .env.prod \
  -f docker-compose.prod.yml -f docker-compose.edge.yml up -d
```

- **TLS**: mặc định `TLS_MODE=internal` (self-signed, test local). Prod sau Cloudflare proxy → bỏ comment `acme_dns cloudflare` trong `Caddyfile` + `TLS_MODE=email` + `CLOUDFLARE_API_TOKEN` (quyền Zone:DNS:Edit) → xin cert qua **DNS-01** (không cần inbound :80). Image Caddy có plugin cloudflare: `Dockerfile.caddy`.
- **Backup**: `./scripts/backup-db.sh` (pg_dump → gzip → R2 `BACKUP_BUCKET`, giữ `BACKUP_KEEP` bản). Cron VPS:
  ```
  0 3 * * * cd /srv/app && ./scripts/backup-db.sh >> /var/log/mach-backup.log 2>&1
  ```
- **Bước VPS (chưa làm — cần server + domain)**: firewall `ufw` chỉ mở `80/443/22`; điền `NEXT_PUBLIC_API_URL=https://api.domain` khi build image web (client beacon/reader/subscribe gọi thẳng core); `GOOGLE_REDIRECT_URL`/`READER_REDIRECT_URL` = `https://api.domain/...` + đăng ký Google Console.

Chi tiết: [`docs/superpowers/specs/2026-07-19-slice16-prod-edge-design.md`](docs/superpowers/specs/2026-07-19-slice16-prod-edge-design.md).
