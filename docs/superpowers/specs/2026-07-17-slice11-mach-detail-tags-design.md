# Slice 11 — Redesign trang chi tiết + tags theo chrome Mạch

**Ngày:** 2026-07-17
**Trạng thái:** Design (đã duyệt qua brainstorm)
**Tiền đề:** token Mạch (bg/fg/accent/chrome/ink, category colors) + font Roboto/Be Vietnam Pro/Space Mono + `CoverImage`/`BlurhashCanvas` + views thật đã có (Slice 6–10).

## Quyết định đã chốt (brainstorm 2026-07-17)

1. Detail = **Editorial Mạch**: giữ kết cấu kicker → title → meta → cover → nội dung (1 cột `max-w-prose` 42rem), thay toàn bộ da sang token Mạch.
2. **Có "Bài liên quan"** cuối bài (3 bài theo tag đầu, RSC + ISR).
3. Tags = **chips màu + rows Mạch** (không chỉ đổi màu).

## 1. `/blog/[slug]`

- **Kicker**: category suy từ tag đầu (`categoryFromTags`) — mono uppercase, màu category từ `categories.ts` (không khớp → accent). Bỏ class `article-kicker` cũ.
- **Title**: `font-display` (Roboto 900), `text-[2rem] sm:text-[2.6rem]`, leading 1.15, tracking -0.01em.
- **Meta** dòng mono 11px `text-muted`: `dd/mm/yyyy · N phút đọc · X lượt xem` — views từ API (Slice 9), ẩn khi 0, format `formatViews`. Key i18n mới `detail.views` (`{count} lượt xem` / `{count} views`).
- **Prose**: scope class `prose-mach` — typography theo token: chữ `fg`, muted `muted`, link `accent` (underline offset), blockquote viền trái `accent` nền `soft`, `code`/`pre` nền `soft` viền `line`, `hr` màu `line`, heading `font-display`. Override qua CSS trong `globals.css` (không thêm plugin mới — plugin typography đã có).
- **Tag chips cuối bài**: pill tint màu category (`color-mix(in srgb, <color> var(--tint-strength), transparent)` + chữ màu category), link `/tags/[slug]`.
- Giữ nguyên: `CoverImage` (blurhash, priority), `ViewTracker`, `ReadingProgress`, metadata/JSON-LD/hreflang, `revalidate=60`, `notFound` bài non-published.

## 2. Bài liên quan — `RelatedPosts` (RSC thuần)

- Fetch `listPublished({ tag: tagĐầu })` (ISR 60s), lọc bỏ bài hiện tại, lấy 3. Bài không có tag → `listPublished({})` bài mới nhất.
- < 1 bài sau lọc → không render section.
- UI: heading kiểu section Mạch (kicker mono "Bài liên quan" — key `detail.related`), grid 1→3 cột; card: thumbnail 16/9 (`CoverImage`, sizes nhỏ, không priority) + kicker category màu + title display 17px + ngày mono. Link `Link` i18n.

## 3. `/tags`

- Header: kicker mono + title `font-display` theo token (bỏ `article-kicker/article-title`).
- Chips: tag khớp category (`categoryFromTags` với 1 tag) → chữ màu category + nền tint; không khớp → accent tint. Bỏ `card-lift`/`shadow-card` cũ.

## 4. `/tags/[slug]`, `/tags/[slug]/page/[n]`, `/page/[n]` (dùng chung `PostsPage`)

- Header trang tag: `#<tag>` màu category + dòng mono `{total} bài viết` (key `tagsPage.count`; `total` có sẵn trong list response — `PostsPage` đã fetch).
- **`PostCard` restyle thành row Mạch** (server component thuần): thumbnail 132×90 (`relative` khung cố định + `BlurhashCanvas` + `next/image fill sizes="132px"`) ẩn trên mobile như ArticleRow; kicker category màu + ngày mono; title `font-display` 20px; excerpt 14px muted; hết `font-serif`/`group-hover:text-primary` cũ (hover → `text-accent`).
- Pagination component: restyle token (accent/line/soft), giữ path-based logic.

## 5. i18n & test

- Key mới: `detail.related`, `detail.views`, `tagsPage.count` → vi.json + `pnpm i18n:gen` + dịch en.json (guard test enforce đối xứng).
- Test: `RelatedPosts` (lọc bài hiện tại, ẩn khi rỗng — test hàm chọn bài thuần `pickRelated`), `PostCard` markup mới, cập nhật test cũ nếu assert class/text cũ. Toàn bộ test web + build xanh.

## Ngoài phạm vi

- Backend consumer (auth/bookmark/newsletter thật) — slice kế tiếp (thứ tự đã chốt 3→2→1).
- Comment, share buttons, TOC bài viết (note backlog).
