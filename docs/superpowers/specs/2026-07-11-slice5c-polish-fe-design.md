# Slice 5c — Polish FE (SEO + Security headers + Font + Admin TS)

> Ngày: 2026-07-11 · Trạng thái: Design approved, chờ implementation plan.
> Nguồn findings: `docs/reviews/2026-07-11-senior-code-review.md`. Slice này (nhóm A — polish FE thuần, KHÔNG đụng DB) resolve: **W3, W4, W5, W6, W7** + low SEO (OG fallback, RSS, sizes, next.config gate) + font `next/font` + admin **A5, A6, A7, A8, A9** + admin low (tagKeys ownership, PostId brand, apiClient 204/rename, a11y toast/aria-sort, clamp page, Topbar link).
> Nhóm B (core M1–M5 + outbox) tách sang **Slice 5d** riêng (cần migration + concurrency).
> Quyết định chốt khi brainstorm: (1) sanitize = **rehype-sanitize** (RSC server-side); (2) CSP = **không nonce** (giữ SSG+ISR của 5b) qua `next.config` `headers()`.

## Mục tiêu

Đánh bóng FE cho chất lượng production: SEO đầy đủ, security headers, font tối ưu, và siết type-safety + sửa các lỗi nhỏ ở admin. Rủi ro thấp, verify nhanh bằng build + test.

**Ngoài phạm vi:** nhóm B (M1–M5 core, outbox → Slice 5d); Lexical toolbar active state; media orphan cleanup (backend); AppShell title prefix; `_authed.index` void-catch.

## Thiết kế

### 1. Web — SEO completeness

**W3 — sitemap/rss để lỗi throw** (`apps/web/src/app/sitemap.ts`, `apps/web/src/app/rss.xml/route.ts`):
- Bỏ `.catch(() => [])` quanh `listAllPublished()`. Khi core sập lúc revalidate, ISR giữ bản tốt cuối (chỉ rỗng ở first build — chấp nhận). Khác `generateStaticParams` (giữ catch→[] để build không vỡ).

**W4 — metadata tag pages** (`apps/web/src/app/tags/[slug]/page.tsx`, `.../page/[n]/page.tsx`, `apps/web/src/app/tags/page.tsx`):
- `/tags/[slug]`: `generateMetadata({ params })` → `title: `#${slug}``, description `Bài viết về #${slug}`, `alternates.canonical = ${SITE_URL}/tags/${slug}`.
- `/tags/[slug]/page/[n]`: `generateMetadata({ params })` → title `#${slug} · Trang ${n}`, canonical trỏ path trang đó.
- `/tags`: static `metadata` export (title "Chủ đề", description).

**W5 — JSON-LD BlogPosting** (`apps/web/src/app/blog/[slug]/page.tsx`):
- Render `<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />` với `ld = { "@context":"https://schema.org", "@type":"BlogPosting", headline, datePublished: published_at, dateModified: updated_at, image: cover_image?, mainEntityOfPage: canonical, author: { "@type":"Person", name: SITE_NAME } }`. Data đã có sẵn tại `page.tsx` (post đã fetch).

**W6 — not-found + error pages** (`apps/web/src/app/not-found.tsx`, `apps/web/src/app/error.tsx`):
- `not-found.tsx` (server component): layout tái dùng `SiteHeader`/`SiteFooter`, message "Không tìm thấy trang" + link về `/`.
- `error.tsx` (client component, `"use client"`): nhận `{ error, reset }`, hiển thị "Đã xảy ra lỗi" + nút thử lại (`reset()`) + link `/`.

**Low SEO:**
- `metadata.ts`: khi `cover_image` null → `openGraph.images` = `[{ url: ${SITE_URL}/og-default.png }]` (thêm file `apps/web/public/og-default.png` — placeholder 1200×630) và `twitter.card = "summary"` (thay vì `summary_large_image`); khi có ảnh giữ `summary_large_image`.
- `rss.ts`: thêm `xmlns:atom` vào `<rss>`, `<atom:link rel="self" href="${siteUrl}/rss.xml" ... />`, `<language>vi</language>`, `<lastBuildDate>` (từ post mới nhất hoặc bỏ nếu rỗng); `escapeXml` áp cho cả `link`/`guid` URL. Truyền `siteUrl` sẵn có.
- `blog/[slug]/page.tsx`: `next/image` cover thêm `sizes="(max-width: 42rem) 100vw, 42rem"`.
- `next.config.mjs`: pattern `http localhost` chỉ thêm khi `process.env.NODE_ENV !== "production"`; nếu production mà thiếu `NEXT_PUBLIC_MEDIA_HOST` → `throw new Error(...)` (fail-fast build).

### 2. Web — Sanitize + CSP (W7)

**Sanitize** (`apps/web/src/features/posts/components/post-content.tsx`):
- Dùng `rehype` pipeline server-side: `unified().use(rehypeParse, { fragment: true }).use(rehypeSanitize, schema).use(rehypeStringify)` → sanitize `html` trước khi `dangerouslySetInnerHTML`. Component thành `async` (RSC).
- `schema`: clone `defaultSchema` của `rehype-sanitize`, mở rộng cho output editor:
  - `tagNames` thêm: `img`, `figure`, `figcaption`, `mark`, `input` (task-list checkbox), `table/thead/tbody/tr/th/td`, `hr`, `pre`, `code`, `h1..h4`, `blockquote`, `ul/ol/li`, `a`, `p`, `strong`, `em`, `s`, `br`.
  - `attributes`: `a` → `href`,`title`,`rel`; `img` → `src`,`alt`,`title`,`width`,`height`; `input` → `type`(chỉ `checkbox`),`checked`,`disabled`; `td/th` → `colspan`,`rowspan`; `*` → `className` (giữ class prose của editor).
  - `protocols.href/src`: `http`,`https`,`mailto` (chặn `javascript:`).
- Deps thêm (web): `rehype-parse`, `rehype-sanitize`, `rehype-stringify`, `unified`.

**CSP** (`apps/web/next.config.mjs` `async headers()`):
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://<MEDIA_HOST>;
  font-src 'self' data:;
  object-src 'none';
  base-uri 'self';
  frame-ancestors 'none';
```
- Áp cho mọi route (`source: "/:path*"`). `<MEDIA_HOST>` từ `NEXT_PUBLIC_MEDIA_HOST` (dev fallback `localhost:*` khi không production). Kèm `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`. **Không nonce** → route giữ static (SSG+ISR nguyên vẹn).

### 3. Web — `next/font` migration

`apps/web/src/app/layout.tsx` + `globals.css` + `tailwind.config.ts`:
- Thay `@fontsource/*` imports (trong `globals.css`) bằng `next/font/google`: `Lora` (serif, subsets `latin`,`vietnamese`, weights 400/500/600/700) + `Inter` (sans). Expose qua CSS variable trên `<body>` (`--font-serif`, `--font-sans`).
- Tailwind `fontFamily.serif`/`.sans` trỏ CSS var. Bỏ các weight lẻ (650/680/660/640/620) trong CSS → dùng cut tĩnh thật (browser đang làm tròn hết về 700).
- Gỡ dependency `@fontsource/*` khỏi `apps/web/package.json`.

### 4. Admin — TS tightening + correctness/a11y

- **A5** (`features/posts/queries.ts`): `useCreatePost`/`useUpdatePost` `onSuccess` invalidate thêm `tagKeys.all`.
- **A6** (`components/ui/data-table.tsx` → tách `table-meta.ts`): `TableMeta<TData>.onDelete?: (row: TData) => void` (optional); chuyển `declare module "@tanstack/react-table"` sang file `apps/admin/src/lib/table-meta.ts`, import ở nơi cần.
- **A7** (`PostsToolbar.tsx`, `PostsListPage.tsx`, `routes/_authed.posts.index.tsx`): props toolbar `status: PostStatus | ""`, `onStatusChange: (v: PostStatus | "") => void`; xoá 3 `as` cast; route `validateSearch` dùng `PostStatusSchema.or(z.literal(""))` thay enum inline.
- **A8** (`lib/apiClient.ts`, `features/posts/queries.ts`): `apiFetch(path, schema, init?, signal?)` — hoặc đọc `init.signal`; queryFn (`listPosts`, `getPostBySlug`) nhận `{ signal }` từ TanStack Query và forward vào `fetch`.
- **A9** (`features/auth/hooks.ts`): `useSignOut` — `await navigate({ to: "/login" })` trước, rồi `qc.clear()`.
- **Low (gộp):**
  - `tagKeys` chuyển từ `features/posts/keys.ts` sang `features/tags/keys.ts`, dùng trong `tagsQueryOptions`; xoá bản dead ở posts.
  - `features/posts/api.ts`: `updatePost(id: PostId, ...)` (call site đã pass `Post["id"]`).
  - `lib/apiClient.ts`: 204 khi có schema → throw `ApiSchemaError` (thay vì `undefined as T`); rename interface `ApiError`→`ApiErrorBody` trong `packages/types/src/index.ts` (class `ApiError` ở apiClient giữ nguyên).
  - `packages/ui/src/components/toast.tsx`: error toast `role="alert"` (thay `status`).
  - `components/ui/data-table.tsx`: sortable `<th>` thêm `aria-sort` (`ascending`/`descending`/`none`).
  - `PostsListPage.tsx`: sau khi xoá item cuối trang cuối → clamp `page` về `totalPages` mới (nếu `page > pages`).
  - `app/Topbar.tsx`: nút "Thêm bài viết" bọc `<Link to="/posts/new">` (`asChild`).

## Test plan (TDD)

**Web (Vitest):**
| Test | Khẳng định |
|---|---|
| `rss.ts` | output chứa `xmlns:atom`, `atom:link rel="self"`, `<language>vi`, escape `&` trong link |
| `metadata.ts` no-cover | `openGraph.images` = og-default; `twitter.card` = `"summary"` |
| `metadata.ts` with-cover | `twitter.card` = `"summary_large_image"` |
| tag `generateMetadata` | title `#slug`, canonical đúng |
| sanitize (PostContent helper) | `<script>alert(1)</script>` bị loại; `<img src=x onerror=...>` mất `onerror`; `<a href="javascript:...">` mất href; giữ `<table>`,`<mark>`,`<input type=checkbox>` |

**Admin (Vitest):**
| Test | Khẳng định |
|---|---|
| A7 | toolbar nhận `PostStatus \| ""` không cast; buildPostsQuery vẫn đúng |
| A8 | queryFn forward `signal` vào fetch (spy `fetch` nhận `signal`) |
| apiClient 204+schema | throw `ApiSchemaError` |

**Verify build + E2E:**
1. `next build` — routes vẫn static (`○`/`●`, KHÔNG `ƒ`) → CSP không-nonce giữ SSG.
2. `next start` → response `/` có header `Content-Security-Policy` + `X-Content-Type-Options: nosniff`.
3. Bài có `<script>` nhúng trong content_html → render ra KHÔNG chạy script (bị sanitize).
4. `/khong-ton-tai` → not-found branded (có header/footer).
5. Admin: build (typecheck) + toàn bộ test xanh; tạo post với tag mới → filter tag cập nhật ngay (A5).

## Definition of Done

- Test web + admin xanh; `next build` (static) + build admin (typecheck) + build @ultimate/ui + core xanh.
- Verify build/E2E 5 mục trên pass.
- `security-review` (CSP đủ chặt, sanitize allowlist không hở `javascript:`/`on*`).
- Đánh dấu `✅ RESOLVED` W3–W7 + low SEO + A5–A9 + admin low trong review doc.
- Cập nhật `CLAUDE.md` (Slice 5c DONE; còn lại chỉ nhóm B → Slice 5d).
