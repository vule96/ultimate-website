# Slice 8 — i18n en/vi cho web (next-intl + codegen đối xứng)

**Ngày:** 2026-07-15
**Trạng thái:** Design (chờ duyệt spec)
**Tiền đề:** Slice 7 (polish Mạch) xong trước. Chỉ áp cho `apps/web`; admin ngoài phạm vi.

## 1. Mục tiêu & phạm vi

- UI chrome (masthead, subnav, rail, sidebar, footer, newsletter, auth modal, toast, trang lỗi/404, metadata site) có **2 ngôn ngữ vi/en**. **Nội dung bài viết trong DB chỉ có tiếng Việt** — hiển thị nguyên bản ở cả 2 locale.
- **Đối xứng en/vi đảm bảo bằng máy**: một lệnh generate, không định nghĩa key/value tay ở phía en ngoài phần dịch nghĩa.
- Type-safe: sai key = compile error, có autocomplete.

**Quyết định đã chốt (brainstorm 2026-07-15):**
- **next-intl** + URL prefix, chế độ `as-needed`: **vi mặc định không prefix** (mọi URL hiện tại giữ nguyên — không gãy SEO), `/en/...` cho tiếng Anh.
- **`messages/vi.json` là source of truth**; codegen đồng bộ khung en + sinh types.

**Ngoài phạm vi:** dịch nội dung bài viết; i18n cho admin; auto-translate qua API (có thể thêm sau).

## 2. Routing & cấu trúc (next-intl, App Router)

- `apps/web/src/i18n/routing.ts`: `defineRouting({ locales: ["vi", "en"], defaultLocale: "vi", localePrefix: "as-needed" })`.
- `src/middleware.ts`: `createMiddleware(routing)` — matcher loại trừ `/api`, `_next`, file tĩnh, `sitemap.xml`, `rss.xml`, `robots.txt`.
- App tree chuyển sang `app/[locale]/…` (layout + page + blog + tags…); `setRequestLocale` từng page để **giữ SSG/ISR** (`generateStaticParams` trả `[{locale:"vi"},{locale:"en"}]` nhân với params hiện có).
- `<html lang={locale}>` động trong layout.
- Navigation dùng wrapper `Link/redirect/usePathname/useRouter` từ `createNavigation(routing)` — thay các `next/link`/`next/navigation` trong chrome.
- **Language switcher** VI/EN trong Masthead (đổi locale giữ nguyên pathname).

## 3. Messages & quy ước key

- `apps/web/messages/vi.json` (source of truth), `messages/en.json` (generated skeleton + dịch tay).
- Namespace theo feature: `masthead.*`, `subnav.*`, `rail.*`, `sidebar.*`, `footer.*`, `newsletter.*`, `auth.*`, `toast.*`, `errors.*`, `meta.*`.
- ICU message format cho số nhiều/biến (`{count} kết quả`).
- Chuỗi thuộc **dữ liệu** (label category trong `categories.ts`) chuyển thành key `categories.<key>` trong messages — component tra qua `t()`.

## 4. Codegen — `pnpm i18n:gen`

Script `apps/web/scripts/i18n-gen.ts` (chạy bằng `tsx`, không thêm dependency runtime):

1. Đọc `vi.json` → sinh `src/i18n/messages.d.ts`: `declare interface IntlMessages extends …` (augment type của next-intl) → **sai key/namespace = compile error + autocomplete**.
2. Đồng bộ `en.json` theo khung `vi.json` (đệ quy):
   - Key thiếu → thêm với giá trị `"__TODO__ <bản vi>"`.
   - Key thừa (không còn trong vi) → xoá.
   - Key đã dịch → giữ nguyên.
   - Giữ thứ tự key theo vi.json (diff sạch).
3. In báo cáo: số key thêm/xoá/còn `__TODO__`.

- Wire vào `package.json` (`i18n:gen`) + turbo nếu cần.
- **Guard:** unit test (hoặc bước check trong test suite) fail khi `en.json` lệch khung `vi.json` hoặc còn `__TODO__` → đối xứng được enforce trong CI.

## 5. SEO đa ngôn ngữ

- `generateMetadata` mỗi page: `alternates.languages` → hreflang `vi` (không prefix) + `en` (`/en/...`) + `x-default` = vi.
- `sitemap.ts`: mỗi URL kèm `alternates.languages` (2 locale).
- `rss.xml` giữ vi-only (nội dung bài là tiếng Việt).
- OG metadata (`locale: "vi_VN" | "en_US"`).

## 6. TypeScript

- `Locale = (typeof routing.locales)[number]` dùng xuyên suốt; params page type `{ locale: Locale }`.
- `messages.d.ts` generated — không sửa tay (header cảnh báo + đưa vào `.gitattributes` linguist-generated nếu muốn).

## 7. Kiểm thử & verify

- **TDD:** unit test cho logic sync của `i18n-gen` (thiếu/thừa/giữ bản dịch/thứ tự key — tách hàm thuần `syncMessages(vi, en)`); test guard đối xứng; test component chrome render đúng message theo locale (NextIntlClientProvider trong test setup).
- Toàn bộ test web cũ xanh sau khi chuyển `app/[locale]/`.
- **Verify E2E live:** `/` (vi, không prefix) và `/en` render đúng chrome dịch, bài viết vẫn tiếng Việt; switcher đổi locale giữ pathname; hreflang trong HTML; sitemap chứa alternates; `next build` prerender đủ 2 locale; 404/error page theo locale.
