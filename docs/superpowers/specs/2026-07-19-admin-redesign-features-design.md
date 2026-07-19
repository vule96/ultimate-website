# Admin Redesign + lộ tính năng BE (subscribers / readers / views)

**Ngày:** 2026-07-19
**Bối cảnh:** Admin đang là shadcn dashboard mẫu ("AI template"). Redesign sang bản sắc riêng (light, tươi) + lộ 3 tính năng BE đã có data nhưng chưa có UI: **subscribers, readers, views**.
**Mockup chốt:** light warm-neutral, primary **cerulean `#1f9fe0`**, KPI earthy đa sắc, font **Plus Jakarta Sans** + mono data. (`admin-console-mockup.html`, bản `cerulean`).

## 1. Backend (module `readers` + `posts`)
Endpoint mới, tất cả sau `RequireAuth` (admin allowlist), dưới `/api/v1`:

- **`GET /subscribers`** — list phân trang. Query `page`/`page_size` (default 1/20). Trả `{ data: [{id, email, status, created_at}], total, page, page_size }`, sort `created_at DESC`.
- **`DELETE /subscribers/:id`** — xoá 1 subscriber (204). id không tồn tại → 404.
- **`GET /readers`** — list phân trang + **bookmark_count** (LEFT JOIN bookmarks GROUP BY). Trả `{ data: [{id, email, name, created_at, bookmark_count}], total, page, page_size }`, sort `created_at DESC`.
- **`GET /stats/posts`** (mở rộng) — thêm `total_views` (SUM views). Giữ field cũ.

**Repository (`readers`) thêm:** `ListSubscribers(ctx, offset, limit) ([]Subscriber, int64, error)`, `DeleteSubscriber(ctx, id) error` (trả `ErrSubscriberNotFound` khi 0 row), `ListReaders(ctx, offset, limit) ([]ReaderWithCount, int64, error)`. Domain types mới: `Subscriber{ID,Email,Status,CreatedAt}`, `ReaderWithCount{Reader + CreatedAt + BookmarkCount}`.
**Service:** wrap repo + validate paging (clamp page_size ≤ 100).
**Handler admin mới** `readers/admin_handler.go`: `RegisterAdminRoutes(rg, authMW)`. Wire trong `main.go` cùng readers module.
**Test (TDD):** repository (seed subscriber/reader/bookmark → list/count/delete/paging), handler (401 khi chưa auth, 200 list, 404 delete missing). Dùng `blog_test` như module khác.

## 2. Types (`packages/types`)
Zod schemas mới (chép tay theo struct Go — quy ước dự án): `SubscriberSchema`, `SubscriberListResponseSchema`, `AdminReaderSchema`, `AdminReaderListResponseSchema`. Export types. Cập nhật `PostStatsSchema` thêm `total_views`.

## 3. Admin theme (bản sắc riêng — KHÔNG đụng web)
Scope trong admin (không sửa `packages/ui` theme global — web dùng chung). Redefine CSS vars shadcn trong **admin `index.css`** (`:root`):
- Nền warm-neutral `--background:#f5f5f3`, card trắng, `--foreground:#22201d`, muted `#6b675f`, border `#e7e6e1`.
- **`--primary` cerulean `#1f9fe0`** (foreground trắng), `--accent`/ring theo primary.
- Semantic status: published green `#3f9a55`, draft warm-grey; giữ tách khỏi primary.
- KPI palette (token riêng admin): `--k-post/#1f9fe0`, `--k-pub/#4a9d5b`, `--k-view/#c68a2e`, `--k-sub/#c25f6b`, `--k-read/#5a6b9c` + tint mỗi màu.
- **Font**: `@fontsource-variable/plus-jakarta-sans` (UI) + `@fontsource-variable/jetbrains-mono` (mono data). Tailwind `fontFamily.sans`/`mono` map theo. Bỏ system-sans generic.
- Bo góc dịu hơn (radius ~10px), shadow mềm 2 lớp.

## 4. Admin UI (redesign + pages)
**Shell:**
- `Sidebar`: logo **"Mạch Admin"** thật (mark gradient cerulean) — bỏ "U/Ultimate Blog"; **⌘K** command hint (chỉ hiển thị đợt này, hành vi sau); nav gom nhóm **Nội dung** (Tổng quan/Bài viết/Tags/Media) · **Người dùng** (Người đăng ký/Người đọc) · **Hệ thống** (Cài đặt) — icon lucide giữ (admin tool, icon = điều hướng thật) + badge count; **user chip thật** (email + "Thoát") thay workspace-switcher giả `ChevronsUpDown`.
- `Topbar`: crumb mono + title + action (Xuất CSV / + Viết bài).

**Dashboard (`DashboardPage`):** hàng **KPI tiles** (Bài viết/Đã đăng/Lượt xem/Người đăng ký/Người đọc — icon-chip màu riêng, số mono, delta) — số lấy từ `/stats/posts` (posts/published/draft/total_views) + `/subscribers?page_size=1`.total + `/readers?page_size=1`.total; **bảng Bài viết gần đây** (thêm cột Lượt xem + status chip) + rail **Top xem nhiều** (listTopViewed) + **Đăng ký mới** (subscribers 4 mới nhất). Chart timeseries giữ.

**Trang mới:**
- **`/subscribers`** (`_authed.subscribers.tsx`): `DataTable` (email mono, ngày, status chip) + xoá (confirm) + **Xuất CSV** (client-side từ data) + paging URL. Query `GET /subscribers`.
- **`/readers`** (`_authed.readers.tsx`): `DataTable` (avatar chữ, email, tên, **#bookmark** mono, ngày) + paging. Query `GET /readers`.

**Sửa có sẵn:**
- `PostsTable`: thêm cột **Views** (mono, sort) — `sort=views` đã có ở core.
- `StatusBadge`/chip: theo token status mới.
- Admin API client (`features/*/api.ts`) + query hooks cho subscribers/readers.

## 5. Verify
- Core: `go test ./...` (blog_test) xanh — repo/handler subscribers+readers.
- Types: build `packages/types`.
- Admin: `tsc --noEmit` + `vitest` + `build` xanh; thêm test cho api/hook mới + DataTable subscribers.
- E2E live: chạy core + admin, login Google admin → dashboard KPI đúng số, `/subscribers` (subscribe thử từ web → hiện + xoá), `/readers` (đăng nhập reader → hiện + bookmark count), cột Views ở bảng bài.
- Đồng bộ: chỉ admin + core + types (web KHÔNG đụng — theme scope admin).

## 6. Ngoài scope
⌘K behavior (chỉ UI hint đợt này), reader profile/GDPR, subscriber unsubscribe flow, dark mode admin (light-only theo yêu cầu).

## 7. Chiến lược triển khai (tầng, verify từng bước)
(a) BE repo+service+handler+types (TDD) → (b) admin theme + font + shell (Sidebar/Topbar) → (c) Dashboard KPI+bảng+rail → (d) trang /subscribers + /readers → (e) PostsTable views col → (f) verify + E2E live.
