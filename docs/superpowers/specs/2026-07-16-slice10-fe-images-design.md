# Slice 10 — FE image optimization + blurhash (chống CLS)

**Ngày:** 2026-07-16
**Trạng thái:** Design (đã duyệt qua brainstorm)
**Tiền đề:** Slice 9 xong — API trả `cover_blurhash` + `views`.

## Vấn đề

Blog detail: ảnh cover không reserve chỗ → layout shift (CLS) khi ảnh về. Thumbnail/list chưa tối ưu size/format. "Top xem nhiều" đang fake (5 bài mới nhất).

## 1. Types

- `@ultimate/types` `PostSchema` thêm `cover_blurhash: z.string().nullable()`, `views: z.number()`. Admin build lại phải xanh (field mới optional với form).

## 2. Fix CLS gốc + blurhash placeholder

- Component `CoverImage` (`features/posts/components/cover-image.tsx`, client):
  - Wrapper `relative aspect-[16/9] overflow-hidden` → **chỗ được reserve trước khi ảnh tải = CLS 0** (kể cả không blurhash).
  - `BlurhashCanvas` tự viết (~40 dòng, decode qua npm `blurhash`, canvas 32×32 scale CSS full) absolute dưới ảnh, chỉ render khi có hash.
  - `next/image fill` + `onLoad` set state → ảnh `opacity-0 → 100` transition 300ms; canvas giữ nguyên phía dưới (không unmount — tránh nháy).
  - Không có blurhash → nền `bg-soft` tĩnh.
- Áp: blog detail cover (thay `<Image>` hiện tại), thumbnail `ArticleRow` (blurhash placeholder trong khung 132×90 sẵn có), `PostCard` nếu có ảnh.

## 3. Image optimize

- `next.config.mjs` `images`: `formats: ["image/avif", "image/webp"]`, chuyển `domains` → `remotePatterns`, `deviceSizes/imageSizes` mặc định giữ.
- `sizes` đúng thực tế: cover detail `(max-width: 768px) 100vw, 768px`; thumbnail row `132px`; ưu tiên LCP: cover detail `priority`, 2 row đầu homepage `priority` (index < 2), còn lại lazy (mặc định).
- `quality={75}` thống nhất.

## 4. Views thật

- Adapter `ArticleVM.views` nhận từ API (hết null → hiện `formatViews` trong row meta).
- "Top xem nhiều" (`app/[locale]/page.tsx`): fetch `GET /posts?sort=views&order=desc&limit=5` (core đã whitelist `views` ở Slice 9) thay `slice(0,5)`.
- Blog detail: client fire-and-forget `POST /api/v1/posts/:id/view` (useEffect once, `navigator.sendBeacon` fallback fetch keepalive; bỏ qua lỗi im lặng).

## 5. Kiểm thử & verify

- TDD: `BlurhashCanvas` (render canvas khi có hash, không khi null), `CoverImage` (aspect wrapper + fade state), adapter views/blurhash, schema Zod mới.
- Verify E2E live: blog detail không shift (DevTools Performance/Lighthouse CLS ≈ 0), blur hiện trước ảnh, view tăng sau ~5s, top viewed đổi theo views. Lighthouse image audit sạch (định dạng next-gen, size đúng).

## Ngoài phạm vi

- Dedupe view per-user; LQIP cho ảnh trong content_html (note backlog); gallery/zoom.
