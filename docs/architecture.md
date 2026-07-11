# Kiến trúc & Vận hành — ultimate-website

> Cập nhật: 2026-07-11 · Phản ánh **đúng những gì codebase đang có và cách nó thực sự chạy** (sau Phase 1 + hardening 5a/5b/5c).
> Bản xem đẹp (Artifact, sáng/tối, sơ đồ): `https://claude.ai/code/artifact/52ff8b32-c745-43be-a23e-d3b1717fa57d`
> Tài liệu định hướng/đánh giá gốc: `docs/personal-blog-ai-analysis.md`. Tiến độ + issue tracker: `CLAUDE.md`, `docs/reviews/2026-07-11-senior-code-review.md`.
> Phần **AI (Phase 2)** là **kế hoạch — CHƯA xây**, được đánh dấu rõ ở §9.

---

## 1. Tổng quan

Monorepo (pnpm workspaces + Turborepo). **Modular Monolith** cho backend (Go) + 2 app FE tách biệt, chia sẻ `packages/types` (hợp đồng API) và `packages/ui` (design system).

```
ultimate-website/
├── services/core/        # Go (Gin + GORM + Atlas) — API monolith module hoá
├── apps/web/             # Next.js 14 App Router — blog công khai (SSG/ISR, SEO)
├── apps/admin/           # Vite + React SPA — dashboard quản trị (TanStack Router/Query/Table)
├── packages/types/       # Zod schema = single source of truth + branded IDs
├── packages/ui/          # shadcn/ui + theme HiveQ (dùng chung web + admin)
└── docker-compose.yml    # Postgres(+pgvector) + MinIO (dev)
```

| Thành phần | Stack | Vai trò | Cổng (dev) |
|---|---|---|---|
| **core** | Go, Gin, GORM, Atlas, scs | REST API, auth BFF, presign upload | `:8080` |
| **web** | Next.js 14, React 18, Tailwind v3 | Blog công khai, SSR/SSG cho SEO | `:3000` |
| **admin** | Vite, React, TanStack (Router/Query/Table) | Soạn/quản lý bài (đăng nhập) | `:5173` |
| **Postgres** | Postgres 16 + pgvector | DB chính + session store | `:5432` |
| **MinIO** | S3-compatible | Object storage ảnh (dev; prod = R2) | `:9000` |

---

## 2. Sơ đồ kiến trúc tổng thể

```
                        ┌──────────────────────────────────────────────┐
   Người đọc (public)   │                                              │
   ───────────────────► │   apps/web  (Next.js SSG/ISR)  :3000          │
                        │   • RSC fetch → Data Cache (revalidate 60s)   │
                        │   • path-based pagination /page/[n]           │
                        │   • sanitize HTML + CSP header                │
                        └───────────────┬──────────────────────────────┘
                                         │ GET /api/v1/posts, /posts/:slug, /tags
                                         │ (ép status=PUBLISHED)
                                         ▼
   Admin (đăng nhập)     ┌──────────────────────────────────────────────┐
   ───────────────────► │   services/core (Go monolith)  :8080          │
   apps/admin :5173      │                                              │
   • cookie session      │   Middleware: Recovery → reqlog → CORS        │
     (credentials:       │              → [RequireJSON → RequireAuth]    │  ← chỉ route ghi
      include)           │   Modules:  posts │ auth │ media              │
   • TanStack Query      │   Layers:   handler → service → repository    │
                        │   Session:  scs + Postgres (cookie httpOnly)  │
                        └───────┬───────────────────────┬───────────────┘
                                 │ GORM                   │ presigned PUT URL
                                 ▼                        ▼ (client upload thẳng)
                        ┌─────────────────┐      ┌─────────────────────────┐
                        │ Postgres 16     │      │ MinIO (dev) / R2 (prod) │
                        │ + pgvector      │      │ ảnh bài viết            │
                        │ posts,tags,     │      └─────────────────────────┘
                        │ post_tags,      │
                        │ sessions        │
                        └─────────────────┘

   (Phase 2 — CHƯA xây)  AI worker (Python/LangGraph) ── đọc/ghi qua core API + pgvector
```

Điểm mấu chốt: **web và admin KHÔNG gọi thẳng DB** — mọi truy cập qua core API. Ảnh **không đi qua core** khi upload (client PUT thẳng lên storage bằng presigned URL do core ký).

---

## 3. Backend core (`services/core`)

### 3.1. Kiến trúc phân tầng (Clean-lite / Hexagonal)

Mỗi module (`posts`, `auth`, `media`) tự chứa 4 tầng; phụ thuộc hướng vào trong (service định nghĩa **interface** repository/port, không biết cài đặt cụ thể):

```
handler.go      transport (Gin) — parse request, gọi service, map lỗi → HTTP
   │  (đọc session để biết authed; KHÔNG chứa business logic)
   ▼
service.go      business logic thuần — validate, chính sách visibility, slug, publish
   │  (phụ thuộc interface Repository/Storage — không import GORM/S3)
   ▼
repository.go   data access (GORM/Postgres)   |   storage_s3.go (aws-sdk-go-v2)
domain.go       entity thuần (Post, Tag, PostStatus) + lỗi domain (errors.Is)
```

- `posts`: interface `Repository` khai báo trong `service.go`; impl `GormRepository`. GORM/Gin **không rò rỉ** qua tầng service/domain.
- `auth`: port `OAuthProvider` (impl `GoogleProvider` — PKCE + đọc id_token); `Allowlist` (email từ env); `IsAuthenticated(sm)` — checker để module khác (posts) biết request đã đăng nhập chưa **mà không import auth**.
- `media`: port `Storage` (`PresignPut(ctx,key,ct,size)` + `PublicURL`); impl `s3Storage`.

Tầng `platform/` (config, database, logger, session) + `shared/` (corsmw, jsonmw, reqlog, httperr, pagination) là hạ tầng dùng chung.

### 3.2. Vòng đời một request

```
HTTP → gin.Recovery()                    (chống panic → 500)
     → reqlog.Middleware(log)            (sinh/đọc X-Request-ID, gắn *slog.Logger vào ctx,
                                          log completion: method/path/status/latency)
     → corsmw.New(origins)               (CORS allowlist + credentials cho admin)
     → [route công khai]  hoặc  [group ghi: jsonmw.RequireJSON → auth.RequireAuth]
     → handler → service → repository
     → respondError: 4xx map domain error; 500 ghi raw err kèm request_id
  (toàn engine bọc scs.LoadAndSave → nạp/lưu session mỗi request)
```

- **`reqlog`**: mọi response có header `X-Request-ID`; log dòng completion; lỗi 500 ghi `err` thật (trước đây bị nuốt im lặng — H3).
- **`jsonmw.RequireJSON`**: route ghi (POST/PUT/PATCH) bắt buộc `Content-Type: application/json` → 415 nếu khác. Biến request ghi thành *non-simple* → CORS preflight chặn CSRF simple-request (H4).
- **`auth.RequireAuth`**: chặn nếu session không có `admin_email` → 401.

### 3.3. Auth — Google OAuth theo BFF pattern

SPA **không bao giờ giữ token**. Core là OAuth client, đổi code, chỉ trả cookie session `httpOnly`:

```
admin → GET /auth/google/login → core sinh state + PKCE (S256), lưu session → 302 tới Google
Google → GET /auth/google/callback?code&state → core:
   • verify state (chống CSRF)
   • đổi code → id_token (PKCE), đọc email + email_verified
   • kiểm ALLOWLIST email → không thì 403, không tạo session
   • RenewToken (chống session fixation) → lưu admin_email vào session
   • set cookie: sid=…; HttpOnly; Secure(theo env); SameSite(theo env); Path=/
admin → mọi request kèm credentials:'include' → core middleware xác thực session
```

- Session server-side: **scs + Postgres store** (bảng `sessions`, Atlas quản lý), lifetime 7 ngày.
- Config fail-fast: `SESSION_COOKIE_SAMESITE=none` mà không `Secure` → core từ chối khởi động (L11).

### 3.4. Visibility policy (trust boundary ở API — C1/M7)

Handler đọc checker `authed = auth.IsAuthenticated(sm)(ctx)` rồi truyền `bool` xuống service:

| Endpoint | Anonymous | Đã đăng nhập |
|---|---|---|
| `GET /posts` | ép `status=PUBLISHED` (bất kể query) | thấy mọi status |
| `GET /posts/:slug` | non-PUBLISHED → **404** (không lộ tồn tại) | thấy mọi status |
| `GET /tags` | chỉ tag gắn ≥1 bài PUBLISHED (JOIN) | mọi tag |
| `GET /posts/stats`, `/stats/timeseries` | **401** (sau RequireAuth) | ok |
| `POST/PUT/DELETE /posts`, `POST /media/presign` | **401** | ok |

Web vẫn lọc PUBLISHED client-side làm belt-and-braces, nhưng **API mới là ranh giới tin cậy**.

### 3.5. Media — presigned upload

```
admin → POST /media/presign {filename, content_type, size}  (sau RequireAuth)
core  → validate type (png/jpeg/webp/gif) + size ≤ 5MB
      → sinh key uploads/<yyyy>/<mm>/<uuid>.<ext>
      → ký presigned PUT (Content-Type + Content-Length đều signed) → trả {upload_url, public_url}
admin → PUT ảnh TRỰC TIẾP lên MinIO/R2 (không qua core) — sai size bị storage từ chối 403 (H1)
admin → lưu public_url vào nội dung bài
```

### 3.6. DB, migration, observability, shutdown

- **GORM** + Postgres; **Atlas** quản lý migration (versioned, `migrations/`). Pool: MaxOpen 10 / MaxIdle 5 / ConnMaxLifetime 30m (M6).
- **`/healthz`**: ping DB (timeout 2s) → 503 nếu DB chết (L7).
- **Graceful shutdown**: `http.Server` có timeouts (ReadHeader 5s / Read 10s / Write 15s / Idle 60s) + `signal.NotifyContext` → `srv.Shutdown(10s)` → `sqlDB.Close()` (H2).
- Log: `log/slog` (JSON ở production). Chưa có OpenTelemetry/metrics (Phase "Observability" tương lai).

---

## 4. Hợp đồng API (contract)

Envelope lỗi thống nhất: `{ "error": { "code": string, "message": string } }` (interface `ApiErrorBody` trong `packages/types`).

| Method | Path | Auth | Trả về |
|---|---|---|---|
| GET | `/healthz` | – | `{status}` (503 nếu DB down) |
| GET | `/auth/google/login` → callback | – | 302 (OAuth flow) |
| POST | `/auth/logout` | session | 204 |
| GET | `/auth/me` | session | admin user (401 nếu chưa login) |
| GET | `/api/v1/posts?page&page_size&status&tag&q&sort&order` | public* | `{data[], page, page_size, total}` |
| GET | `/api/v1/posts/:slug` | public* | `Post` (404 nếu non-PUBLISHED & anonymous) |
| GET | `/api/v1/tags` | public* | `{data[]}` |
| GET | `/api/v1/posts/stats`, `/stats/timeseries?months` | session | thống kê dashboard |
| POST | `/api/v1/posts` | session + JSON | `Post` (201) |
| PUT | `/api/v1/posts/:id` | session + JSON | `Post` |
| DELETE | `/api/v1/posts/:id` | session | 204 |
| POST | `/api/v1/media/presign` | session + JSON | `{upload_url, public_url, key, expires_in}` |

(*) public nhưng **visibility policy** ép PUBLISHED cho anonymous (xem §3.4).

`Post` gồm: `id` (UUID branded `PostId`), `title`, `slug`, `content_json` (Tiptap/Lexical native — source), `content_html` (render sẵn cho SEO), `excerpt`, `cover_image`, `status` (DRAFT|PENDING_APPROVAL|PUBLISHED), `meta_title/desc`, `published_at`, `tags[]`, `created_at/updated_at`.

---

## 5. FE web (`apps/web`) — Next.js App Router

### 5.1. Mô hình render (đã verify bằng `next build`)

| Route | Chế độ | Ghi chú |
|---|---|---|
| `/` | **Static (○)** | trang 1, param-less |
| `/page/[n]` | **SSG (●)** | `generateStaticParams` từ `totalPages` |
| `/blog/[slug]` | **SSG (●)** | `generateStaticParams` slug PUBLISHED + ISR on-demand (`dynamicParams`) |
| `/tags`, `/tags/[slug]`, `/tags/[slug]/page/[n]` | **Static/SSG** | metadata + pagination theo path |
| `sitemap.xml`, `rss.xml`, `robots.txt` | Static | để lỗi throw → ISR giữ bản tốt cuối |

**Pagination bằng path segment** (`/page/[n]`, không phải `?page=`) — vì Next cache route tĩnh theo **pathname**; query-string sẽ trả sai trang ở production (bug W1/W2 đã fix ở 5b).

### 5.2. Data fetching + cache

- Toàn bộ là **React Server Components**; fetch qua `fetch(url, { next: { revalidate: 60 } })` → **Next Data Cache** per-URL, ISR 60s. Không có client-side data cache (client component tối thiểu: `ReadingProgress`, `error.tsx`).
- Boundary type-safe: parse response bằng **Zod** (`@ultimate/types`) tại `features/posts/api.ts` — `PostListResponseSchema`, `PostSchema`.
- `listPublished` LUÔN set `status=PUBLISHED`; `getPublishedBySlug` trả `null` (→ `notFound()`) nếu status ≠ PUBLISHED (belt-and-braces trên visibility của core).

### 5.3. SEO + bảo mật

- Metadata/OpenGraph mỗi bài (`generateMetadata`), OG image fallback, canonical; metadata cho tag pages; **JSON-LD `BlogPosting`** (escape `<` chống breakout); `sitemap.xml` + `/rss.xml` (atom self-link, language, lastBuildDate, escape URL) + `robots.txt`.
- `not-found.tsx` + `error.tsx` branded.
- **Sanitize**: `content_html` chạy qua `rehype-sanitize` server-side (RSC) trước `dangerouslySetInnerHTML` — allowlist mở cho output editor (table, task-list, `<mark>`, img, code), chặn `<script>`/`on*`/`javascript:`.
- **CSP** header qua `next.config` `headers()` (không nonce → giữ SSG): `default-src 'self'; script-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' data: <media-host>` + `nosniff` + `Referrer-Policy`.
- Font qua `next/font/google` (Lora + Inter) — preload, không FOUT.

---

## 6. FE admin (`apps/admin`) — React SPA

### 6.1. Routing + data

- **TanStack Router** file-based (`src/routes/`, `routeTree.gen.ts` sinh tự động), search params type-safe qua `validateSearch` (Zod). Route `_authed` bọc guard.
- **TanStack Query** là data cache client:
  - `staleTime` mặc định 30s, `retry: 1`, `refetchOnWindowFocus: false`; auth query `staleTime` 5 phút.
  - List dùng `keepPreviousData` (không nháy khi phân trang).
  - Route loader `ensureQueryData` prefetch (render-as-you-fetch); component đọc lại qua `useSuspenseQuery` — **cùng `queryOptions`** → chia sẻ cache, không double-fetch.
  - Query keys tập trung (`postKeys`, `tagKeys`); mutation invalidate `postKeys.all` + `tagKeys.all`.
- `apiClient.apiFetch` gọi core với `credentials:'include'`, **validate response bằng Zod** (schema) → `ApiSchemaError` nếu lệch hợp đồng; forward `AbortSignal` từ Query (huỷ request cũ khi filter đổi).

### 6.2. Auth 401-aware (A2/A3)

- Guard `_authed.beforeLoad`: chỉ redirect `/login` khi `ApiError.status === 401`; lỗi khác (API sập/500) → rethrow cho error boundary (không giả vờ "chưa đăng nhập").
- Session hết hạn giữa chừng: `QueryCache`/`MutationCache` `onError` bắt 401 → về `/login`; **giữ vị trí** qua `sessionStorage` (sống sót vòng full-page OAuth redirect), consume lại sau khi đăng nhập; guard open-redirect (`isInternalPath` chặn `//`, backslash, control char).

### 6.3. Soạn bài + editor

- Form: `react-hook-form` + `zodResolver`. Prefill **hydrate 1 lần** (`hasHydratedRef`) — background refetch không ghi đè nội dung đang gõ (A1). `content_json` dùng `useRef` (keystroke editor không re-render form — A4).
- Editor: **Tiptap** hoặc **Lexical** sau interface chung `PostEditorProps`, chọn qua `VITE_EDITOR`, code-split (`React.lazy` — chunk editor không chọn không tải). HTML là cầu nối nạp nội dung; lưu `content_json` native best-effort.
- Ảnh: `uploadImage` xin presign từ core rồi PUT thẳng lên storage (§3.5); lỗi → toast.

---

## 7. Packages dùng chung

- **`@ultimate/types`**: Zod schema = **single source of truth**; type suy ra bằng `z.infer`. Branded IDs (`PostId`, `TagId`) chống lẫn. `ts-reset` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`. **Lưu ý:** schema hiện là "bản chép tay" của struct Go — chưa có codegen OpenAPI/proto (đổi field Go chỉ vỡ ở runtime qua `ApiSchemaError`, không vỡ compile-time). Đây là hạng mục "vũ khí type-safety" còn để ngỏ.
- **`@ultimate/ui`**: shadcn/ui primitives + `cn` + theme HiveQ (Tailwind preset + CSS vars). Dùng chung web + admin.

---

## 8. Chiến lược cache theo tầng (tóm tắt)

| Tầng | Cache gì | Cơ chế | TTL/Invalidation |
|---|---|---|---|
| Web (public) | HTML trang + dữ liệu fetch | Next Full Route Cache + Data Cache (ISR) | `revalidate = 60s` per-URL; rebuild on-demand |
| Web ảnh | File ảnh | CDN (R2 custom domain — prod) / `r2.dev` (dev) | CDN cache |
| Admin | Response API | TanStack Query | staleTime 30s (auth 5m); invalidate sau mutation |
| Core | – (không cache app-level) | – | mọi read xuống DB |
| Core session | Session data | scs + Postgres | lifetime 7 ngày |
| Core DB | Kết nối | pool (10 max) | ConnMaxLifetime 30m |

Không có Redis/cache layer ở core (YAGNI cho quy mô hiện tại; ISR + CDN gánh phần đọc public).

---

## 9. AI (Phase 2) — KẾ HOẠCH, CHƯA XÂY

> Toàn bộ mục này **chưa có trong codebase**. Postgres image đã kèm `pgvector` nhưng **chưa dùng**. Đây là thiết kế dự kiến để định hướng, khớp `docs/personal-blog-ai-analysis.md` §3.

**Kiến trúc dự kiến:** 1 service **AI worker riêng (Python + LangGraph + FastAPI)** — tách khỏi core vì hệ sinh thái AI mạnh ở Python + job nặng không nên block API chính. Worker đọc/ghi qua **core API** (không chọc thẳng DB nghiệp vụ), trừ pgvector cho embedding.

```
① Chatbot RAG:   bài đăng → chunk → embedding → pgvector
                 câu hỏi → embedding → similarity search → top-k → LLM trả lời kèm trích dẫn
② Auto-write:    cron 09:00 → research (Tavily) → LLM viết draft (status=PENDING_APPROVAL)
                 → Telegram inline buttons (Duyệt/Sửa/Bỏ) → HUMAN-IN-THE-LOOP
                 → duyệt → core publish (KHÔNG bao giờ tự đăng khi chưa approve)
③ Trợ lý viết:   streaming completion trong editor admin
```

**Cầu nối với hệ hiện tại:** cần **transactional outbox** (Slice 5d) — core ghi event `post.published/updated` trong cùng transaction; worker poll/LISTEN để re-index RAG → tránh index stale. `PENDING_APPROVAL` (đã có trong enum `PostStatus`) chính là trạng thái chờ duyệt cho luồng ②.

---

## 10. Hạ tầng & vận hành

- **Dev**: `docker compose up` (Postgres+pgvector, MinIO) → Atlas migrate → `go run ./cmd/api` → `pnpm --filter @ultimate/web dev` + `pnpm --filter @ultimate/admin dev`. Chi tiết: `README.md`.
- **Storage**: dev = MinIO, prod = Cloudflare R2 (chỉ đổi env `STORAGE_*`). Prod nên gắn Custom Domain cho R2 (CDN/WAF thật).
- **Prod (dự kiến, chưa deploy)**: web → Vercel/Cloudflare Pages (SSG/ISR); admin → static host (SPA fallback); core → VPS qua Coolify/Docker; CI (GitHub Actions) chưa commit.
- **Còn để ngỏ (Slice 5d + sau)**: tag `ON CONFLICT`, optimistic locking (chống lost-update khi có writer thứ 2 là AI), outbox, OpenTelemetry/metrics, contract-first codegen (OpenAPI/proto) cho type Go↔TS.
