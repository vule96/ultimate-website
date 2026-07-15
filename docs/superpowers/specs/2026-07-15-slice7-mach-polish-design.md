# Slice 7 — Polish trang chủ "Mạch" (shell, màu, newsletter, perf, animation)

**Ngày:** 2026-07-15
**Trạng thái:** Design (chờ duyệt spec)
**Tiền đề:** Slice 6 DONE (trang chủ Mạch chạy live). Slice này chỉ polish — không đổi kiến trúc RSC shell + client island, không đụng backend.

## 1. Mục tiêu & phạm vi

Sửa các điểm gợn sau khi nhìn bản live của Slice 6:

1. **Max-width:** Masthead + SubNav đang trải nội dung 100% chiều ngang màn hình.
2. **Màu lệch tông:** Masthead nền `bg-accent` (băng xanh đặc) và footer nền `bg-fg` (đen mực) không ăn khớp với body kem; token light/dark chưa phủ nhóm chrome/ink/field.
3. **Font display** chưa đạt chất editorial mong muốn.
4. **Newsletter** (rail + footer) sơ sài: không loading/success state, không microcopy, không focus ring.
5. **Re-render:** inline arrow (`onOpen={(slug) => …}`) truyền vào component đã `memo` → memo vô hiệu.
6. **Animation:** chưa có — cần mức "vừa phải", hiệu năng tốt.

**Quyết định đã chốt (brainstorm 2026-07-15):**
- Animation dùng **framer-motion** (user chọn), nhưng bắt buộc dạng **`LazyMotion + domAnimation` + component `m.`** (~5KB) — cấm import `motion.` full bundle.
- i18n **KHÔNG** thuộc slice này → Slice 8 riêng (spec `2026-07-15-slice8-i18n-design.md`).
- Quy ước mới ghi vào `CLAUDE.md`: **luôn ưu tiên CodeGraph (`codegraph_explore`) trước grep/Read** khi khảo sát code.

**Ngoài phạm vi:** i18n; backend consumer (auth/bookmark/newsletter thật); redesign `/blog/[slug]`, `/tags`.

## 2. Shell & max-width

- `max-w-shell`: **1160px → 1200px** (một chỗ duy nhất trong `tailwind.config.ts`).
- **Masthead + SubNav:** nền **full-bleed** (giữ ngữ pháp tạp chí), nội dung bên trong bọc `<div className="mx-auto flex max-w-shell …">` — cùng khuôn với body/footer. Padding ngang chuyển từ `px-[30px]` cứng ở khối ngoài vào khối inner để mép nội dung thẳng hàng trên mọi breakpoint.
- Footer đã có inner `max-w-shell` — chỉ đồng bộ lại padding cho khớp.

## 3. Hệ màu — nhóm token mới (light + dark đầy đủ)

Thêm vào `globals.css` (`:root` + `.dark`) và map vào `tailwind.config.ts`. **Component chỉ dùng class ngữ nghĩa, không hex** (trừ category color ở `categories.ts`).

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--chrome-bg` | `#fffdf8` (= surface) | `#201d18` | nền Masthead + SubNav |
| `--chrome-fg` | `#1c1a16` | `#efe9df` | chữ chính trên chrome |
| `--chrome-muted` | `#726a5b` | `#a89d8b` | meta/nav phụ trên chrome |
| `--chrome-line` | `rgba(28,26,22,.11)` | `rgba(239,233,223,.14)` | viền dưới masthead/subnav |
| `--ink` | `#232019` (mực nâu ấm) | `#12100d` (sẫm hơn `--bg` một nấc) | nền footer + newsletter card |
| `--ink-fg` | `#f3efe6` | `#e8e2d6` | chữ trên ink |
| `--ink-muted` | `rgba(243,239,230,.62)` | `rgba(232,226,214,.55)` | chữ phụ trên ink |
| `--field-bg` | `#ffffff` | `#2a2620` | nền input |
| `--field-fg` | `#1c1a16` | `#efe9df` | chữ input |
| `--field-ring` | `color-mix(in srgb, var(--accent) 55%, transparent)` | (cùng công thức) | focus ring |

**Áp dụng:**
- **Masthead:** bỏ `bg-accent` → `bg-chrome-bg text-chrome-fg` + `border-b border-chrome-line`; logo "Mạch" giữ màu accent (brand statement co về logo + CTA); nút theme/auth đổi từ trắng-trên-xanh sang biến chrome; SearchBar đổi từ `white/15` sang `--field-*`.
- **SubNav:** cùng họ `chrome-*`, giữ viền dưới đậm (`border-fg` → `border-chrome-line` đậm hoặc giữ `border-fg` — quyết khi nhìn bản live, ưu tiên nhẹ hơn hiện tại).
- **Footer:** `bg-fg` → `bg-ink text-ink-fg`; các `opacity-70`/`white/10` rải rác thay bằng `ink-muted`/`ink-fg` + alpha token.
- Không đổi token base (`--bg --surface --fg --muted --line --soft --accent --highlight`).

## 4. Typography

- Display: **Bricolage Grotesque → Playfair Display** (`next/font/google`, subset `latin` + `vietnamese`, weight 700/800, var `--font-display-next` giữ nguyên tên) — logo, tiêu đề section, title bài trên trang chủ đổi chất serif editorial. Body giữ **Be Vietnam Pro**, meta giữ **Space Mono**.
- Tinh chỉnh: title bài `line-height` 1.32 → ~1.25, `letter-spacing` display nới từ `-0.03em` → `-0.015em` (serif không cần track âm sâu); meta mono giảm size nơi dày đặc.
- Fallback stack trong `--font-display` cập nhật theo (`Playfair Display, Georgia, serif`).

## 5. Newsletter redesign (rail + footer, cùng ngôn ngữ hình ảnh)

Component `NewsletterBox` viết lại:

- **Khối hình:** card nền `bg-ink text-ink-fg`, viền trên accent mảnh (2px), hoạ tiết mono nhỏ ở góc (CSS thuần, không ảnh). Heading font display; benefit line: "Mỗi sáng thứ Hai · 5 phút đọc · Huỷ bất kỳ lúc nào".
- **Form:** input + nút thành một khối liền (input bo trái, nút accent bo phải), focus-visible ring `--field-ring`, disabled khi đang gửi.
- **State machine** (hàm thuần, có test): `idle → submitting → success | error`.
  - `success`: thay form bằng dòng inline "✓ Đã đăng ký — hẹn bạn thứ Hai!" (không chỉ toast).
  - `error` (email sai): message inline dưới input + `aria-invalid="true"` + `role="alert"`; giữ toast cho lỗi hệ thống.
- **Microcopy** quyền riêng tư: "Không spam. Huỷ bằng 1 click."
- Variant `rail`/`footer` chỉ khác layout (dọc/ngang) — dùng chung state + style token.
- Service seam `NewsletterService` giữ nguyên interface.

## 6. Performance / re-render

- `MagazineBoard`: `onOpen` cho `TopViewedList` bọc `useCallback` (router ref ổn định).
- `ArticleList`: `onOpen` bọc `useCallback`; xác nhận `ArticleRow` đã `memo` + prop nguyên thuỷ (đã có từ Slice 6 — chỉ sửa phía truyền callback).
- `content-visibility: auto` + `contain-intrinsic-size` cho article row ngoài viewport (CSS utility trong globals).
- Animation không thêm state React — dùng `whileInView`/`initial`/`animate` của framer-motion, không `useState` cho hiệu ứng.

## 7. Animation (framer-motion, tiết chế)

- Setup: `<MotionConfig reducedMotion="user">` + `<LazyMotion features={domAnimation} strict>` bọc trong `MagazineBoard` (client island — không đụng RSC). Chỉ dùng `m.` components; ESLint/review chặn `motion.` import.
- **Article rows:** fade-up nhẹ (`opacity 0→1`, `y 12→0`, 0.3s ease-out, stagger theo index viewport, `viewport={{ once: true }}`).
- **AuthModal:** fade + scale 0.96→1 in/out. **Toast:** slide-in từ dưới. **Nút/chips:** hover/tap scale 1.02/0.98.
- Chỉ animate `transform`/`opacity` (compositor-only). Không layout animation, không parallax, không animate khi filter đổi (giữ `useDeferredValue` flow hiện tại).

## 8. TypeScript

- Token/variant các component viết lại type bằng union literal + `satisfies` (vd `NewsletterVariant = "rail" | "footer"`, state machine `NewsletterStatus` discriminated union).
- type-fest nơi có giá trị thật (`ReadonlyDeep` cho config tĩnh mới nếu có) — không rắc bừa.

## 9. SEO & không-regression

- Không đổi RSC shell, `revalidate = 60`, metadata, sitemap/rss — mọi thay đổi nằm trong client island + CSS + layout chrome.
- Verify sau khi đổi font: `next build` xanh, HTML đầu vẫn chứa title/link bài, không CLS do font (`display: swap` + fallback metric hợp lý).

## 10. Docs & quy ước

- `CLAUDE.md`: thêm quy ước "ưu tiên CodeGraph trước grep/Read"; cập nhật Trạng thái hiện tại + 📍 khi slice xong.
- `docs/status-roadmap.html` + `docs/architecture.md`: cập nhật nếu chạm (hỏi trước khi sửa bản HTML theo quy ước).

## 11. Kiểm thử & verify

- **TDD:** unit test cho newsletter state machine + helpers mới; cập nhật test component bị đổi markup (`newsletter-box`, masthead nếu cần snapshot class).
- Toàn bộ test web hiện có phải xanh (56 + test mới).
- **Verify E2E live:** light/dark cả masthead/subnav/footer/newsletter; max-width thẳng hàng ở 1440px+; newsletter flow (sai email → inline error, đúng → success state); reduced-motion (bật OS setting → không animation); bookmark/search không regression.
