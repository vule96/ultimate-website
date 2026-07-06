# Slice 3a — Admin shell + theme + auth

> Spec triển khai · Ngày 2026-07-06 · Dự án `ultimate-website`
> Sub-slice đầu của Slice 3 (Phase 1). Xem analysis doc §10, §13.4, §14 và spec Slice 2.

## 1. Mục tiêu & phạm vi

Dựng monorepo JS và `apps/admin` (React SPA) chạy được: đăng nhập Google (dùng lại
BFF ở Slice 2), protected routes, layout theme phỏng ảnh HiveQ (light, accent emerald),
trang Dashboard nội dung blog với dữ liệu placeholder.

**Trong phạm vi 3a:**
- Monorepo: pnpm workspaces + Turborepo; `packages/types` (types dùng chung).
- `apps/admin`: Vite + React + TS + Tailwind + shadcn/ui + React Router + lucide + Recharts.
- Theme tokens (CSS variables, light-first, sẵn cho dark).
- Tích hợp auth BFF: LoginPage, AuthProvider (`/auth/me`), ProtectedRoute, logout.
- Thay đổi core (Slice 2): CORS middleware + `CORS_ALLOWED_ORIGINS`; `APP_BASE_URL` dev → admin.
- Dashboard: Topbar + 4 StatCard + biểu đồ Recharts + list "Bài gần đây" (data placeholder).

**Ngoài phạm vi:**
- CRUD posts thật qua UI (3b).
- Tiptap editor + module media/upload (3c).
- `packages/ui` (để Slice 4 khi `apps/web` cần — tránh trừu tượng sớm).
- Dark mode bật thực tế (chỉ dựng token sẵn).

## 2. Quyết định đã chốt

| Hạng mục | Lựa chọn |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Admin build | Vite + React + TypeScript |
| Routing | React Router |
| UI | Tailwind + shadcn/ui + Radix + lucide-react |
| Charts | Recharts |
| Font | Inter (self-host qua `@fontsource/inter`, không CDN ngoài) |
| Theme | Light-first, token CSS variables sẵn cho dark |
| Types dùng chung | `packages/types` (hand-written, mirror API Go) |
| `packages/ui` | Hoãn tới Slice 4 |

## 3. Cấu trúc repo

```
/ (root)
├── package.json          # private, workspaces
├── pnpm-workspace.yaml   # apps/*, packages/*
├── turbo.json            # pipeline dev/build/lint
├── apps/
│   └── admin/
│       ├── index.html, vite.config.ts, tsconfig.json
│       ├── tailwind.config.ts, postcss.config.js, components.json
│       └── src/
│           ├── main.tsx, router.tsx
│           ├── app/                # AppShell, Sidebar, Topbar
│           ├── features/
│           │   ├── auth/           # api.ts, AuthProvider.tsx, ProtectedRoute.tsx, LoginPage.tsx
│           │   └── dashboard/      # DashboardPage.tsx, widgets/
│           ├── components/ui/      # shadcn components
│           ├── lib/                # apiClient.ts, config.ts, cn.ts
│           └── styles/             # index.css (tailwind + tokens)
├── packages/
│   └── types/              # src/index.ts (Post, Tag, PostStatus, AdminUser)
└── services/…              # Go (giữ nguyên, thêm CORS)
```

## 4. Theme tokens (light)

CSS variables trong `styles/index.css`, ánh xạ qua Tailwind theme:

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--primary` | `#16A34A` (hover `#15803D`) | nút chính, nav active, chart, ngày chọn |
| `--bg` | `#F7F8FA` | nền trang |
| `--surface` | `#FFFFFF` | card, sidebar |
| `--border` | `#EAECF0` | viền |
| `--text` | `#1A1D1F` | chữ chính |
| `--muted` | `#6B7280` | chữ phụ |
| accent | green / `#3B82F6` / `#F59E0B` / `#8B5CF6` | icon chip, trạng thái |
| radius | card `16px`, control `10px` | bo góc |
| shadow | mềm, nhẹ | card |

Bố cục bám ảnh HiveQ: sidebar trái (logo, search, nhóm nav, workspace switcher đáy),
topbar (tiêu đề + avatar + nút primary), nội dung dạng card thoáng.

## 5. Luồng auth (BFF cho SPA)

- Admin `http://localhost:5173`, core `http://localhost:8080` — khác origin → **CORS bắt buộc**.
- **Core thay đổi:**
  - Thêm CORS middleware: allow origin theo `CORS_ALLOWED_ORIGINS` (CSV), `Allow-Credentials: true`, methods `GET,POST,PUT,DELETE,OPTIONS`, headers `Content-Type`. Xử lý preflight `OPTIONS`.
  - Dev env: `APP_BASE_URL=http://localhost:5173`, `CORS_ALLOWED_ORIGINS=http://localhost:5173`.
- **Login:** nút "Sign in with Google" → `window.location.assign(CORE_URL + "/auth/google/login")` (full-page redirect, KHÔNG fetch — vì là OAuth redirect).
- Core đổi code → set cookie session (SameSite=Lax; `localhost` cùng-site nên cookie gửi kèm ở request cross-port) → redirect về `APP_BASE_URL` (admin).
- **Guard:** `AuthProvider` khi mount gọi `GET /auth/me` (`credentials:'include'`). 200 → lưu `{email}`, render app; 401 → điều hướng `/login`. Trong lúc chờ hiện spinner.
- **Logout:** `POST /auth/logout` (credentials include) → clear state → `/login`.
- `lib/config.ts`: `VITE_CORE_URL` (mặc định `http://localhost:8080`).

## 6. Trang Dashboard (placeholder)

- **StatCard × 4:** Tổng bài / Đã đăng / Nháp / Tags — mỗi cái icon chip màu (lucide), số + nhãn.
- **PostsChart:** Recharts area/line "Bài theo thời gian" (dữ liệu giả).
- **RecentPosts:** danh sách bài gần đây (tiêu đề, trạng thái badge, ngày) — dữ liệu giả.
- Data để trong `features/dashboard/mockData.ts`, thay bằng API ở 3b.

## 7. Testing & verify

- **Vitest + React Testing Library** (jsdom):
  - `apiClient`: gắn `credentials:'include'`, base URL đúng, ném lỗi khi non-2xx.
  - `ProtectedRoute`: chưa auth → render redirect tới `/login`; đã auth → render children.
  - `AuthProvider`: mock fetch `/auth/me` 200 → authenticated; 401 → unauthenticated.
- **Verify hình ảnh (end-to-end):** `pnpm dev` (admin) + core chạy → đăng nhập Google thật → Dashboard đúng theme. Dùng công cụ browser để screenshot đối chiếu ảnh HiveQ.

## 8. Tiêu chí hoàn thành (DoD)

1. `corepack enable pnpm` → `pnpm install` → `pnpm dev` chạy admin ở `:5173`.
2. Chưa đăng nhập vào route bất kỳ → bị đẩy `/login`.
3. Login Google → quay lại admin đã đăng nhập → Dashboard đúng theme (emerald, sidebar, cards, chart).
4. Logout → về `/login`.
5. `pnpm test` (Vitest) xanh cho phần logic; `pnpm build` admin thành công.
6. Core: preflight OPTIONS + request cross-origin có cookie hoạt động (không lỗi CORS).

## 9. Ranh giới sub-slice sau
- **3b:** trang list/CRUD posts gọi core API (TanStack Query + `packages/types`), thay data giả ở Dashboard bằng thật.
- **3c:** module `media` (presigned R2/MinIO) + MinIO docker + Tiptap editor + upload ảnh.
