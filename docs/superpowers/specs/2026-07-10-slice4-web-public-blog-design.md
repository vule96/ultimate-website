# Slice 4 — `apps/web` (Next.js) blog công khai + `packages/ui` dùng chung

> Spec triển khai · Ngày 2026-07-10 · Dự án `ultimate-website`
> Nhánh mới: `slice-4-web-public-blog` (tách từ `main` sau khi đã merge 3c+3d+3e).

## 1. Mục tiêu & phạm vi

Dựng **blog công khai** `apps/web` bằng **Next.js (App Router)** phục vụ đọc bài (SEO/SSG),
đọc dữ liệu thật từ Go core. Đồng thời **tách `packages/ui`** (shadcn + theme HiveQ) dùng chung
cho cả `web` và `admin`, và **migrate `admin`** sang dùng package chung này.

Làm gọn trong **một slice 4 duy nhất** (không tách 4a/4b).

**Trong phạm vi:**
- `packages/ui` (`@ultimate/ui`): shadcn primitives chung + `cn` + theme (Tailwind preset + CSS biến màu).
- Migrate `admin` sang `@ultimate/ui` (giữ nguyên hành vi + giao diện).
- `apps/web`: Trang chủ (danh sách bài PUBLISHED + phân trang), `/blog/[slug]`, `/tags`, `/tags/[slug]`.
- Data fetch phía server (RSC) + **ISR** (`revalidate`), `generateStaticParams` cho bài đã publish.
- SEO: `generateMetadata` + OpenGraph mỗi bài, `sitemap.xml`, `/rss.xml`, `robots.txt`.
- TDD cho các hàm thuần; verify E2E cả web (mới) lẫn admin (regression).

**Ngoài phạm vi (slice/phase sau):**
- Chatbot RAG, comment/like, search phía web, i18n.
- `packages/api-client` (YAGNI — web dùng server-fetch riêng, admin dùng cookie client riêng; cả 2
  chỉ chia sẻ schema Zod trong `@ultimate/types`).
- Sanitize `content_html` (tác giả = chủ blog, tin cậy — ghi chú, để dành nếu mở comment/UGC).
- Deploy thật lên Vercel/Cloudflare Pages (chuẩn bị config nhưng không deploy trong slice).
- Migrate `DataTable` và component dính editor (Tiptap/Lexical) sang `packages/ui` — **giữ ở admin**.

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn | Lý do |
|---|---|---|
| Framework web | **Next.js App Router** | SSR/SSG/ISR cho SEO blog |
| React | **React 18** (đồng bộ admin) | Tránh xung đột 18/19 khi share `@ultimate/ui` |
| Tailwind | **v3** (đồng bộ admin) | Chia sẻ preset + theme dễ, khớp admin hiện có |
| Render | **SSG + ISR** (`revalidate=60`) | Nhanh, SEO tốt; bài mới xuất hiện qua revalidate |
| Data fetching | **RSC server `fetch`** + Zod (`@ultimate/types`) | Không lộ token, validate runtime |
| Lọc bài công khai | **Luôn ép `status=PUBLISHED`** | Không lộ DRAFT/PENDING |
| Chi tiết non-PUBLISHED | `notFound()` (404) | Chống đoán slug bài nháp |
| UI chung | `packages/ui` = `@ultimate/ui` | DRY monorepo; migrate admin luôn |
| api-client | **Không tạo** | YAGNI; chỉ chia sẻ `@ultimate/types` |
| Prose styling | `@tailwindcss/typography` | Render `content_html` đẹp |
| Test | **Vitest** (khớp admin) | Đồng bộ toolchain |

## 3. `packages/ui` (`@ultimate/ui`)

### 3.1. Cấu trúc

```
packages/ui/
├── package.json          # name @ultimate/ui, type module, exports maps
├── tailwind.preset.ts    # theme HiveQ (colors, radius, fonts) — preset chung
├── postcss.config.js     # (nếu cần cho build độc lập; chủ yếu app tự lo)
├── tsconfig.json
└── src/
    ├── index.ts          # barrel: export * components + cn
    ├── lib/cn.ts         # chuyển từ admin/src/lib/cn.ts
    ├── styles/theme.css  # CSS variables :root/.dark (tách từ admin/src/styles/index.css)
    └── components/
        ├── button.tsx  card.tsx  badge.tsx  input.tsx  label.tsx
        ├── select.tsx  textarea.tsx  avatar.tsx  alert-dialog.tsx
        ├── dropdown-menu.tsx  toast.tsx
        └── index.ts
```

### 3.2. package.json (khung)

```jsonc
{
  "name": "@ultimate/ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./styles/theme.css": "./src/styles/theme.css",
    "./tailwind.preset": "./tailwind.preset.ts"
  },
  "peerDependencies": { "react": "^18", "react-dom": "^18" },
  "dependencies": {
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.469.0",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-select": "^2.3.2",
    "@radix-ui/react-avatar": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.1.18",
    "@radix-ui/react-dropdown-menu": "^2.1.19"
  }
}
```

### 3.3. An toàn đa runtime (Vite + Next RSC)

- Component dùng hook/Radix/`useState` → thêm directive **`"use client"`** ở đầu file.
- Next: `next.config.ts` khai báo `transpilePackages: ['@ultimate/ui']`.
- Primitive thuần (Button/Card/Badge/Label) không state → có thể dùng trong RSC.
- `cn.ts` không có directive (dùng được cả 2 phía).

### 3.4. Chia sẻ theme

- `tailwind.preset.ts` chứa `theme.extend` (màu HiveQ qua `hsl(var(--...))`, radius, font) —
  tách từ `admin/tailwind.config.ts`.
- `src/styles/theme.css` chứa `:root { --background: ... }` + `.dark { ... }` — tách từ
  `admin/src/styles/index.css`.
- **Admin** `tailwind.config.ts`: `presets: [uiPreset]`, `content` thêm
  `"../../packages/ui/src/**/*.{ts,tsx}"`; `index.css` import `@ultimate/ui/styles/theme.css`.
- **Web** làm tương tự.

### 3.5. Migrate admin (giữ hành vi + giao diện)

- Chuyển các file `admin/src/components/ui/{button,card,badge,input,label,select,textarea,avatar,alert-dialog,dropdown-menu,toast}.tsx`
  và `admin/src/lib/cn.ts` sang `packages/ui`.
- Đổi mọi import trong admin: `@/components/ui/<x>` → `@ultimate/ui`; `@/lib/cn` → `@ultimate/ui`.
- **Giữ lại ở admin**: `data-table.tsx` (+ test) và mọi thứ dính editor/feature riêng.
- `admin/package.json` thêm `"@ultimate/ui": "workspace:*"`.
- **Chốt xanh**: `pnpm --filter @ultimate/admin test` xanh + `vite build` OK + smoke trình duyệt
  (login → dashboard → posts table → form) không đổi giao diện.

## 4. `apps/web` (Next.js App Router)

### 4.1. Cấu trúc (feature-based)

```
apps/web/
├── package.json          # next, react@18, @ultimate/ui, @ultimate/types
├── next.config.ts        # transpilePackages, images.remotePatterns
├── tailwind.config.ts    # presets: [uiPreset]; content gồm src + packages/ui; typography plugin
├── postcss.config.js
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── app/
    │   ├── layout.tsx            # SiteHeader/Footer, font, metadata gốc (title template)
    │   ├── globals.css           # @tailwind + import @ultimate/ui/styles/theme.css
    │   ├── page.tsx              # Trang chủ: list PUBLISHED + phân trang (ISR)
    │   ├── blog/[slug]/page.tsx  # chi tiết + generateMetadata + generateStaticParams
    │   ├── tags/page.tsx         # index tag (GET /tags)
    │   ├── tags/[slug]/page.tsx  # bài theo tag
    │   ├── sitemap.ts
    │   ├── robots.ts
    │   └── rss.xml/route.ts      # RSS 2.0
    ├── features/posts/
    │   ├── api.ts        # listPublished / getPublishedBySlug / listTags (server fetch + Zod)
    │   ├── rss.ts        # buildRssXml(posts, siteUrl) — hàm thuần
    │   ├── metadata.ts   # buildPostMetadata(post, siteUrl) — hàm thuần
    │   └── components/
    │       ├── post-card.tsx  post-list.tsx  pagination.tsx
    │       ├── post-content.tsx  tag-badge.tsx
    ├── components/       # site-header.tsx  site-footer.tsx
    └── lib/config.ts     # CORE_API_URL, SITE_URL, REVALIDATE, PAGE_SIZE
```

### 4.2. Data layer (`features/posts/api.ts`)

- Base URL server-only: `CORE_API_URL` (vd `http://localhost:8080`), **không** prefix `NEXT_PUBLIC_`.
- Dùng `fetch(url, { next: { revalidate: REVALIDATE } })`; parse bằng schema `@ultimate/types`
  (`PostListResponseSchema`, `PostSchema`, `TagListResponseSchema`).
- Hàm:
  - `listPublished({ page, tag? })` → **luôn** set `status=PUBLISHED`; trả `{ data, page, pageSize, total }`.
  - `getPublishedBySlug(slug)` → gọi `/posts/:slug`; nếu `status !== 'PUBLISHED'` → trả `null`
    (page gọi `notFound()`).
  - `listTags()` → `/tags`.
  - `listAllPublishedSlugs()` → gom slug cho `generateStaticParams` + `sitemap` (phân trang tới hết).
- Lỗi fetch (core down / 5xx) → ném lỗi để Next hiện error boundary; 404 từ core → `null`.

### 4.3. Rendering & routes

| Route | Render | Ghi chú |
|---|---|---|
| `/` | ISR | list PUBLISHED trang 1..N (query `?page=`) |
| `/blog/[slug]` | SSG + ISR | `generateStaticParams` = slug PUBLISHED; `notFound` nếu không PUBLISHED |
| `/tags` | ISR | toàn bộ tag |
| `/tags/[slug]` | ISR | `listPublished({ tag })` |

- `REVALIDATE=60`. `PAGE_SIZE` mặc định (vd 10) — khớp `pagination.Normalize` của core.
- `content_html` render qua `dangerouslySetInnerHTML` trong `<article className="prose ...">`
  (`PostContent`). Ghi chú: tin cậy tác giả, chưa sanitize.
- Ảnh: `next/image` với `images.remotePatterns` cho host R2/MinIO (đọc từ env).

### 4.4. SEO

- **`generateMetadata(post)`** (`metadata.ts`, thuần, test được):
  - `title = meta_title || title`
  - `description = meta_desc || excerpt || ''`
  - `alternates.canonical = SITE_URL + /blog/slug`
  - `openGraph`: `type:'article'`, `title`, `description`, `images:[cover_image]` (nếu có),
    `publishedTime = published_at`.
  - `twitter`: `card:'summary_large_image'`.
- **`layout.tsx`**: `metadata` gốc — `title.template = '%s · Ultimate website'`, `title.default = 'Ultimate website'`,
  `metadataBase = SITE_URL`.
- **`sitemap.ts`**: `/` + mọi bài PUBLISHED (`lastModified = updated_at`) + `/tags` + mỗi `/tags/[slug]`.
- **`robots.ts`**: `rules: { userAgent:'*', allow:'/' }`, `sitemap: SITE_URL + /sitemap.xml`.
- **`/rss.xml`** (`route.ts` gọi `buildRssXml`): RSS 2.0 — channel + item (title, link, guid,
  pubDate, description=excerpt) cho bài PUBLISHED; `Content-Type: application/xml`.

### 4.5. Env (`.env.example` cho web)

```
CORE_API_URL=http://localhost:8080
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_MEDIA_HOST=localhost   # host cho next/image remotePatterns (MinIO dev)
```

## 5. Chiến lược test (TDD)

**Viết test trước** cho các seam thuần (Vitest, môi trường node/jsdom):

1. `api.ts`:
   - `listPublished` luôn gắn `status=PUBLISHED` vào query (mock `fetch`, assert URL).
   - `getPublishedBySlug` trả `null` khi post `status='DRAFT'`; trả post khi `PUBLISHED`.
   - Parse Zod: response hợp lệ → object đúng; response sai schema → ném lỗi.
2. `metadata.ts`: `buildPostMetadata` fallback đúng (`meta_title||title`, `meta_desc||excerpt`),
   OG có `cover_image`/publishedTime khi có, canonical đúng.
3. `rss.ts`: `buildRssXml` sinh XML hợp lệ (có `<rss>`, đủ item, escape ký tự đặc biệt trong title).
4. Phân trang: hàm tính tổng số trang / disabled prev-next đúng biên.

**Không unit-test** layout/RSC page nặng — verify bằng E2E.

## 6. Verify E2E (Definition of Done)

1. `docker compose up -d` (Postgres) + core (`go run ./cmd/api`) + seed vài bài PUBLISHED + ≥1 DRAFT.
2. `apps/web`: `pnpm --filter @ultimate/web build && start` (kiểm ISR/SSG thật).
3. Trình duyệt (Playwright/Chrome DevTools MCP):
   - `/` hiện danh sách bài PUBLISHED, phân trang chuyển trang đúng.
   - `/blog/<slug-published>` render nội dung + `<head>` có OG/canonical.
   - `/blog/<slug-draft>` → **404**.
   - `/tags` liệt kê tag; `/tags/<slug>` lọc đúng bài.
   - `GET /sitemap.xml`, `/rss.xml`, `/robots.txt` trả nội dung hợp lệ.
4. **Admin regression**: `pnpm --filter @ultimate/admin test` xanh + build OK + smoke UI không đổi.
5. `pnpm build` (turbo) toàn monorepo xanh.
6. Core test giữ nguyên xanh (không đổi backend trong slice này).

## 7. Ảnh hưởng & rủi ro

- **Migrate admin** là phần rủi ro nhất (đụng app đang chạy) → di chuyển từng component, giữ nguyên
  API/props, dựa test admin + smoke để bắt regression.
- Tương thích Tailwind preset giữa Vite và Next (cùng v3) → giữ 1 nguồn preset, tránh lệch token.
- `"use client"` sai chỗ gây lỗi RSC → primitive thuần để server, tương tác gắn client.
- Không đổi backend → không có migration DB.

## 8. Cập nhật tài liệu

- Đánh dấu Slice 4 DONE trong `CLAUDE.md`; bổ sung mục `apps/web` (env, cách chạy) + `packages/ui`.
- `apps/web/README.md` quickstart. `.env.example` cho web.
