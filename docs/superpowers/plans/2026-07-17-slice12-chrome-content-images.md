# Slice 12 — Chrome toàn site + content images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Masthead/SubNav mọi trang + ảnh trong content_html có width/height + blurhash placeholder (CLS 0).

**Architecture & chi tiết:** theo spec `docs/superpowers/specs/2026-07-17-slice12-sitewide-chrome-content-images-design.md` (spec đã ở mức chi tiết signatures/files — plan này là checklist thực thi).

## Global Constraints

- TDD từng phần; test Go: `cd services/core && go test ./...` (TEST_DATABASE_URL blog_test); web: `pnpm --filter @ultimate/web test`.
- SSRF guard + dimension check tái dùng — KHÔNG mở đường fetch mới.
- Meta là dữ liệu backend sinh → plugin web chạy sau sanitize; style user input vẫn bị strip.
- Commit tiếng Việt + Co-Authored-By Claude Fable 5.

## Tasks

### T1 — Go: `ExtractImgSrcs` + `EncodeMeta` (TDD)
- [ ] Test fail: dedupe giữ thứ tự, cap 20, bỏ `data:`/relative/`javascript:`; EncodeMeta trả W/H đúng ảnh PNG test + `Blurhash` non-empty + `PlaceholderPNG` prefix `data:image/png;base64,`.
- [ ] Implement `internal/platform/blurhash/content.go` (`x/net/html`) + mở rộng `encode.go` (`EncodeMeta` dùng chung guard dimension; placeholder: `bh.Decode(hash, 32, round(32*H/W))` → png encode → base64).
- [ ] Commit.

### T2 — Go: migration + repo + worker content job + enqueue + backfill + API
- [ ] Model/gorm: `ContentImageMeta datatypes.JSON` (domain: `map[string]ImageMeta`; `ImageMeta{W,H int; Ph string}` json `w,h,ph`); Atlas diff `add_content_image_meta` + apply dev/test.
- [ ] Repo: `SetContentImageMeta(ctx, id, meta map[string]ImageMeta)` UpdateColumn (DB test theo pattern `SetBlurhash`).
- [ ] Worker: `EnqueueContent(postID, html)` — non-blocking; xử lý: ExtractImgSrcs → fetch từng src (bỏ qua lỗi) → EncodeMeta → map → SetContentImageMeta → **bump cache version** (Observer/callback từ main: truyền `onDone func()` hoặc worker giữ `cache.Cache`? → giữ callback `AfterStore func(ctx)` set từ main gọi `cch.BumpVersion(ctx,"posts")`).
- [ ] Service: enqueue sau Create (content có img) + Update (content_html đổi). Handler/API: `content_image_meta` trong postResponse (map hoặc null).
- [ ] Backfill: pass 2 — bài `content_html LIKE '%<img%' AND content_image_meta IS NULL`.
- [ ] `go test ./...` + commit.

### T3 — Web: types + plugin + PostContent
- [ ] `@ultimate/types`: `ImageMetaSchema {w,h,ph}` + `content_image_meta: z.record(ImageMetaSchema).nullable()`; fixtures web/admin thêm `content_image_meta: null`.
- [ ] TDD `features/posts/enrich-images.ts` — plugin rehype `rehypeEnrichImages(meta)`: img luôn lazy/async; khớp meta → width/height + style background data-uri. Test: có meta/không meta/style user bị sanitize strip trước đó.
- [ ] `sanitize.ts`: `sanitizeHtml(html, meta?)` — pipeline parse → sanitize → enrich(meta) → stringify. `PostContent({html, imageMeta})`; detail page truyền `post.content_image_meta`.
- [ ] Test web + build + commit.

### T4 — Chrome toàn site
- [ ] Layout: `<Masthead/><SubNav/>` trước `{children}`; `MagazineBoard` bỏ 2 component.
- [ ] SearchBar: `usePathname` — pathname !== "/" → sau setQuery gọi `router.push("/")` (giữ debounce tự nhiên: push 1 lần khi bắt đầu gõ — check pathname trong onChange, chỉ push khi khác "/").
- [ ] Sửa `magazine-board.test.tsx` (search test render `<><Masthead/><MagazineBoard/></>` hoặc chuyển assert); test + build + commit.

### T5 — Verify E2E + docs + merge
- [ ] Backfill content meta cho bài dev có ảnh; restart core dev; detail HTML có `width/height/style`; CLS check DevTools; masthead trên detail/tags/404 + search-from-detail; dark + `/en`.
- [ ] CLAUDE.md + roadmap + architecture; merge + push.
