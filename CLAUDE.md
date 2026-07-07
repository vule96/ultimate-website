# ultimate-website

Dự án website blog cá nhân (FE + BE + AI). Xây dựng mới từ đầu.

## Bối cảnh & thiết kế

Tài liệu phân tích kiến trúc, stack, chi phí và roadmap đầy đủ nằm ở:
**`docs/personal-blog-ai-analysis.md`** (đọc file này trước khi bắt đầu bất kỳ việc gì).

Tóm tắt định hướng đã chốt:
- Mục tiêu: cân bằng học + sản phẩm dùng thật. Ngân sách ~15–40 USD/tháng.
- Kiến trúc: **KHÔNG microservice thật** → Modular Monolith (Go) + 1 AI worker (Python/LangChain) tách riêng.
- FE công khai (blog): **Next.js (App Router)** + Tailwind + shadcn/ui (SSR/SSG cho SEO).
- FE admin (dashboard): **React SPA — Vite + React + TanStack Router (file-based)** (KHÔNG dùng Next.js). Auth: **Google OAuth qua Go core theo BFF pattern** (Go đổi code → session cookie httpOnly) + allowlist email. Dùng chung `packages/ui` + `packages/types` với app web.
- Editor: Tiptap (hoặc Novel) — nằm trong app admin.
- Storage ảnh: Cloudflare R2 (presigned URL). DB: Postgres + pgvector.
- Monorepo: pnpm workspaces + Turborepo.
- AI: chatbot RAG, research + tự viết bài duyệt qua Telegram (human-in-the-loop), trợ lý viết.
- Roadmap 6 phase (0 → 5); bắt đầu từ Phase 0 (nền móng) + Phase 1 (blog cơ bản).

## Trạng thái hiện tại

Triển khai Phase 1 theo **4 slice tuần tự** (spec từng slice ở `docs/superpowers/specs/`).

- ✅ **Slice 1 — DONE**: nền móng Go core + module `posts` (CRUD + tags), chạy end-to-end.
  Spec: `docs/superpowers/specs/2026-07-05-slice1-posts-foundation-design.md`.
- ✅ **Slice 2 — DONE**: auth Google OAuth (BFF) — `internal/modules/auth` + session server-side (scs + Postgres), allowlist email qua env, middleware `RequireAuth` bọc POST/PUT/DELETE `/posts`. Verify end-to-end với Google thật.
  Spec: `docs/superpowers/specs/2026-07-05-slice2-auth-oauth-design.md`.
- ✅ **Slice 3a — DONE**: monorepo (pnpm + Turborepo) + `apps/admin` (Vite + React + TS + Tailwind + shadcn/ui, theme HiveQ) + auth BFF (LoginPage, AuthProvider, ProtectedRoute) + Dashboard placeholder + CORS ở core. Advanced TS: Zod (`packages/types`) + branded IDs + type-fest + ts-reset.
  Spec: `docs/superpowers/specs/2026-07-06-slice3a-admin-shell-design.md`.
- ✅ **Slice 3b — DONE**: quản lý posts qua UI (TanStack Query + react-hook-form + zodResolver) — danh sách (bảng, filter status/tag, search debounce, phân trang qua URL), form tạo/sửa, xoá (confirm); Dashboard nối API thật (stat cards + recent). Core: thêm `q` search (ILIKE) + `GET /posts/stats`. Content tạm bằng textarea → `content_html`.
  Spec: `docs/superpowers/specs/2026-07-07-slice3b-posts-crud-design.md`.
- ✅ **Slice 3c — DONE**: rich editor **Tiptap + Lexical** (interface chung `PostEditorProps`, chọn qua flag `VITE_EDITOR`, code-split; HTML là cầu nối nạp nội dung, lưu `content_json` native best-effort; baseline parity + extras table/task-list/highlight; Lexical có `ImageNode` tự viết) + module `media` (presigned PUT S3-compatible: MinIO dev / R2 prod, `POST /media/presign` bọc auth) + chart Dashboard nối `GET /posts/stats/timeseries` (zero-fill theo tháng).
  Spec: `docs/superpowers/specs/2026-07-07-slice3c-editor-media-design.md`.
- ✅ **Slice 3d — DONE**: admin routing chuyển sang **TanStack Router** (file-based `src/routes/`, type-safe search params qua `validateSearch`, route loaders + `ensureQueryData`, auth guard `beforeLoad`, `useSuspenseQuery` + `pendingComponent`/`errorComponent`). Bỏ `react-router-dom`, `AuthProvider`, `ProtectedRoute`.
  Spec: `docs/superpowers/specs/2026-07-07-slice3d-tanstack-router-design.md`.
- ✅ **Slice 3e — DONE**: bảng dữ liệu dùng **TanStack Table** qua component `DataTable<TData>` chung (headless, manual server-side sort/pagination/filter, column visibility toggle); `PostsTable` migrate sang column defs typed (`createColumnHelper`, module augmentation `TableMeta.onDelete`); core thêm `sort`/`order` (whitelist ORDER BY); sort state ở URL search.
  Spec: `docs/superpowers/specs/2026-07-08-slice3e-tanstack-table-design.md`.
- ⏳ Slice 4: `apps/web` (Next.js) public.

**Storage & editor (từ 3c):**
- Object storage S3-compatible: dev dùng **MinIO** (docker-compose, bucket `blog-media` public-read), prod **Cloudflare R2** — chỉ đổi env `STORAGE_*`. Upload theo **presigned PUT** (client upload thẳng, không qua core).
- Editor chọn qua `VITE_EDITOR=tiptap|lexical` (mặc định tiptap). Thêm editor mới = implement `PostEditorProps` + thêm nhánh trong `EditorSwitch`.

**Stack core đã chốt khi code (khác đề xuất ban đầu trong analysis doc):**
- Backend `services/core`: **Gin + GORM + Atlas** (analysis doc gợi ý chi + sqlc; đã chọn Gin/GORM/Atlas — xem spec Slice 1). Kiến trúc mỗi module: **Clean-lite / Hexagonal** (domain → service → repository → handler).
- Auth: **Google OAuth (`golang.org/x/oauth2`) + session server-side qua `alexedwards/scs` (Postgres store)**; allowlist email + cookie SameSite/Secure cấu hình qua env (xem `.env.example`).
- DB dev: Postgres 16 + pgvector qua `docker-compose.yml` ở gốc repo.

**Chạy & test core:** xem `services/core/README.md` (quickstart, Atlas migration, test).
Tóm tắt nhanh: `docker compose up -d` → `cd services/core && ./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"` → `cp .env.example .env && go run ./cmd/api` (server `:8080`, `GET /healthz`).

## Quy ước làm việc

- **Tài liệu:** file `.md` là source of truth. Mỗi lần thay đổi yêu cầu → sửa `.md` trước, rồi HỎI trước khi cập nhật bản `.html`/Artifact.
- **Quy trình dev:** mỗi slice đi qua brainstorm → spec (`docs/superpowers/specs/`) → TDD → verify end-to-end → commit.
