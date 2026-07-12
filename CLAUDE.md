# ultimate-website

Dự án website blog cá nhân (FE + BE + AI). Xây dựng mới từ đầu.

## Bối cảnh & thiết kế

Tài liệu phân tích kiến trúc, stack, chi phí và roadmap đầy đủ nằm ở:
**`docs/personal-blog-ai-analysis.md`** (đọc file này trước khi bắt đầu bất kỳ việc gì).
Bản xem đẹp (Artifact, UTF-8, sáng/tối): `https://claude.ai/code/artifact/8104b3d2-efe4-4736-8f9f-8587e71253fe`
(`docs/personal-blog-ai-analysis.html` là **fragment kiểu Artifact** — mở raw sẽ lỗi font; publish qua Artifact mới đúng.)

**Kiến trúc vận hành thực tế** (sơ đồ, luồng BE↔FE, cache từng tầng, AI tương lai): **`docs/architecture.md`** · Artifact: `https://claude.ai/code/artifact/52ff8b32-c745-43be-a23e-d3b1717fa57d`.

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

> **🩺 Issue tracker (2026-07-11):** Senior code review toàn codebase (Go core B+, admin B+, web B) — findings đầy đủ ở **`docs/reviews/2026-07-11-senior-code-review.md`**. Đây là **nơi note & track mọi issue**: khi resolve issue nào phải đánh dấu `✅ RESOLVED (ngày, commit)` ngay tại finding đó trong file; issue mới phát hiện cũng note vào đây. **Slice 5a DONE: C1, H1, H4, A1, A4, M7. Slice 5b DONE: W1, W2, H2, H3, A2, A3 (+M6, L7). Slice 5c DONE: W3, W4, W5, W6, W7 + low SEO + next/font + A5–A9 + admin low. Slice 5d DONE: M1, M2, M3, M4, M5 + outbox (chuẩn bị Phase 2). Slice 5e DONE: L8, L9, L10, L11, L12.** Toàn bộ finding Critical/High/Medium/Low đã **yêu cầu** resolve đều DONE; backlog Low còn mở chỉ còn **L1–L6** (chưa được yêu cầu ưu tiên, note sẵn trong tracker chờ khi cần).
>
> **📍 Điểm hiện tại (2026-07-12):** **Phase 1 HOÀN TẤT** (Slice 1→4) + **Slice 5a + 5b + 5c + 5d + 5e DONE** — toàn bộ issue Critical/High/Medium từ senior review đã resolved, và backlog Low đợt đầu (L8–L12) cũng đã dọn xong; core giờ có body limit, allowlist recheck, optimistic locking end-to-end, **transactional outbox** sẵn cho Phase 2, và hết các nợ kỹ thuật nhỏ (presign config, message lỗi generic, orphan-tag cleanup, config fail-fast, test DB cách li). Chỉ còn **L1–L6** (low, chưa được yêu cầu) ở backlog. Blog verify live; storage R2 (dev=MinIO/prod=R2). **Bước kế tiếp CHƯA chốt** — **Deploy production** *hoặc* **Phase 2 (AI: chatbot RAG + AI worker consume outbox)**; khi chốt → brainstorm → spec. Roadmap: Artifact "Status & Roadmap" (`https://claude.ai/code/artifact/78ac518f-fc25-44d0-9385-d85dfbfde92e`).

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
- ✅ **Slice 4 — DONE**: `packages/ui` (`@ultimate/ui`) chung — shadcn + theme, `apps/admin` đã migrate sang dùng chung; `apps/web` — Next.js 14 (App Router, React 18, Tailwind v3) blog công khai: trang chủ (danh sách + phân trang), `/blog/[slug]`, `/tags`, `/tags/[slug]`; SSG + ISR (`revalidate = 60`); luôn ép `status=PUBLISHED` và `notFound()` cho bài non-PUBLISHED (kể cả biết slug DRAFT); SEO đầy đủ — metadata/OG mỗi bài, `sitemap.xml`, `/rss.xml`, `robots.txt`. 19 test web + 30 test admin xanh; build @ultimate/ui (typecheck) + admin + web xanh. **Verify E2E live DONE**: chạy core + web thật với dữ liệu seed — trang chủ/list, `/blog/[slug]`, draft → 404, `/tags/[slug]`, sitemap/rss/robots đều OK; `generateStaticParams` prerender đúng slug PUBLISHED.
  Spec: `docs/superpowers/specs/2026-07-10-slice4-web-public-blog-design.md`.
- ✅ **Slice 5a — DONE (Security & Data-loss Hardening, đợt 1)**: core visibility policy session-aware (anonymous chỉ thấy PUBLISHED ở list/detail/tags, `GetBySlug` 404 bài non-published, `/posts/stats*` sau `RequireAuth` — C1, M7); presign ký `Content-Length` enforce 5MB (H1); middleware `jsonmw.RequireJSON` chặn CSRF simple-request + config fail-fast `samesite=none⇒secure` (H4, L11 một phần); admin form hết bị background refetch ghi đè + `contentJson` dùng ref (A1, A4). Verify curl E2E + toàn bộ test core/admin xanh + security-review.
  Spec: `docs/superpowers/specs/2026-07-11-slice5a-security-hardening-design.md` · Plan: `docs/superpowers/plans/2026-07-11-slice5a-security-hardening.md`.
- ✅ **Slice 5b — DONE (Production-readiness Hardening, đợt 2)**: web path-based pagination `/page/[n]` + `/tags/[slug]/page/[n]` (component chung `PostsPage`, soft-404) khôi phục SSG+ISR thật — verify production `next build && next start` `/` vs `/page/2` khác nhau (W1, W2); core `http.Server` timeouts + graceful shutdown + pool DB + `/healthz` ping DB (H2, M6, L7); middleware `reqlog` (request ID + contextual slog, ghi lỗi 500) (H3); admin `beforeLoad`/`QueryCache.onError` chỉ redirect khi 401, giữ vị trí sau login qua `sessionStorage` + open-redirect guard (A2, A3). Test web/core/admin xanh + security-review sạch.
  Spec: `docs/superpowers/specs/2026-07-11-slice5b-prod-readiness-design.md` · Plan: `docs/superpowers/plans/2026-07-11-slice5b-prod-readiness.md`.
- ✅ **Slice 5c — DONE (Polish FE, đợt 3 nhóm A)**: web SEO đầy đủ — sitemap/rss để throw (ISR giữ bản tốt cuối) (W3); metadata tag pages + JSON-LD `BlogPosting` + OG image fallback + RSS `atom:link`/language/lastBuildDate (W4, W5, low); `not-found.tsx` + `error.tsx` branded (W6); sanitize `content_html` server-side (rehype-sanitize, RSC) + CSP header không-nonce (giữ SSG) + `nosniff`/`Referrer-Policy` + gate media host (W7); migrate `next/font` (Lora+Inter) + chuẩn hoá weight. Admin TS tightening: tagKeys ownership + invalidate tags (A5), `TableMeta.onDelete?` (A6), `PostStatus` union end-to-end (A7), AbortSignal (A8), signout order (A9), + low (PostId brand, apiClient 204-throw/`ApiErrorBody` rename, toast `role=alert`, `aria-sort`, clamp page, Topbar link). Verify production `next build && next start`: routes static + CSP header + `<script>` bị sanitize; test web 28 + admin 37 + ui 3 xanh; security-review sạch.
  Spec: `docs/superpowers/specs/2026-07-11-slice5c-polish-fe-design.md` · Plan: `docs/superpowers/plans/2026-07-11-slice5c-polish-fe.md`.
- ✅ **Slice 5d — DONE (Backend Robustness, đợt 4)**: core resolve toàn bộ Medium — body limit `shared/bodylimit` (`MAX_BODY_BYTES` 2 MiB → 413 `PAYLOAD_TOO_LARGE`) (M4); `RequireAuth(sm, allowlist)` re-check allowlist mỗi request + destroy session khi email bị gỡ (M2); stats routes dời sang `GET /stats/posts*` — hết shadowing slug, admin đổi URL cùng commit (M3); tag upsert batch `ON CONFLICT (slug) DO UPDATE` atomic + `translateErr` scope về post (M1); **optimistic locking end-to-end** — cột `posts.version`, PUT bắt buộc `version`, conflict → 409 `VERSION_CONFLICT`, admin banner "Bài đã bị sửa ở nơi khác" + nút "Tải bản mới nhất" (M5). **Transactional outbox** (`platform/outbox`): bảng + ghi event `post.created/updated/deleted` cùng transaction với write, `Dispatcher` poll 10s + `LogHandler` pluggable (Phase 2 cắm consumer thật). 2 migration Atlas (`add_post_version`, `add_outbox`). Test admin 39 + web 28 + core xanh; security-review sạch; verify E2E (dispatcher verified live qua synthetic event).
  Spec: `docs/superpowers/specs/2026-07-12-slice5d-backend-robustness-design.md` · Plan: `docs/superpowers/plans/2026-07-12-slice5d-backend-robustness.md`.
- ✅ **Slice 5e — DONE (Dọn backlog Low)**: `NewS3Storage` trả interface `Storage` + `PresignExpires` cấu hình qua env (L8); lỗi bind JSON trả message generic cho client, chi tiết chỉ vào log — hết leak internals Go (L9); dọn orphan tags trong cùng transaction ngay sau update/delete post, scope theo đúng tag vừa gỡ (không quét/khoá toàn bảng) (L10); `getBoolEnv`/`getInt64Env` trả `error`, `Load` fail-fast khi env rác — verify live `SESSION_COOKIE_SECURE=ture` panic ngay khi start (L11, giờ RESOLVED đầy đủ); DB test riêng `blog_test` tự tạo qua `postgres-init` cách li khỏi dev DB + test đếm theo delta/token + dispatcher-test scope theo event id (L12). Toàn bộ finding Critical/High/Medium/Low **đã được yêu cầu** trong senior review giờ DONE; còn mở L1–L6 (low, chưa yêu cầu). Test core toàn bộ xanh (`go test ./...` với `blog_test`).
  Spec: `docs/superpowers/specs/2026-07-12-slice5e-low-backlog-design.md` · Plan: `docs/superpowers/plans/2026-07-12-slice5e-low-backlog.md`.

**Storage & editor (từ 3c):**
- Object storage S3-compatible, upload theo **presigned PUT** (client upload thẳng, không qua core). **Quy ước chốt: DEV = MinIO, PROD = Cloudflare R2** — chỉ đổi env `STORAGE_*`, không sửa code. `.env` mặc định trỏ MinIO; khối R2 để comment (flip khi cần). **R2 đã verify end-to-end** (credential/CORS/public URL + upload ảnh qua admin OK). Thiết lập R2 (Account API Token, endpoint, public URL, **CORS bắt buộc** cho origin admin): xem `services/core/README.md` mục "Object storage". Web cần `NEXT_PUBLIC_MEDIA_HOST` cho `next/image`.
- `r2.dev` chỉ dùng dev (rate-limited); production nên gắn **Custom Domain** cho bucket mới có CDN cache/WAF thật.
- Editor chọn qua `VITE_EDITOR=tiptap|lexical` (mặc định **tiptap**). Thêm editor mới = implement `PostEditorProps` + thêm nhánh trong `EditorSwitch`.

**Stack core đã chốt khi code (khác đề xuất ban đầu trong analysis doc):**
- Backend `services/core`: **Gin + GORM + Atlas** (analysis doc gợi ý chi + sqlc; đã chọn Gin/GORM/Atlas — xem spec Slice 1). Kiến trúc mỗi module: **Clean-lite / Hexagonal** (domain → service → repository → handler).
- Auth: **Google OAuth (`golang.org/x/oauth2`) + session server-side qua `alexedwards/scs` (Postgres store)**; allowlist email + cookie SameSite/Secure cấu hình qua env (xem `.env.example`).
- DB dev: Postgres 16 + pgvector qua `docker-compose.yml` ở gốc repo.

**Chạy toàn bộ stack (Docker → core → web → admin):** xem **`README.md`** ở gốc repo (thứ tự khởi động, cổng/URL, lỗi hay gặp).
**Chạy & test core riêng:** xem `services/core/README.md` (quickstart, Atlas migration, test).
Tóm tắt nhanh: `docker compose up -d` → `cd services/core && ./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"` → `cp .env.example .env && go run ./cmd/api` (server `:8080`, `GET /healthz`) → `pnpm --filter @ultimate/web dev` (`:3000`) + `pnpm --filter @ultimate/admin dev` (`:5173`).

## Quy ước làm việc

- **Tài liệu:** file `.md` là source of truth. Mỗi lần thay đổi yêu cầu → sửa `.md` trước, rồi HỎI trước khi cập nhật bản `.html`/Artifact.
- **Quy trình dev:** mỗi slice đi qua brainstorm → spec (`docs/superpowers/specs/`) → TDD → verify end-to-end → commit.
- **Cập nhật tiến độ:** sau mỗi slice/milestone → cập nhật mục **"Trạng thái hiện tại"** + dòng **"📍 Điểm hiện tại"** trong `CLAUDE.md` (để phiên làm việc mới nắm ngay context — dự án thường đổi session).
- **Issue tracking:** mọi issue/finding note vào **`docs/reviews/2026-07-11-senior-code-review.md`** (issue mới → thêm vào mục tương ứng theo mảng + severity, đặt mã mới nối tiếp C/H/M/L, A, W). Khi resolve issue nào → đánh dấu **`✅ RESOLVED (YYYY-MM-DD, commit <hash>)`** ngay tại finding đó (không xoá nội dung finding).
