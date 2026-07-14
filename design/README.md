# Bàn giao thiết kế: Trang chủ blog "Mạch" (phương án 2a)

## Tổng quan
Trang chủ của một blog/tạp chí tin tức đa lĩnh vực tên **Mạch** ("dòng chảy tri thức"), dạng feed danh sách + rail danh mục bên trái + sidebar Thịnh hành/Top xem nhiều, có tìm kiếm, lọc danh mục, dark mode, đăng nhập/đăng ký, lưu (bookmark) bài viết và đăng ký newsletter. Đối tượng: lập trình viên và bạn trẻ Gen Z quan tâm công nghệ, AI, tài chính, kiến trúc, văn hoá, giải trí.

## Về các file trong gói này
File `Mach - Trang chu.dc.html` (kèm runtime `support.js`) là **bản tham chiếu thiết kế viết bằng HTML** — một prototype thể hiện diện mạo và hành vi mong muốn, **không phải code để chép thẳng vào dự án**. Nhiệm vụ của dev là **dựng lại thiết kế này trong codebase Next.js + Firebase hiện có**, dùng đúng các pattern/thư viện của dự án (React component, Tailwind hoặc CSS Modules, Firestore, v.v.).

Cách xem prototype: mở `Mach - Trang chu.dc.html` bằng trình duyệt (cần cả `support.js` nằm cùng thư mục). Bên trong file, phần logic (state, filter, auth, bookmark) nằm ở class `Component`; phần markup nằm ở template — đọc để nắm chính xác cấu trúc và style.

## Độ chi tiết (Fidelity)
**Hi-fi.** Màu, typography, spacing, bo góc và các tương tác đều là bản cuối. Hãy dựng lại UI bám sát pixel bằng thư viện/pattern sẵn có của codebase. Ảnh bài viết trong prototype là khối màu placeholder — thay bằng ảnh thật (`coverImage`).

Lưu ý: prototype để cả 3 phương án layout (1a/1b/1c ở turn cũ và 2a ở trên cùng) trong một file dạng canvas. **Chỉ triển khai phương án `2a`** (khối có nhãn `2a`, masthead xanh dương). Các phương án khác chỉ để tham khảo lịch sử.

## Màn hình / View
### Trang chủ (một trang duy nhất)
**Mục đích:** người dùng lướt bài mới nhất, lọc theo lĩnh vực, tìm kiếm, lưu bài yêu thích, đăng ký nhận bản tin.

**Bố cục tổng thể (desktop, ~1160px):**
- **Masthead** (thanh trên cùng, nền accent xanh): wordmark "Mạch" + tagline · ô tìm kiếm ở giữa · khu vực auth bên phải.
- **Sub-nav** (nền surface, viền dưới 2px màu chữ): menu Trang chủ / Danh mục / Khám phá bên trái · dòng meta "SỐ 128 · 12.07.2026 · CẬP NHẬT MỖI NGÀY" (Space Mono) bên phải.
- **Thân trang: 3 cột** dùng `display:flex`:
  - **Rail trái (224px, cố định):** tiêu đề "Lĩnh vực" + danh sách danh mục (mỗi mục có icon + nhãn) + hộp Newsletter (nền màu chữ).
  - **Main (co giãn):** tiêu đề "Mới nhất" (có gạch chân highlight vàng `#ffcf33`) + bộ đếm kết quả + danh sách bài viết dạng hàng.
  - **Sidebar phải (250px, cố định):** "Thịnh hành" (chip màu) + "Top xem nhiều" (số thứ tự lớn) + nút "Tham gia nhóm Facebook".
- **Footer** (nền màu chữ, chữ nền sáng): 4 cột — brand+mô tả+social · Chuyên mục · Về Mạch · Bản tin — và dòng bản quyền.
- **Modal Auth** (overlay `position:fixed; inset:0`): form đăng nhập/đăng ký.

**Component — hàng bài viết (ArticleRow):** `display:flex; gap:18px; padding:19px 0; border-bottom:1px solid var(--line)`.
- Thumbnail trái: `132×90px`, `border-radius:8px`, nền = màu danh mục; góc trên phải có **số thứ tự** (Bricolage, 58px, trắng mờ 22%); góc dưới trái có nhãn danh mục viết hoa (Space Mono 8.5px, nền đen mờ).
- Giữa: tag danh mục (nền tint màu danh mục, chữ màu danh mục, 11px/700, radius 5px) + ngày (Space Mono 11px, muted) · tiêu đề (Bricolage 20px/700, line-height 1.22) · mô tả 1 dòng (13px, muted, `text-overflow:ellipsis`) · dòng meta: tác giả (đậm) · "N bình luận".
- Phải: nút **Lưu ★** (30×30, radius 8, viền + tint khi đã lưu) · lượt xem + thời gian đọc (Space Mono, muted).

**Rail danh mục (item):** `display:flex; align-items:center; gap:11px; padding:12px 13px; border-radius:9px`. Trạng thái active: nền = màu danh mục, chữ trắng, đổ bóng nhẹ theo màu; inactive: nền trong suốt, chữ màu text, icon màu danh mục. Icon dùng bộ **Lucide** (16px, stroke 2): all=grid, IT=code, AI=sparkles, Tài chính=circle-dollar, Chứng khoán=bar-chart, Kiến trúc=compass, Văn hóa=landmark, Giải trí=play-circle, Tin tức=newspaper, Phát triển bản thân=trending-up, Review sách=book-open.

## Tương tác & hành vi
- **Tìm kiếm:** lọc client-side theo `title + excerpt + category + author` (không phân biệt hoa thường). Ở prototype dùng chung 1 state cho mọi layout; trong app chỉ cần 1 ô của 2a. Với dữ liệu lớn nên chuyển sang query Firestore / full-text (Algolia hoặc Firestore + trường tìm kiếm).
- **Lọc danh mục:** click item ở rail hoặc chip Thịnh hành → set `cat`; `'all'` = tất cả. Bài hiển thị = lọc theo `cat` ∩ khớp search.
- **Dark mode:** toggle `dark`; toàn bộ màu lấy từ biến CSS (xem Design Tokens) — light/dark là 2 bộ giá trị. Nên lưu vào `localStorage` và đọc lại khi tải.
- **Bookmark (Lưu ★):** yêu cầu đăng nhập. Nếu chưa đăng nhập → mở modal auth kèm thông báo "Đăng nhập để lưu bài viết yêu thích." Đã đăng nhập → toggle trạng thái lưu của bài; header hiển thị "Đã lưu N". Trong app: lưu vào document user trên Firestore (`users/{uid}/bookmarks`), không phải state tạm.
- **Auth:** modal có 2 chế độ login/register (chuyển qua lại). Validate: email đúng regex + có mật khẩu; register có thêm "Tên hiển thị" (mặc định lấy phần trước @ nếu bỏ trống). Prototype chỉ giả lập — **app thật dùng Firebase Auth** (email/password hoặc OAuth). Đăng xuất xoá user + danh sách đã lưu khỏi UI.
- **Newsletter:** validate email; hiện thông báo thành công/lỗi. App thật: gọi API/lưu Firestore collection `subscribers`.
- **Click bài viết:** prototype hiện toast "Đang mở: …". App thật: điều hướng `router.push('/bai-viet/[slug]')`.
- **Toast:** thông báo nổi dưới giữa màn hình, tự ẩn sau ~2.8s.

## Quản lý state (gợi ý ánh xạ sang React/Next)
- `dark: boolean` — persist localStorage.
- `query: string` — ô tìm kiếm.
- `cat: string` — danh mục đang chọn (`'all'` | tên danh mục).
- `saved: Record<articleId, boolean>` — trong app thay bằng dữ liệu bookmark của user (Firestore).
- `user: { name, email } | null` — thay bằng Firebase Auth user (`onAuthStateChanged`).
- `authOpen, authMode('login'|'register'), authEmail, authPass, authName, authMsg` — state modal.
- `nlEmail, nlMsg` — newsletter.
- `toast: string` — thông báo nổi.
Fetch: danh sách bài từ Firestore (collection `articles`), sort theo ngày; Top xem nhiều = sort theo `views` (hoặc query riêng, limit 5); Thịnh hành = danh sách category cấu hình sẵn.

## Data shape (khớp Firestore)
```ts
type Article = {
  id: string;            // hoặc slug
  slug: string;          // để điều hướng /bai-viet/[slug]
  title: string;
  excerpt: string;
  category: string;      // 1 trong danh sách category bên dưới
  author: string;        // sau này có thể là { name, avatar }
  date: string;          // ISO; hiển thị dd/mm/yyyy
  readTime: string;      // "7 phút"
  views: number;         // hiển thị "11k"
  comments: number;
  coverImage: string;    // URL ảnh (Firebase Storage)
};

type Category = { key: string; label: string; color: string; icon: string /* tên icon lucide */ };
```
Danh mục hiện có: **Tất cả, IT, AI, Tài chính, Chứng khoán, Kiến trúc, Văn hóa, Giải trí, Tin tức, Phát triển bản thân, Review sách** (dễ mở rộng — chỉ thêm vào bảng category + map màu + icon).

## Design Tokens
**Accent (thương hiệu):** `#1668e3` (xanh dương). Chữ trên nền accent luôn trắng `#fff`.

**Màu — Light mode:**
- bg `#f6f3ec` · surface `#fffdf8` · text (fg) `#1c1a16` · muted `#726a5b` · line `rgba(28,26,22,.11)` · soft `rgba(28,26,22,.045)`

**Màu — Dark mode:**
- bg `#151310` · surface `#201d18` · text `#efe9df` · muted `#a89d8b` · line `rgba(239,233,223,.14)` · soft `rgba(239,233,223,.05)`

**Màu danh mục (dùng cho tag/thumbnail/icon):**
- IT `#2f6df6` · AI `#7048e8` · Tài chính `#0b8a6f` · Chứng khoán `#e8590c` · Kiến trúc `#5f6b7a` · Văn hóa `#e8843c` · Giải trí `#e64980` · Tin tức `#0ca678` · Phát triển bản thân `#37b24d` · Review sách `#e8590c`
- Tag nền = màu danh mục ở alpha ~0.13 (light) / ~0.24 (dark); chữ tag = màu danh mục đậm.
- Highlight tiêu đề "Mới nhất": vàng `#ffcf33` (gạch chân dày ~42%).

**Typography (Google Fonts):**
- Tiêu đề/heading & wordmark: **Bricolage Grotesque** (700–800), letter-spacing âm nhẹ (-.02 đến -.03em).
- Body/UI: **Be Vietnam Pro** (400–700).
- Meta/nhãn kỹ thuật (ngày, số báo, tiêu đề cột): **Space Mono** (10–11px, letter-spacing .16em, uppercase).
- Cỡ chữ tham chiếu: wordmark 34px · tiêu đề bài 20px · body 13–13.5px · tag 11px · meta mono 10–11px.

**Spacing / hình khối:**
- Bo góc: card/thumbnail 8–9px · nút/tag 5–9px · avatar tròn 50%.
- Padding masthead 20px/30px · thân trang main 24px/26px · footer 46px 30px 24px.
- Rail 224px · sidebar 250px (cố định); main co giãn.
- Viền phân cách: `1px solid var(--line)`; viền dưới sub-nav: `2px solid var(--text)`.

**Shadow:** rất tiết chế — chỉ nút rail active (đổ bóng theo màu danh mục, alpha ~.32) và modal (`0 30px 80px rgba(0,0,0,.45)`).

## Assets
- **Icon:** bộ [Lucide](https://lucide.dev) (trong Next dùng `lucide-react`). Danh sách icon từng danh mục ở mục Rail danh mục.
- **Fonts:** Bricolage Grotesque, Be Vietnam Pro, Space Mono — qua Google Fonts (hoặc `next/font`).
- **Ảnh bài viết:** chưa có ảnh thật; prototype dùng khối màu. Thay bằng `coverImage` từ Firebase Storage. Ảnh nên hiển thị đúng tỉ lệ ~132×90 (list) và cắt `object-fit:cover`.
- **Logo:** wordmark chữ "Mạch" (Bricolage 800), chưa có logo hình.

## Ghi chú tích hợp Next.js + Firebase
- Gợi ý cấu trúc component: `Masthead`, `SearchBar`, `AuthMenu` + `AuthModal`, `CategoryRail`, `ArticleRow`, `ArticleList`, `TrendingChips`, `TopViewedList`, `NewsletterBox`, `SiteFooter`, `Toast`.
- Đưa toàn bộ token vào `tailwind.config` (hoặc CSS variables `:root` + `.dark`) để hỗ trợ dark mode theo class.
- Auth: `firebase/auth` — `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`.
- Bookmark: subcollection `users/{uid}/bookmarks/{articleId}` hoặc mảng `bookmarks` trên user doc.
- Tìm kiếm nâng cao: cân nhắc Algolia hoặc trường `searchKeywords` để query Firestore.
- Với Tài chính/Chứng khoán: có thể thêm dải chỉ số thị trường dưới masthead (component riêng, dữ liệu từ API bên ngoài). Với Kiến trúc: cân nhắc layout gallery ảnh lớn cho trang danh mục.

## Files trong gói
- `Mach - Trang chu.dc.html` — prototype thiết kế (chỉ triển khai khối `2a`).
- `support.js` — runtime để mở prototype trong trình duyệt (không dùng cho production).
- `README.md` — tài liệu này (đủ để triển khai độc lập).
