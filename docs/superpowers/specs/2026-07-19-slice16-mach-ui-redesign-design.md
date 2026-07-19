# Slice 16 — Mạch UI Redesign (đợt 1: accent + category + featured lead)

**Ngày:** 2026-07-19
**Nguồn:** `docs/superpowers/specs/2026-07-19-mach-ui-redesign-brief.md` (audit "AI look") + brainstorm.
**Mục tiêu:** Bỏ 3 dấu hiệu "AI-design" đắt giá nhất mà KHÔNG đụng kiến trúc: accent xanh mặc định, list phẳng không hierarchy, bảng màu cầu vồng. Chỉ token/màu/layout — không đụng RSC shell, i18n, CLS, font.

**Ngoài scope (đòn sau):** font serif/mono discipline (finding 6-7), bỏ icon rail (finding 5), typographic cover fallback (finding 4).

---

## 1. Brand accent: xanh → teal sâu

Đổi tại **một nguồn** token, mọi consumer tự dịch theo.

**`apps/web/src/app/globals.css`**
- `:root` `--accent: #1668e3` → `#0F6E63`.
- `.dark` **thêm dòng mới** `--accent: #3AA99B;` (hiện dark kế thừa `--accent` của `:root`; teal `#0F6E63` quá tối, chìm trên nền dark `#151310`/`#201d18` → phải sáng hơn). `--field-ring` dùng `var(--accent)` nên tự đổi.

**`apps/web/src/features/magazine/categories.ts`**
- `const ACCENT = "#1668e3"` → `"#0F6E63"`. Chi phối: category `all`, `categoryColorForTag` fallback (tag lạ), logo/nơi tham chiếu ACCENT.

**Kéo theo (không sửa tay):** logo Mạch, mọi CTA (`bg-accent`), link `.article-body a`, số ranking Top-viewed, `::selection`, blockquote border, list marker.

## 2. Category desaturate (giữ 10 category, hạ bão hoà)

Giữ nguyên cấu trúc `CATEGORIES` + `color-mix` tint hiện có; **chỉ đổi giá trị hex** về bản muối/trầm. Nguyên tắc: giữ **hue** (giữ nhận diện), hạ saturation ~40%, đủ tương phản khi dùng làm text trên tint kem. IT lệch khỏi blue chói (dấu hiệu AI) → slate-blue trầm.

| key | cũ | mới (muted) | ghi chú |
|-----|-----|------|------|
| all | #1668e3 | **#0F6E63** | = ACCENT teal |
| it | #2f6df6 | **#4C6EA3** | slate-blue trầm, hết chói |
| ai | #7048e8 | **#6A5AA0** | violet muối |
| finance | #0b8a6f | **#2F7D6A** | teal-green trầm |
| stock | #e8590c | **#B56033** | rust |
| arch | #5f6b7a | **#5F6B7A** | giữ (đã trung tính) |
| culture | #e8843c | **#B8874A** | ochre |
| ent | #e64980 | **#B25877** | rose muối |
| news | #0ca678 | **#3F8770** | green trầm |
| growth | #37b24d | **#5A8A55** | green muối |
| book | #e8590c | **#A5623F** | terracotta (tách khỏi stock) |

Verify dark: chip = `color: article.color` trên tint 24% của chính màu đó trên nền dark. Nếu màu muted nào contrast <3:1 ở dark → bump lightness màu đó (chấp nhận 1 hex chung 2 theme như hiện trạng; không thêm biến light/dark cho category đợt này).

## 3. Featured lead (1 lead + 2 secondary)

Component mới **`FeaturedLead`** (`apps/web/src/features/magazine/components/featured-lead.tsx`, client).

**Hành vi:**
- Nhận `articles: ArticleVM[]`. Đọc `query`/`cat` từ `useMagazineStore` + `filterArticles` (giống `ArticleList`) → danh sách visible. Lấy 3 bài đầu = `[lead, sec1, sec2]`.
- Layout: grid `lg:grid-cols-[1.6fr_1fr]`. Trái = lead: `CoverImage` 16/9 lớn (dùng component có sẵn, blurhash + CLS 0), kicker category (màu category), title `font-display` cỡ đại (~34–40px), excerpt clamp 2 dòng, meta mono (ngày · phút đọc · views). Phải = cột dọc 2 secondary: cover nhỏ (aspect 16/9 hoặc thumbnail) + kicker + title vừa, chia `border-t`.
- Click → `router.push(/blog/slug)` (dùng `useRouter` từ `@/i18n/navigation`, `useCallback`).
- Bookmark: giữ đơn giản đợt này — **không** thêm nút save trên lead (row list vẫn có). YAGNI.
- Ẩn khi `visible.length === 0` (search rỗng) → chỉ list hiện empty state.
- `< 3` bài: render số bài có (1 hoặc 2), không vỡ layout.
- Animation: cùng pattern `m.*` + `whileInView` như `ArticleRow`, `LazyMotion` đã bọc ở `MagazineBoard`.

**Skip trùng ở list:** `ArticleList` nhận prop mới `skipIds?: Set<string>` (hoặc `skipCount`). Vì featured lấy 3 bài **sau filter**, và list cũng filter cùng store → phải skip theo **id** để đúng khi lọc đổi. `filterArticles` chạy 2 nơi (lead + list) với cùng input → deterministic. List bỏ 3 id đầu của visible.
- Heading "Mới nhất": **bỏ highlighter vàng** (`bg-[linear-gradient(...var(--highlight))]`) → chỉ text display. `--highlight` token giữ (chưa xoá) nhưng thôi tham chiếu.

**`MagazineBoard`:** chèn `<FeaturedLead articles={articles} />` phía trên khối `flex max-w-shell` (full-width, trước rail+list), hoặc trong cột giữa trên `ArticleList`. Chọn: **full-width band trên toàn khối** (rail/sidebar vẫn dưới) để lead nổi bật thật. Truyền `articles` cho cả lead và list; list nhận `skipIds` = 3 id lead.

Tránh tính `filterArticles` 2 lần lệch nhau: nâng filter lên `MagazineBoard`? Không — giữ mỗi component tự filter (đơn giản, cùng input cùng output). List tự loại 3 id đầu của chính visible của nó = trùng với lead. An toàn.

---

## Verify (E2E live, bắt buộc)
Playwright screenshot **before/after** × {home `/`, detail `/blog/[slug]`} × {light, dark, mobile 390px}. Kiểm:
- Không còn xanh #1668e3 ở đâu (logo/CTA/số/link teal).
- Featured lead hiện 3 bài đầu, list không lặp lại 3 bài đó.
- Search/đổi category → lead + list nhất quán, không trùng.
- Category chip dịu (không cầu vồng chói), đọc được cả 2 theme.
- Dark mode teal đủ tương phản.

## Test
- Giữ xanh: `magazine-board.test`, `article-row.test`.
- Thêm `featured-lead.test`: render 3 bài đầu; `<3` bài không vỡ; filter theo cat (mock store) đổi lead; ẩn khi rỗng.
- `article-list.test` (nếu có) / thêm: `skipIds` loại đúng 3 bài.

## Admin
Không đụng API/schema/`packages/*`. Bỏ qua bước đồng bộ admin (chỉ web token/layout).
