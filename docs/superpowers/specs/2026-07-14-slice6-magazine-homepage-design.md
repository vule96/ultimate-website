# Slice 6 — Trang chủ blog "Mạch" (UI/UX)

**Ngày:** 2026-07-14
**Trạng thái:** Design (chờ duyệt spec)
**Nguồn thiết kế:** `design/README.md` + prototype `design/Mach - Trang chu.dc.html` (chỉ khối `2a`).

## 1. Mục tiêu & phạm vi

Dựng lại **pixel-close** trang chủ tạp chí "Mạch" (phương án `2a`) trong `apps/web` (Next.js App Router hiện có), **ưu tiên UX/UI trước** (backend AI/consumer để sau).

**Quyết định đã chốt (brainstorm 2026-07-14):**
- **Backend:** dùng **Go core API sẵn có** (`/posts`, `/tags`). Bỏ qua mọi tham chiếu Firebase trong design doc.
- **Phạm vi:** **chỉ UI/UX** — dựng toàn bộ layout, feed, rail, sidebar, dark mode, search/filter client-side, auth modal shell, newsletter, toast. **Chưa** làm backend consumer thật (auth/bookmark/newsletter).
- **Data gap:** map từ dữ liệu hiện có + ẩn mềm field thiếu (`category` = tag đầu; `readTime` = tính từ content; `author/views/comments` = null → ẩn). Adapter typed `Post → ArticleVM` để backend bổ sung sau mà **không đổi UI**.
- **Tương tác:** hoàn chỉnh về UI, **chạy cục bộ** (bookmark/user mock qua `localStorage`; auth modal validate cục bộ + toast; newsletter validate + toast). Có "seam" (interface service) để cắm backend thật sau.

**Hai quyết định cấu trúc:** (a) **Zustand** cho client store; (b) masthead + footer **nâng lên chrome toàn site** (`app/layout.tsx`), nhưng rail + sidebar + feed **chỉ ở trang chủ**.

**Ngoài phạm vi:** redesign trang `/blog/[slug]` và `/tags` (chỉ mặc chrome mới, giữ body cũ); auth/bookmark/newsletter backend thật; full-text search server-side.

## 2. Kiến trúc: Server shell + client islands

Giữ SSG/ISR + SEO của web hiện tại, đồng thời đáp ứng tính tương tác cao.

- `app/page.tsx` = **Server Component**: fetch `listAllPublished()` + `listTags()`, adapt `Post[] → ArticleVM[]` **phía server**, giữ `export const revalidate = 60`. Tiêu đề/link bài nằm sẵn trong HTML đầu tiên → SEO + FCP tốt.
- `<MagazineBoard articles={...} categories={...} />` = **client island** duy nhất giữ state tương tác. RSC vẫn SSR client component cho first paint → feed crawlable; JS chỉ hydrate hành vi.
- Search/filter client-side trên toàn danh sách (dữ liệu nhỏ — chấp nhận được; có seam chuyển sang query server khi lớn).

## 3. Chống re-render (yêu cầu trọng tâm)

Rủi ro: một mega-state re-render toàn bộ hàng bài mỗi lần gõ/toggle. Giải pháp phân lớp:

- **`useDeferredValue`** cho `query` → input mượt, recompute list được hoãn.
- **`filterArticles()` thuần + `useMemo`** — lọc là hàm thuần có test, không nằm inline trong JSX.
- **`React.memo`** cho `ArticleRow`, `CategoryRailItem`, `TrendingChip`, `TopViewedItem` với **prop nguyên thuỷ + callback ổn định** → toggle 1 bookmark chỉ re-render đúng hàng đó (`isSaved` đổi), hàng khác bị memo bỏ qua.
- **Store chọn theo slice (Zustand + selector)** → component chỉ re-render theo slice nó đọc (ô search không re-render khi bookmark đổi). Actions của Zustand có tham chiếu ổn định (dùng thay `useCallback` thủ công).
- **Theme ở cấp document** (`.dark` trên `<html>`), không nằm trong render state — chỉ nút toggle subscribe.

## 4. Theming & tokens (không hardcode màu trong component)

Palette Mạch (nền kem `#f6f3ec` / accent xanh `#1668e3`) **khác** theme xanh lá HiveQ của `packages/ui`. Scope token Mạch **chỉ trong `apps/web`** (không đụng admin).

- CSS custom properties trong `apps/web/src/app/globals.css` — `:root` (light) + `.dark` (dark):
  - Base: `--bg --surface --fg --muted --line --soft --accent` (+ `--accent-fg` = #fff).
  - Category: `--cat-it --cat-ai --cat-finance --cat-stock --cat-arch --cat-culture --cat-ent --cat-news --cat-growth --cat-book`.
  - Giá trị light/dark lấy đúng từ design doc mục "Design Tokens".
- Map vào `apps/web/tailwind.config.ts`: `colors: { bg, surface, fg, muted, line, soft, accent, "accent-fg" }` → viết `bg-surface text-fg border-line`… **Component dùng class ngữ nghĩa, không hex.**
- **Màu category** khai báo **một lần** trong `categories.ts`. Tag tint qua `color-mix(in srgb, var(--cat) 13%, transparent)` (light) / 24% (dark) — không tính alpha rải rác trong component. Thumbnail/rail-active/icon dùng biến màu category.
- **Highlight tiêu đề "Mới nhất":** vàng `#ffcf33` (`linear-gradient(transparent 58%, #ffcf33 58%)`) — token `--highlight`.
- **Font** qua `next/font/google` trong `layout.tsx`: **Bricolage Grotesque** (display, 700–800), **Be Vietnam Pro** (body, 400–700), **Space Mono** (meta). Expose thành `font-display` / `font-sans` / `font-mono` trong Tailwind. Thay Lora/Inter cho public site.
- **Shadow** tiết chế: chỉ rail item active (bóng theo màu category, alpha ~.32) và modal (`0 30px 80px rgba(0,0,0,.45)`) → 2 token `--shadow-rail-active` (tính runtime theo màu), `--shadow-modal`.

## 5. Adapter dữ liệu (Post → ArticleVM)

Hàm thuần, unit-test, cách ly UI khỏi khoảng trống backend. Đặt tại `features/magazine/lib/article-vm.ts`.

```ts
type ArticleVM = {
  id: PostId; slug: string; title: string; excerpt: string;
  category: CategoryKey;            // suy ra: tag đầu khớp config, else "all"
  categoryLabel: string;
  date: string; dateLabel: string;  // ISO → dd/mm/yyyy
  readTime: string;                 // tính từ content_html (đếm từ / 200 wpm) → "N phút"
  coverImage: string | null;
  author: string | null;            // backend chưa có → null → ẩn mềm
  views: number | null;             // backend chưa có → null → ẩn
  comments: number | null;          // backend chưa có → null → ẩn
};
```

- Rows hiện tại hiển thị: **cover, tag category, ngày, tiêu đề, excerpt, read-time**. `author/views/comments` slot vào sau khi Go core có field → **UI không đổi**.
- Dùng `content_html` (đã sanitize sẵn ở core/web) để đếm từ (strip tag) tính `readTime`.
- `excerpt` null → fallback rỗng (ẩn dòng mô tả).
- `type-fest` dùng nơi có giá trị thật: `satisfies` cho bảng categories, `ValueOf`/`Entries` cho map, `ReadonlyDeep` cho config tĩnh; kế thừa branded `PostId` sẵn có.

## 6. Cấu trúc thư mục (utils ra khỏi component, feature-scoped)

Theo pattern `src/features/*` hiện có.

```
apps/web/src/features/magazine/
  components/
    magazine-board.tsx        // client island root, compose các phần dưới
    masthead.tsx              // client — wordmark + search + dark toggle + auth menu
    search-bar.tsx            // client
    sub-nav.tsx               // server (tĩnh) — menu + dòng meta "SỐ 128 · …"
    category-rail.tsx         // client (active state)
    category-rail-item.tsx    // memo
    article-list.tsx          // client (đã lọc) + bộ đếm kết quả + heading highlight
    article-row.tsx           // memo — hàng bài
    trending-chips.tsx        // client — chip category
    top-viewed-list.tsx       // client — số thứ tự lớn
    newsletter-box.tsx        // client — self-contained
    auth-menu.tsx             // client — nút đăng nhập/đăng ký hoặc user
    auth-modal.tsx            // client — LAZY (dynamic ssr:false)
    magazine-footer.tsx       // 4 cột + copyright (chrome toàn site)
    toast.tsx                 // client — bottom-center, auto-hide 2.8s
    skeletons/
      article-row-skeleton.tsx
      board-skeleton.tsx
  hooks/
    use-theme.ts              // .dark class + localStorage
  store/
    magazine-store.ts         // zustand: filter, bookmarks, mockUser, authModal, toast
  lib/
    article-vm.ts             // Post → ArticleVM (thuần, test)
    filter.ts                 // filterArticles (thuần, test)
    format.ts                 // views "11k", date dd/mm/yyyy, readTime (thuần, test)
  services/
    bookmark-service.ts       // interface + LocalBookmarkService (localStorage)
    newsletter-service.ts     // interface + LocalNewsletterService (no-op)
  categories.ts               // bảng Category (key/label/color/icon) — single source
  types.ts                    // ArticleVM, CategoryKey, MockUser…
```

## 7. Tính năng tương tác (đầy đủ UI, chạy cục bộ)

- **Dark mode:** `useTheme` toggle `.dark` + `localStorage["mach-theme"]`; **script inline pre-hydration** trong `layout.tsx` đặt class trước paint → không nháy.
- **Search / lọc category:** client, `useDeferredValue`, `filterArticles` thuần (khớp `title + excerpt + categoryLabel + author`, không phân biệt hoa thường). Đồng bộ `?q=&cat=` kiểu shallow (`history.replaceState`) — tuỳ chọn, không gây điều hướng lại.
- **Bookmark ★:** cần "đăng nhập". Chưa có auth thật → **mock user** trong store, persist `localStorage`; bookmark persist theo mock user qua `BookmarkService`. Chưa login → mở auth modal kèm "Đăng nhập để lưu bài viết yêu thích." Header hiện "Đã lưu N". Toggle → cập nhật lạc quan + toast.
- **Auth modal:** validate cục bộ (email regex + có mật khẩu; register thêm "Tên hiển thị", mặc định phần trước @ nếu trống), set mock user. **Ghi chú rõ MOCK** (TODO nối auth thật). Lazy `dynamic(ssr:false)`.
- **Newsletter:** validate email + toast; qua `NewsletterService` (impl cục bộ no-op).
- **Click bài:** `router.push('/blog/[slug]')` (route thật). **Toast** bottom-center, tự ẩn ~2.8s.

Tất cả tương tác đi qua **interface service** để backend thật (Go core / Firebase) cắm vào sau mà không đổi component.

## 8. Hiệu năng / lazy / skeleton

- `next/image` cho thumbnail (cố định 132×90, `object-cover`, lazy dưới màn) — cần `NEXT_PUBLIC_MEDIA_HOST` trong `next.config.mjs` images (đã ghi chú ở CLAUDE.md).
- `auth-modal` + `toast` code-split (`dynamic`). Font self-hosted (không CLS).
- `loading.tsx` cấp route (skeleton rail/main/sidebar) + `ArticleRowSkeleton`; search deferred → làm mờ nhẹ khi "stale".
- `content-visibility:auto` cho hàng bài (perf danh sách dài).
- `React.memo` + selector Zustand (mục 3).

## 9. Chrome & phạm vi trang

- Masthead + footer → **chrome toàn site** trong `app/layout.tsx` (thay `SiteHeader`/`SiteFooter` cũ). Rail + sidebar + feed **chỉ trang chủ**.
- Trang `/blog/[slug]`, `/tags*` giữ body cũ dưới chrome mới; trên các trang này search/category ở masthead **điều hướng về `/`** (kèm `?q=`/`?cat=`).
- `SiteHeader`/`SiteFooter` cũ: gỡ khỏi layout (giữ file hoặc xoá tuỳ dọn dẹp).

## 10. Danh mục (single source of truth)

`categories.ts` — bảng `const … satisfies readonly Category[]`:

| key | label | color | icon (lucide) |
|---|---|---|---|
| all | Tất cả | (accent) | grid |
| it | IT | #2f6df6 | code |
| ai | AI | #7048e8 | sparkles |
| finance | Tài chính | #0b8a6f | circle-dollar-sign |
| stock | Chứng khoán | #e8590c | bar-chart-3 |
| arch | Kiến trúc | #5f6b7a | compass |
| culture | Văn hóa | #e8843c | landmark |
| ent | Giải trí | #e64980 | play-circle |
| news | Tin tức | #0ca678 | newspaper |
| growth | Phát triển bản thân | #37b24d | trending-up |
| book | Review sách | #e8590c | book-open |

Icon từ `lucide-react` (16px, stroke 2). Map tag (theo `slug`/`name` của Go core) → `CategoryKey`; **không khớp → `news`** (Tin tức) làm mặc định trung tính (xác định, không phụ thuộc thứ tự tag). Mở rộng = thêm 1 dòng + biến màu CSS.

## 11. Kiểm thử (Vitest — đã có sẵn)

- **Unit thuần:** `article-vm` (map category, readTime, ẩn null), `filter` (search + cat, không phân biệt hoa thường), `format` (views→"11k", dd/mm/yyyy, readTime), tính toàn vẹn `categories` (mọi key có color+icon).
- **Component:** `MagazineBoard` render; search lọc rows; chọn category lọc; bookmark khi chưa login → mở modal; dark toggle đổi class; auth modal validate.
- **SEO:** khẳng định link bài render trong HTML server (crawlable).

## 12. Seed data (để trang "sống" khi demo)

Thêm **file SQL seed idempotent** để feed có bài thật, phủ nhiều category, có `cover_image`.

- Vị trí: `services/core/seed/seed_articles.sql` (thư mục mới).
- Nội dung: `INSERT ... ON CONFLICT (slug) DO NOTHING` cho **~10–12 bài** `status = 'PUBLISHED'`, `published_at` rải trong vài tuần gần đây; mỗi bài có `title`, `slug`, `excerpt`, `content_html` (vài đoạn thật để tính `readTime` + xem ở trang detail), `content_json = '{}'`, `cover_image` (URL ảnh Unsplash public — hoặc để `NULL` để rơi về khối màu category nếu không muốn host ngoài).
- Tags: chèn ~8–10 tag khớp `CategoryKey` (`name`/`slug`: IT, AI, Tài chính, Chứng khoán, Kiến trúc, Văn hóa, Giải trí, Tin tức, Phát triển bản thân, Review sách) `ON CONFLICT (slug) DO NOTHING`; nối `post_tags` để mỗi bài có 1 category chính (khớp map ở mục 10).
- Chạy: ghi lệnh vào `README.md`/`services/core/README.md` — `docker compose exec -T postgres psql -U blog -d blog < services/core/seed/seed_articles.sql` (idempotent, chạy lại an toàn).
- **Quyết định ảnh cover:** dùng URL Unsplash public cho ảnh thật → phải thêm host vào `next.config.mjs` `images.remotePatterns` **và** cùng cơ chế `NEXT_PUBLIC_MEDIA_HOST` (mục 8). Nếu muốn tránh phụ thuộc host ngoài, để `cover_image = NULL` → fallback khối màu category (vẫn "sống" nhờ màu + số thứ tự kiểu báo in).

## 13. Rủi ro & lưu ý

- Palette Mạch khác theme `packages/ui` → chỉ scope trong web, tránh vỡ admin.
- `next/image` cần cấu hình host media; nếu bài chưa có `cover_image` → khối màu category (đúng như prototype) làm fallback.
- Mock auth phải đánh dấu rõ để không nhầm là auth thật; seam service để thay bằng backend.
- Giữ nguyên `revalidate`, metadata, sitemap/rss/robots hiện có — không hồi quy SEO.
