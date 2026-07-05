# ultimate-website

Dự án website blog cá nhân (FE + BE + AI). Xây dựng mới từ đầu.

## Bối cảnh & thiết kế

Tài liệu phân tích kiến trúc, stack, chi phí và roadmap đầy đủ nằm ở:
**`docs/personal-blog-ai-analysis.md`** (đọc file này trước khi bắt đầu bất kỳ việc gì).

Tóm tắt định hướng đã chốt:
- Mục tiêu: cân bằng học + sản phẩm dùng thật. Ngân sách ~15–40 USD/tháng.
- Kiến trúc: **KHÔNG microservice thật** → Modular Monolith (Go) + 1 AI worker (Python/LangChain) tách riêng.
- FE công khai (blog): **Next.js (App Router)** + Tailwind + shadcn/ui (SSR/SSG cho SEO).
- FE admin (dashboard): **React SPA — Vite + React + React Router** (KHÔNG dùng Next.js). Auth: **Google OAuth qua Go core theo BFF pattern** (Go đổi code → session cookie httpOnly) + allowlist email. Dùng chung `packages/ui` + `packages/types` với app web.
- Editor: Tiptap (hoặc Novel) — nằm trong app admin.
- Storage ảnh: Cloudflare R2 (presigned URL). DB: Postgres + pgvector.
- Monorepo: pnpm workspaces + Turborepo.
- AI: chatbot RAG, research + tự viết bài duyệt qua Telegram (human-in-the-loop), trợ lý viết.
- Roadmap 6 phase (0 → 5); bắt đầu từ Phase 0 (nền móng) + Phase 1 (blog cơ bản).

## Trạng thái hiện tại

Triển khai Phase 1 theo **4 slice tuần tự** (spec từng slice ở `docs/superpowers/specs/`).

- ✅ **Slice 1 — DONE**: nền móng Go core + module `posts` (CRUD + tags), chạy end-to-end.
  Spec: `docs/superpowers/specs/2026-07-05-slice1-posts-foundation-design.md`.
- ⏳ Slice 2: auth Google OAuth (BFF) + middleware bọc endpoint ghi (hiện đang mở, đánh dấu `TODO(slice-2)` trong code).
- ⏳ Slice 3: module `media` (presigned R2/MinIO) + `apps/admin` (Vite SPA + Tiptap).
- ⏳ Slice 4: `apps/web` (Next.js) public.

**Stack core đã chốt khi code (khác đề xuất ban đầu trong analysis doc):**
- Backend `services/core`: **Gin + GORM + Atlas** (analysis doc gợi ý chi + sqlc; đã chọn Gin/GORM/Atlas — xem spec Slice 1). Kiến trúc mỗi module: **Clean-lite / Hexagonal** (domain → service → repository → handler).
- DB dev: Postgres 16 + pgvector qua `docker-compose.yml` ở gốc repo.

**Chạy & test core:** xem `services/core/README.md` (quickstart, Atlas migration, test).
Tóm tắt nhanh: `docker compose up -d` → `cd services/core && ./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"` → `cp .env.example .env && go run ./cmd/api` (server `:8080`, `GET /healthz`).

## Quy ước làm việc

- **Tài liệu:** file `.md` là source of truth. Mỗi lần thay đổi yêu cầu → sửa `.md` trước, rồi HỎI trước khi cập nhật bản `.html`/Artifact.
- **Quy trình dev:** mỗi slice đi qua brainstorm → spec (`docs/superpowers/specs/`) → TDD → verify end-to-end → commit.
