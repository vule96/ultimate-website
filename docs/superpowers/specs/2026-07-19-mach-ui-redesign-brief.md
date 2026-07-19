# Mạch UI — Design Redesign Brief (chống "AI look")

**Ngày:** 2026-07-19
**Trạng thái:** Brief cho session sau (chưa brainstorm/spec đầy đủ)
**Nguồn:** Audit UI live (`http://localhost:3000` home + `/blog/[slug]`, light+dark) bằng Playwright, đối chiếu skill `frontend-design`.
**Mục tiêu:** UI Mạch đang "đọc ra AI/templated". Redesign để có bản sắc riêng, KHÔNG đập hết — chọn khu vực đắt giá trước.

## Cách tiếp cận session sau
1. `frontend-design` (đọc lại) → `superpowers:brainstorming` chốt hướng thẩm mỹ (màu thương hiệu + hero + type).
2. Áp cho **trang chủ** trước (impact cao nhất), rồi blog detail.
3. Verify E2E live (Playwright screenshot light+dark+mobile) — so trước/sau.

## Chẩn đoán gốc (từ audit)
UI hiện rơi trúng **2/3 cluster AI-design**: nền **kem #F5F1EA** (cluster #1) + **broadsheet hairline + mono labels + "SỐ 128"** (cluster #3), accent là **xanh mặc định #2563EB** (shadcn default — dấu hiệu số 1). Ba thứ này xuất hiện ở mọi site AI sinh ra bất kể chủ đề. Nền tảng kỹ thuật tốt (token chrome/ink, CLS 0, RSC+island); vấn đề là **lựa chọn thẩm mỹ an toàn quá**.

## Findings — ưu tiên theo tác động
1. **🔴 Accent = xanh mặc định** (`Mạch` logo + mọi CTA + số 01–05). → Chọn màu thương hiệu **từ chủ đề "Mạch"** (mạch máu/dòng chảy): đỏ oxblood / mực nâu-đỏ / teal sâu. KHÔNG blue. **Đòn ăn ~50%.**
2. **🔴 Không có hierarchy** — 12 bài = 12 row đều nhau, không lead. → Thêm **featured lead** (title + cover lớn) trước list. Giết cảm giác "list template".
3. **🟠 Bảng màu category cầu vồng** (mỗi category 1 màu bão hoà trên icon+chip+số). → Kỷ luật: 1 brand + 1–2 trung tính, hoặc 1 accent biến thể tông. Không 10 màu.
4. **🟠 Cover vỡ → khối màu xanh** (placeholder block "1/IT"). → Cover thật hoặc fallback **typographic** (bìa chữ), không block màu.
5. **🟡 Rail trái = sidebar dashboard SaaS** (category + icon lucide code/sparkle/dollar). Icon trang trí không mang thông tin. → Bỏ icon, dùng typography.
6. **🟡 Mono cho MỌI label** (`LĨNH VỰC`/`THỊNH HÀNH`/`SỐ 128`/ngày). → Mono chỉ cho data/số; display face gánh label.
7. **🟡 Body sans generic** (Inter/Be Vietnam). "Tạp chí tri thức" nên có **serif đọc** (Lora/Noto Serif/Source Serif hỗ trợ tiếng Việt) → editorial thật.
8. **⚪ Highlighter vàng** dưới "Mới nhất" = trang trí. (Số 01–05 "Top xem nhiều" GIỮ được — ranking là thông tin thật.)

## Giữ được (đang tốt)
Token chrome/ink (masthead kem hoà body, footer mực nâu), category-color một-nguồn (`categories.ts`), CLS 0, RSC shell + Zustand island, i18n hreflang. Redesign **không** đụng kiến trúc — chỉ token/màu/type/layout.

## 3 đòn làm trước (chưa cần đụng font)
1. Đổi accent xanh → màu thương hiệu riêng (token `--accent` ở `globals.css` + `categories.ts`).
2. Thêm featured lead ở trang chủ (`MagazineBoard`/`ArticleList`).
3. Kỷ luật lại bảng màu category.

## File liên quan (điểm bắt đầu)
- Token màu: `apps/web/src/app/globals.css` (`:root`/`.dark` — `--accent`, chrome/ink), `apps/web/src/features/magazine/categories.ts` (category color một nguồn).
- Layout trang chủ: `apps/web/src/features/magazine/components/{magazine-board,article-list,article-row,category-rail}.tsx`.
- Font: `apps/web/src/app/[locale]/layout.tsx` (`next/font` — hiện Roboto display + Be Vietnam Pro + Space Mono).
- Detail: `apps/web/src/app/[locale]/blog/[slug]/page.tsx` + `.article-body` trong `globals.css`.

## Ảnh audit (session sau chụp lại để so)
Đã chụp `home-light.png`/`detail-light.png` (không commit). Session sau: Playwright screenshot trước/sau, light+dark+mobile.
