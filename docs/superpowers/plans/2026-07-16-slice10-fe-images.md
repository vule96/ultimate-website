# Slice 10 — FE image optimization + blurhash Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Blog detail hết CLS (khung aspect cố định + blurhash placeholder), ảnh tối ưu (AVIF/WebP, sizes/priority/quality), "Top xem nhiều" + views hiển thị dùng dữ liệu thật từ Slice 9, client bắn view beacon.

**Architecture:** `BlurhashCanvas` (client, decode npm `blurhash` lên canvas 32px) + `CoverImage` (aspect wrapper + next/image fill + fade-in) dùng ở blog detail; `ArticleRow` thumbnail nhận blurhash; RSC home fetch thêm `sort=views` cho TopViewed; `ViewTracker` client component sendBeacon.

**Tech Stack:** blurhash (npm, decode ~1KB), next/image, Zod.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-16-slice10-fe-images-design.md`.
- CLS = 0 bằng reserve chỗ (aspect-ratio) — blurhash chỉ là polish, không phải cách fix CLS.
- View beacon: fire-and-forget, nuốt lỗi im lặng, không block navigation.
- Test: `pnpm --filter @ultimate/web test`; build cả admin (schema chung đổi).

---

### Task 1: Types — `cover_blurhash` + `views` trong PostSchema
- `packages/types/src/index.ts`: PostSchema thêm `cover_blurhash: z.string().nullable()`, `views: z.number().int()`.
- Cập nhật fixtures test web/admin (thêm 2 field) — chạy test cả 2 app + build.
- Commit `feat(types): Post thêm cover_blurhash + views (Slice 9 API)`.

### Task 2: BlurhashCanvas (TDD)
- `pnpm --filter @ultimate/web add blurhash`.
- `features/posts/components/blurhash-canvas.tsx`: client, props `{hash, className}`; decode 32×32 → canvas (useRef + useEffect), `aria-hidden`. Test: render canvas khi có hash; decode gọi đúng (mock module `blurhash`).
- Commit.

### Task 3: CoverImage + áp blog detail + ArticleRow
- `features/posts/components/cover-image.tsx`: client — wrapper `relative overflow-hidden` + `aspect-[16/9]` (prop `aspectClass` override), BlurhashCanvas absolute (khi có hash), next/image `fill` + `sizes` + `priority?` + `quality=75`, `onLoad` fade-in (`opacity-0 → opacity-100 transition`), fallback nền `bg-soft`. Test: reserve wrapper + img render.
- Blog detail (`app/[locale]/blog/[slug]/page.tsx`): thay `<Image>` cover hiện tại bằng `<CoverImage priority hash={post.cover_blurhash} .../>` — hết CLS.
- `ArticleRow`: thumbnail thêm BlurhashCanvas dưới Image (khung 132×90 sẵn có), `sizes="132px"`, `priority` khi `index < 2`.
- Commit.

### Task 4: next.config images + views thật + beacon
- `next.config.mjs` images: `formats: ["image/avif", "image/webp"]` (remotePatterns đã có).
- `ArticleVM`: thêm `blurhash: string | null`; adapter map `cover_blurhash`, `views` (đã có field). Row meta hiện `formatViews(views)` khi > 0.
- Home RSC: fetch thêm `listTopViewed()` (`GET /posts?sort=views&order=desc&page_size=5`) cho `topViewed` thay `slice(0,5)`.
- `features/posts/components/view-tracker.tsx`: client, useEffect once → `navigator.sendBeacon(POST /posts/:id/view)` fallback `fetch(..., {keepalive:true})`, silent catch. Gắn vào blog detail.
- Commit.

### Task 5: Verify
- Test web + admin + build; E2E live: detail không shift (khung giữ chỗ), blur hiện trước ảnh, view tăng sau flush, top viewed đổi; Lighthouse/DevTools check CLS ≈ 0.
- Docs: CLAUDE.md + roadmap/architecture (gộp Slice 9+10) → merge.
