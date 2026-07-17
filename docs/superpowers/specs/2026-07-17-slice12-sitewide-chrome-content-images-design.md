# Slice 12 — Chrome Mạch toàn site + content images (CLS 0 + blurhash placeholder)

**Ngày:** 2026-07-17
**Trạng thái:** Design (đã duyệt qua brainstorm)
**Root cause đã xác nhận:** ảnh trong `content_html` do editor chèn không có `width/height` → CLS ở trang detail (cover đã fix từ Slice 10). Masthead/subnav chỉ nằm trong island trang chủ → detail/tags thiếu đầu trang.

## A. Masthead/SubNav toàn site

- Chuyển `<Masthead />` + `<SubNav />` từ `MagazineBoard` ra `app/[locale]/layout.tsx` (trong `NextIntlClientProvider`, trên `{children}`). `MobileCategoryBar` + rail + sidebar giữ nguyên chỉ trang chủ.
- `SearchBar` khi KHÔNG ở trang chủ: `setQuery` như cũ + `router.push("/")` (useRouter/usePathname từ `@/i18n/navigation`; pathname !== "/" → push). Người dùng gõ ở trang detail → về trang chủ thấy kết quả lọc ngay.
- Masthead không dùng `m.` → đứng ngoài `LazyMotion` OK. `MagazineBoard` bỏ 2 component đã chuyển.
- Test: cập nhật `magazine-board.test.tsx` (không còn masthead trong board — search test chuyển sang test SearchBar/hoặc render layout-level), thêm assert masthead render qua trang khác nếu khả thi bằng component test đơn lẻ.

## B. Content image meta (core Go)

- Migration: `posts.content_image_meta JSONB NULL`. Cấu trúc: `{"<src>": {"w": int, "h": int, "ph": "data:image/png;base64,..."}}` — `ph` = blurhash render sẵn PNG 32px (cạnh dài) data URI ~1–2KB.
- `internal/platform/blurhash`:
  - `ExtractImgSrcs(html string) []string` — parser `golang.org/x/net/html`, dedupe giữ thứ tự, chỉ `http(s)`, cap 20.
  - `EncodeMeta(data []byte) (Meta, error)` — decode 1 lần: `Meta{W, H int; Blurhash string; PlaceholderPNG string /*data uri*/}` (dimension check chống bomb như cũ; PNG placeholder: `bh.Decode(hash, 32, h32)` → png → base64).
  - Worker `Job` mở rộng: `Kind` (cover | content) hoặc đơn giản job mới `ContentJob{PostID, HTML}` — worker fetch từng src qua `Fetcher` (SSRF guard sẵn), build map, `Store.SetContentImageMeta(ctx, id, meta)` (method mới GormRepository, `UpdateColumn`, không đổi version).
  - Enqueue: posts service sau Create/Update khi `content_html` đổi (so sánh với bản cũ ở Update; Create luôn enqueue nếu có img). Non-blocking như cũ.
  - Ảnh lỗi fetch/decode → bỏ qua src đó (map thiếu entry, web graceful), metric `blurhash_jobs_total{result=...}` dùng chung.
- `cmd/blurhash-backfill` mở rộng: thêm pass content — quét bài `content_html LIKE '%<img%' AND content_image_meta IS NULL`.
- API `postResponse` + `Post` domain thêm `content_image_meta` (map[string]ImageMeta, JSON passthrough).
- Cache: write path đã bump version; SetContentImageMeta là background write — bump version `posts` sau khi set (bài detail cache 5m cần thấy meta mới sớm).

## C. Web — PostContent plugin

- `@ultimate/types`: `PostSchema` thêm `content_image_meta: z.record(z.object({ w: z.number(), h: z.number(), ph: z.string() })).nullable()`.
- `features/posts/enrich-images.ts`: rehype plugin thuần `rehypeEnrichImages(meta)` — chạy SAU `rehypeSanitize` trong pipeline `sanitize.ts` (meta là dữ liệu backend mình sinh, không phải user input): mỗi node `img`:
  - luôn: `loading="lazy"`, `decoding="async"`;
  - có `meta[src]`: set `width`/`height` + `style: background:url('<ph>') center / cover no-repeat` (browser reserve đúng ratio → CLS 0, placeholder hiện tức thì).
- `PostContent` nhận prop `imageMeta` (từ `post.content_image_meta`), truyền vào pipeline. `.article-body img` CSS giữ nguyên (max-width 100%, height auto — với width/height attr, `height:auto` giữ ratio, không shift).
- Test: unit plugin (img có meta → có width/height + style bg; không meta → chỉ lazy; style KHÔNG leak từ input gốc — sanitize vẫn strip style user).

## Kiểm thử & verify

- Go: TDD `ExtractImgSrcs` (dedupe, cap, bỏ data:/relative), `EncodeMeta` (w/h đúng + data URI prefix), worker content job (fake fetcher/store), repo `SetContentImageMeta` (DB test).
- Web: plugin test + PostContent snapshot; test cũ xanh.
- E2E: bài có ảnh R2 trong dev DB → sau restart core + save lại (hoặc backfill) → API trả meta; detail: `<img width height style>` trong HTML, DevTools CLS ≈ 0; masthead/subnav hiện trên detail/tags/404, search từ detail điều hướng về home có lọc; dark + `/en`.

## Ngoài phạm vi

- Backend consumer (Slice 13 — brainstorm riêng ngay sau); `next/image` cho content img (giữ img thô + attrs — đủ cho CLS/format do R2 serve); srcset content images (backlog).
