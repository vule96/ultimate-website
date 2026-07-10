# @ultimate/web — Blog công khai (Next.js)

Blog công khai (App Router, React 18, Tailwind v3), đọc dữ liệu từ Go core, SSG + ISR.

## Chạy dev
1. Core chạy `:8080` (xem `services/core/README.md`).
2. `cp .env.example .env.local` (chỉnh nếu cần).
3. `pnpm --filter @ultimate/web dev` → http://localhost:3000

## Env
- `CORE_API_URL` (server-only) — base URL core, mặc định `http://localhost:8080`.
- `NEXT_PUBLIC_SITE_URL` — URL công khai (canonical/sitemap/rss/OG).
- `NEXT_PUBLIC_MEDIA_HOST` — host ảnh cho `next/image` remotePatterns.

## Trang
- `/` danh sách bài PUBLISHED (+`?page=`), `/blog/[slug]`, `/tags`, `/tags/[slug]`.
- SEO: metadata/OG mỗi bài, `/sitemap.xml`, `/rss.xml`, `/robots.txt`.

Dữ liệu chỉ hiển thị bài `PUBLISHED`; mọi slug non-PUBLISHED (DRAFT/khác) → 404 (`notFound()`).

## Build & test

```bash
pnpm --filter @ultimate/web test    # vitest — 19 tests
pnpm --filter @ultimate/web build   # next build (SSG cho /blog/[slug], /tags/[slug]; ISR revalidate=60)
pnpm --filter @ultimate/web start   # chạy bản build, mặc định :3000
```

Build-time fetch tới core degrade an toàn: nếu core chưa chạy, các trang liên quan build với danh sách rỗng (không throw), phù hợp môi trường CI chưa có core.

## Verify E2E còn PENDING (cần docker + core + seed dữ liệu)

Checklist đầy đủ ở `.superpowers/sdd/task-12-brief.md` (Step 1–3) và báo cáo `.superpowers/sdd/task-12-report.md`. Tóm tắt:

```bash
docker compose up -d
cd services/core && go run ./cmd/api   # :8080
# seed qua admin: ≥2 bài PUBLISHED (1 có cover_image + tag), ≥1 bài DRAFT
pnpm --filter @ultimate/web build && pnpm --filter @ultimate/web start
# rồi kiểm tra bằng trình duyệt: /, /blog/<published>, /blog/<draft> (→404), /tags, /tags/<slug>
curl -s localhost:3000/sitemap.xml
curl -s localhost:3000/rss.xml
curl -s localhost:3000/robots.txt
```

Spec đầy đủ: `docs/superpowers/specs/2026-07-10-slice4-web-public-blog-design.md`.
