# Mạch — Newsroom Redesign (bản C, chốt qua mockup)

**Ngày:** 2026-07-19
**Nguồn:** Feedback "site vẫn ra AI, chưa tự nhiên" → brainstorm lại đúng `frontend-design` + 3 mockup (A teal product / B đỏ wire / **C trộn — CHỐT**).
**Mockup chốt:** bản C (chrome cam-đỏ + ticker + hero title-đè-ảnh + nav gạch chân + color-code chuyên mục). Artifact: `mach-newsroom-c.html`.
**Mục tiêu:** Chuyển từ "tạp chí Mạch" (Slice 6–12: nền kem + serif + broadsheet — dính 2/3 cluster AI) sang **digital newsroom** đọc ra "báo tin tức đa lĩnh vực thật". Không đụng backend/API/kiến trúc — chỉ FE token/font/layout/component.

## Chẩn đoán vì sao bản cũ "ra AI"
Đổi accent teal ở redesign trước chỉ sửa 1/3 dấu hiệu. Còn giữ **nền kem `#f6f3ec`** (cluster #1) + **broadsheet** (hairline khắp nơi, mono "SỐ 128"/"LĨNH VỰC", serif display) (cluster #3). Bản C bỏ cả 2 trụ.

---

## 1. Design tokens (thay hệ Mạch cũ)

**Bỏ:** nền kem, `--highlight`, mọi token `chrome/ink/field` kiểu tạp chí cũ sẽ được ánh xạ lại (không xoá đột ngột nếu component khác còn dùng — dọn theo).

**Palette mới** (`globals.css`, đủ light + `.dark`):
| token | light | dark | vai trò |
|-------|-------|------|--------|
| `--page` | `#fbfbfc` | `#111214` | nền trang (trắng lạnh, KHÔNG kem) |
| `--surface` | `#ffffff` | `#1a1c1f` | mặt card/masthead |
| `--surface-2` | `#f1f2f4` | `#232529` | input/chip nền |
| `--ink` (=`--fg`) | `#181a1d` | `#ecedef` | chữ chính |
| `--muted` | `#5a5d64` | `#a2a5ad` | phụ |
| `--faint` | `#8b8e96` | `#71747c` | meta/timestamp |
| `--line` | `#e6e7ea` | `#2a2d31` | hairline nhẹ (dùng tiết chế) |
| `--line-strong` | `#d4d6da` | `#3a3d42` | divider nav |
| `--brand` (=`--accent`) | `#e1442b` | `#ff6a4d` | **cam-đỏ vermilion** — brand/live/hero/CTA/ranking |
| `--brand-ink` | `#c0341f` | `#ff8368` | hover CTA |
| `--brand-tint` | `#fce9e3` | `#3a1a12` | nền nhạt brand |

**Section colors** (muối, để quét — đỏ KHÔNG dùng cho section, tránh giẫm brand): `--sec-tech #2565b0/#5b9bde`, `--sec-fin #1f7a52/#4fae82`, `--sec-life #b06a1f/#d79a4c`, `--sec-cul #a0452f/#d4785f`, `--sec-dev #6a4aa0/#a189d0`, `--sec-book #8a6a34/#c2a468`.

**`categories.ts`:** đổi 10 màu category về ánh xạ section-color ở trên (mỗi category thuộc 1 section → mượn màu section; xem §3). `ACCENT` → vermilion `#e1442b`.

## 2. Typography (bỏ serif + mono chrome)
- **Một họ chữ chủ đạo: Be Vietnam Pro** (đã có, VN chuẩn) cho **toàn bộ** — headline (weight 800/900), body (400/500), label (700). Personality gánh bằng **weight + scale + letter-spacing âm ở heading**, không bằng serif.
- **Bỏ `next/font` Roboto (display), Space Mono (mono), Source Serif 4 (serif vừa thêm).** `--font-display/serif/mono` map hết về Be Vietnam Pro (giữ biến để không vỡ reference, cùng trỏ 1 họ). Số/timestamp: `font-variant-numeric: tabular-nums` (không cần mono).
- `.article-body`: **sans** (bỏ serif vừa set ở đợt trước), size 1.125rem, line-height 1.75, measure ~68ch.
- Bỏ label mono `subnav.meta` ("SỐ 128 · …") — thay bằng ngày thật hoặc bỏ.

## 3. Section model (mới — cốt lõi newsroom)
Site hiện 11 category. Newsroom nhóm thành **section trang chủ**. Thêm `features/magazine/sections.ts`:
```
SECTIONS = [
  { key:"tech",   label:"Công nghệ",         cats:["it","ai"],            color: sec-tech },
  { key:"finance",label:"Tài chính",          cats:["finance","stock"],    color: sec-fin  },
  { key:"life",   label:"Đời sống & Văn hoá", cats:["culture","arch","ent"],color: sec-life },
  { key:"dev",    label:"Phát triển",         cats:["growth","book"],      color: sec-dev  },
]
```
- `news` (Tin tức) → gom vào ticker "Trực tiếp"/mới nhất, không thành band riêng (hoặc thành band cuối nếu đủ bài).
- Helper `groupBySection(articles)` → `Record<sectionKey, ArticleVM[]>` (thuần, test được). Category màu = màu section chứa nó (một nguồn).
- ArticleVM giữ nguyên schema; thêm trường dẫn xuất `sectionKey` (hoặc tra qua map lúc render).

## 4. Layout trang chủ (thay `MagazineBoard`)
RSC `page.tsx` giữ nguyên (fetch-all force-dynamic + adapt VM). Thay client shell `MagazineBoard` → **`NewsroomBoard`** với các component con:

- **`Ticker`** (client): band mực đậm, tag "Trực tiếp" cam-đỏ + chấm ping, headline chạy `translateX` (28s linear, **`prefers-reduced-motion` → tắt animation, hiện tĩnh**). Nguồn: N bài mới nhất. Tách chuyên mục màu section ở nhãn.
- **Chrome** (đưa vào `layout.tsx` như hiện tại): `Masthead` (logo `M<em>ạ</em>ch` — ạ cam-đỏ, tagline, search, CTA), **top-rule 3px cam-đỏ**, **`SectionNav`** (Trang chủ + 4 section + …, active = gạch chân cam-đỏ). Bỏ `SubNav` mono cũ.
- **`Hero`** (client): grid `1.85fr / 1fr`. Trái = lead **title đè ảnh** (`CoverImage` + scrim gradient, kicker cam-đỏ nền, h1 đè, meta). Phải = 4 mini (thumb 82px + kicker màu section + title). Lead + mini phản ứng filter (search/section) như hiện tại.
- **Section bands** (`SectionBand` × 4): header (ô vuông màu section + h2 màu section + rule mờ + "Xem tất cả"), `grid3` card (cover 16/10 + kicker màu section + title + excerpt sans + meta tabular). Mỗi band lấy tối đa 3–4 bài của section (từ `groupBySection`), ẩn nếu section rỗng.
- **Rail phải** (300px, `hidden lg:block`): panel "Đọc nhiều nhất" (rank số cam-đỏ, dùng `topViewed` thật), "Chủ đề" (chips), "Bản tin Mạch" (subscribe — panel mực đậm, nối `apiNewsletterService` sẵn có).
- **Search/bookmark/auth**: giữ nguyên seam + store Zustand hiện có (bookmark thật, auth Google BFF, toast). Search gõ → lọc hero + bands (giữ `filterArticles`, mở rộng để lọc trong section).
- **Bỏ:** list "Mới nhất" phẳng, `FeaturedLead` cũ (thay bằng Hero mới), highlighter, `CategoryRail` icon/typography cũ, `MobileCategoryBar` (thay bằng SectionNav cuộn ngang).

## 5. Detail page (`/blog/[slug]`)
- Chrome mới (ticker + masthead + section-nav) tự áp qua `layout.tsx`.
- Bài: kicker màu section (thay teal), title `font` heavy (Be Vietnam Pro 800), meta `tabular-nums` (ngày · phút đọc · lượt xem). `.article-body` **sans** (bỏ serif). Link/blockquote/marker → cam-đỏ. `RelatedPosts` giữ, thumbnail + kicker màu section.
- `TagBadge` chips → màu section.

## 6. Tags (`/tags`, `/tags/[slug]`)
- Chips màu section; header `#tag` màu section; `PostCard` row cover + kicker màu + title sans + excerpt. Pagination/error/not-found theo token mới.

## 7. Responsive
- Ticker: giữ (cuộn), tag "Trực tiếp" co.
- Masthead: search full-width dưới / ẩn tagline; SectionNav cuộn ngang.
- Hero: 1 cột (lead trên, mini xếp dọc).
- Bands: `grid3` → 2 cột (tablet) → 1 cột (mobile).
- Rail: `hidden lg:block`.

## 8. Verify
- Test: cập nhật `magazine-board.test` → `newsroom-board.test`; thêm test `groupBySection` (thuần), `Ticker` (reduced-motion tĩnh), `Hero` (lead + mini, filter). Giữ store/bookmark test.
- Playwright live (dev :3100): home/detail/tags × light/dark/mobile — brand cam-đỏ, section màu, ticker, hero overlaid, dark đủ tương phản, search lọc, bookmark gate.
- Rebuild Docker web image → verify `:3000`.
- `pnpm --filter @ultimate/admin exec tsc --noEmit && build` (redesign không đụng API/types nhưng chạy cho chắc).

## 9. Ngoài scope
Backend, i18n keys mới chỉ khi cần (ticker "Trực tiếp", section labels — qua `i18n:gen`). Không đụng auth/bookmark/newsletter logic (chỉ thay UI vỏ). Prod-edge (TLS/CD) là slice riêng.

## 10. Chiến lược triển khai (giảm rủi ro)
Làm theo tầng, verify từng bước: **(a)** token + font (global, thấy ngay toàn site) → **(b)** chrome (ticker/masthead/section-nav) → **(c)** homepage (sections.ts + NewsroomBoard + Hero + bands + rail) → **(d)** detail + tags → **(e)** verify + rebuild. Mỗi tầng giữ test xanh.
