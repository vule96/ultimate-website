# Senior Code Review — Toàn bộ codebase (Go core + Admin SPA + Web Next.js)

> Ngày: 2026-07-11 · Phạm vi: `services/core`, `apps/admin` (+ `packages/types`, `packages/ui`), `apps/web`, và đánh giá plan (`docs/personal-blog-ai-analysis.md` + `CLAUDE.md`).
> Phương pháp: 3 review agent độc lập đọc **toàn bộ** source từng mảng, chỉ báo lỗi đã verify trực tiếp trên code (kèm file:line). Web được verify thêm bằng build log (`apps/web/.turbo/turbo-build.log`) để xác định chế độ render thật.
> Trạng thái: **CHƯA fix** — file này là input cho slice hardening (xem §6).
>
> **⚠️ File này là ISSUE TRACKER của dự án (quy ước trong `CLAUDE.md`):**
> - Issue **mới** phát hiện → thêm vào mục tương ứng (theo mảng + severity), đặt mã nối tiếp (C/H/M/L cho core, A cho admin, W cho web).
> - Issue đã fix → đánh dấu **`✅ RESOLVED (YYYY-MM-DD, commit <hash>)`** ngay đầu finding đó — **không xoá** nội dung finding.
> - Finding chưa có đánh dấu = còn mở.

---

## 0. TL;DR

| Mảng | Điểm | Nhận xét 1 dòng |
|---|---|---|
| Tổng thể | **B+** | Kiến trúc & kỷ luật layer/type tốt hơn mặt bằng chung rõ rệt; vấn đề nằm ở **các đường biên chưa siết** (trust boundary API, error-path auth, render mode thật của Next). |
| Go core | **B+** | Hexagonal chuẩn, OAuth/transaction/whitelist đúng; **1 critical** (leak DRAFT qua API public) + thiếu production hygiene (shutdown, timeout, logging). |
| Admin SPA | **B+** | Query/router/code-split textbook; lỗi dồn ở auth error-path và form (**bug mất dữ liệu khi background refetch**), vài chỗ TS "hở". |
| Web Next.js | **B → A- (sau 5b+5c)** | Đã fix pagination SSG (W1/W2), SEO đầy đủ (metadata/JSON-LD/OG/RSS), sanitize + CSP, `next/font`. |

**3 việc phải làm trước mọi thứ:** ✅ (1) visibility policy ở core (chặn leak DRAFT) + ✅ (2) fix prefill clobbering ở PostFormPage (mất dữ liệu) + ✅ (3) path-based pagination ở web (W1) — **tất cả DONE (Slice 5a + 5b, 2026-07-11)**.

> **✅ Slice 5a — Security & Data-loss (đợt 1) HOÀN TẤT (2026-07-11).** Resolved: C1, H1, H4, A1, A4, M7 (+ L11 một phần). Spec/plan: `...slice5a-security-hardening...`.
>
> **✅ Slice 5b — Production-readiness (đợt 2) HOÀN TẤT (2026-07-11).** Resolved: W1, W2, H2, H3, A2, A3 (+ M6, L7).
>
> **✅ Slice 5c — Polish FE (đợt 3, nhóm A) HOÀN TẤT (2026-07-11).** Resolved: W3, W4, W5, W6, W7 + low SEO (OG fallback, RSS enrich, cover sizes, next.config gate) + font `next/font` + A5, A6, A7, A8, A9 + admin low (tagKeys, PostId, apiClient 204/rename, toast role, aria-sort, clamp page, Topbar link). Spec/plan `...slice5c-polish-fe...`. Còn mở → **Slice 5d (nhóm B, backend robustness):** M1–M5 core (tag ON CONFLICT, session allowlist recheck, route shadowing, body-size limit, optimistic locking) + outbox (chuẩn bị Phase 2). Vài micro-opt/defer: reading-progress rAF, slim list endpoint, `_authed.index` void-catch, Lexical toolbar active state, media orphan cleanup.

---

## 1. Đánh giá plan (analysis doc + CLAUDE.md)

**Điểm mạnh:** quyết định KHÔNG microservice, human-in-the-loop cho AI, roadmap phân phase chống scope creep — đều đúng đắn. Điểm lệch stack (Gin/GORM/Atlas thay chi/sqlc) được document minh bạch.

**3 khoảng trống:**

1. **CI chưa tồn tại.** Analysis doc §15 mô tả pipeline đầy đủ nhưng `.github/` chưa commit. Cần trả nợ này trước khi deploy production (lint + test + build cho cả 3 target).
2. **Contract-first codegen (§16.3) chưa làm.** Zod schema ở `packages/types` hiện là "bản chép tay" của struct Go — đổi field ở Go chỉ vỡ ở runtime (`ApiSchemaError`), không vỡ compile-time như plan hứa. Nên đưa OpenAPI (swaggo) + `openapi-typescript`/orval vào **trước Phase 2** (AI worker là consumer thứ 3 của API).
3. **Phase 2 observability có nguy cơ bị nhảy cóc** — trong khi core hiện **không log lỗi 500 nào** (xem H3 bên dưới). Nếu deploy production trước Phase AI thì tối thiểu phải có request logging.

---

## 2. Go core (`services/core`) — B+

**Đã verify đúng (không cần sửa):** layer domain → service → repository → handler chuẩn, interface do consumer định nghĩa (dependency inversion đúng); GORM/Gin không rò rỉ qua layer; transaction post+tags atomic (`posts/repository.go:82-118`); rows-affected check khi delete; `Count` dùng `Distinct` chống join fan-out; OAuth có state + PKCE S256 + one-time state + `RenewToken` (chống session fixation); allowlist so sánh trim + case-fold; ORDER BY whitelist an toàn (có test); context propagate end-to-end; error envelope `{"error":{code,message}}` nhất quán; cookie flags đủ.

### 🔴 Critical

- ✅ **RESOLVED (2026-07-11, commit dda480e + f7179ba)** — visibility policy session-aware: anonymous bị ép `status=PUBLISHED` ở service, `GetBySlug` trả 404 cho bài non-published; `/posts/stats*` chuyển sau `RequireAuth`; `/tags` chỉ trả tag của bài PUBLISHED cho khách (M7). Verify curl E2E + handler tests.
- **C1 — API public lộ bài DRAFT/PENDING_APPROVAL.** `internal/modules/posts/handler.go:29-33` — `GET /posts`, `GET /posts/:slug` public, `list` pass thẳng `c.Query("status")` (`handler.go:101`), `getBySlug` trả mọi status (`handler.go:154-161`). `curl /api/v1/posts?status=DRAFT` đọc được toàn bộ `content_html` bài nháp. Web chỉ lọc client-side — API mới là trust boundary; Phase 2 draft AI chờ duyệt sẽ leak công khai.
  **Fix:** unauthenticated → ép `Status = PUBLISHED`, `GetBySlug` trả `ErrPostNotFound` cho bài non-published; biến thể unfiltered chỉ sau `RequireAuth`. Gate luôn `/posts/stats` + `/posts/stats/timeseries` (data dashboard, đang public — `handler.go:30-31`).

### 🟠 High

- ✅ **RESOLVED (2026-07-11, commit 2ad90de)** — `Storage.PresignPut` nhận `size int64`, set `ContentLength` vào `PutObjectInput` → Content-Length thành signed header; PUT sai size bị storage từ chối. Unit test assert `content-length` trong `X-Amz-SignedHeaders` + integration MinIO wrong-size bị 403.
- **H1 — Presign PUT không enforce giới hạn 5MB.** `media/service.go:34-38` validate size nhưng `storage_s3.go:53-63` chỉ ký `Bucket/Key/ContentType` — client khai `size: 1024` rồi PUT 5GB vẫn được nhận (vector lạm dụng chi phí R2). **Fix:** thêm `size` vào port `PresignPut`, set `ContentLength` để Content-Length thành signed header (hoặc presigned POST + `content-length-range`).
- ✅ **RESOLVED (2026-07-11, commit 653f426)** — `&http.Server{}` với Read/Write/Idle/ReadHeader timeouts + `signal.NotifyContext` → `srv.Shutdown(10s)` → `sqlDB.Close()`. Verify: SIGINT → log "shutting down" thoát sạch.
- **H2 — Không graceful shutdown, không timeout `http.Server`.** `cmd/api/main.go:95` — bare `ListenAndServe`: hở slowloris (không `ReadHeaderTimeout`), SIGTERM giết request giữa transaction mỗi lần deploy. **Fix:** `&http.Server{...timeouts...}` + `signal.NotifyContext` + `srv.Shutdown` + close `sqlDB`.
- ✅ **RESOLVED (2026-07-11, commit 0846e24 + 2530e76)** — package `internal/shared/reqlog`: middleware sinh/đọc `X-Request-ID` + contextual `*slog.Logger` vào context + log completion (method/path/status/latency); `respondError` posts + presign media ghi raw `err` ở nhánh 500. Verify: response có header `X-Request-ID`, completion log kèm `request_id`.
- **H3 — Lỗi 500 bị nuốt im lặng.** `posts/handler.go:253-254` (tương tự `media/handler.go:55`, `auth/handler.go:42,66,75`) — `err` bị vứt; logger tạo ở `main.go:32` không inject đi đâu; không request-logging middleware, không request ID. DB outage ở prod = chuỗi 500 với zero diagnostic. **Fix:** middleware slog (method/path/status/latency/request-ID vào context), `respondError` log raw error ở nhánh `default`.
- ✅ **RESOLVED (2026-07-11, commit 19fbb57 + 33026db)** — middleware `jsonmw.RequireJSON` áp lên write routes (POST/PUT/PATCH Content-Type ≠ `application/json` → 415, biến request ghi thành non-simple → bị preflight chặn); config fail-fast khi `samesite=none` mà không `secure`. Verify curl POST text/plain → 415.
- **H4 — CSRF khi `SameSite=none`.** Config cho phép `SESSION_COOKIE_SAMESITE=none` (`platform/session/session.go:35`); `ShouldBindJSON` parse cả body `text/plain` → cross-site form POST là *simple request* (không preflight, cookie đính kèm) → attacker tạo post / mint presign / logout admin. CORS chỉ chặn *đọc* response, không chặn *gửi*. **Fix:** reject write request có `Content-Type != application/json` (middleware `requireJSON`) hoặc custom header trong `RequireAuth`; assert startup `samesite=none ⇒ secure=true`.

### 🟡 Medium

- ✅ **M1 — Race tạo tag concurrent → 409 sai. RESOLVED (2026-07-12, commit 394d5c2).** `posts/repository.go:261-274` `FirstOrCreate` (SELECT-then-INSERT); 2 post cùng thêm tag mới → unique violation bị `translateErr` (`repository.go:330-335`) map thành `SLUG_TAKEN` của *post*. Cũng N round-trip mỗi lần save. **Fix:** `INSERT ... ON CONFLICT (slug) DO UPDATE ... RETURNING` (`clause.OnConflict`) batch; scope `translateErr` vào post insert.
- ✅ **M2 — Session không re-check allowlist. RESOLVED (2026-07-12, commit 7329576).** (`auth/middleware.go:16-25`) — bỏ email khỏi `ADMIN_ALLOWLIST` vẫn còn session sống tới 7 ngày. **Fix:** inject `*Allowlist` vào `RequireAuth`, check mỗi request, destroy session nếu fail.
- ✅ **M3 — Route shadowing. RESOLVED (2026-07-12, commit 5d8825c).** bài có slug `stats` bị `/posts/stats` che (`posts/handler.go:30-32`). **Fix:** chuyển aggregate sang `GET /stats/posts` + `/stats/posts/timeseries` (admin đổi URL cùng commit; test chống shadowing).
- ✅ **M4 — Không giới hạn body size. RESOLVED (2026-07-12, commit 80ea492).** trên write endpoints (`posts/handler.go:163-186`). **Fix:** middleware `shared/bodylimit` (`http.MaxBytesReader` global, env `MAX_BODY_BYTES` default 2 MiB) → 413 `PAYLOAD_TOO_LARGE`.
- ✅ **M5 — Lost-update trên posts. RESOLVED (2026-07-12, commits 1f8cad0 core + a43898a admin FE).** (`posts/service.go:134-180`) — GetByID rồi Update ở 2 transaction; 2 edit concurrent last-writer-wins (gồm logic `PublishedAt`). Nghiêm trọng hơn khi Phase 2 thêm writer thứ 2 (AI worker). **Fix:** optimistic locking end-to-end — cột `version` (migration `add_post_version`), UPDATE có điều kiện → 409 `VERSION_CONFLICT`; PUT bắt buộc `version`; admin FE gửi version + banner conflict + nút "Tải bản mới nhất".
- ✅ **M6 — RESOLVED (2026-07-11, commit 653f426).** `SetMaxOpenConns(10)`, `SetMaxIdleConns(5)`, `SetConnMaxLifetime(30m)`.
- **M6 — Pool DB không cấu hình** (`main.go:39-43`) — không `SetMaxOpenConns/SetConnMaxLifetime`; mọi route (kể cả blog read anonymous) đều qua `sm.LoadAndSave` chạm bảng `sessions`. **Fix:** set pool từ config; cân nhắc scope `LoadAndSave` vào `/auth` + write routes.
- ✅ **M7 — `/tags` công khai lộ tag metadata của bài DRAFT/PENDING. RESOLVED (2026-07-11, commit f7179ba).** Phát hiện khi security-review Slice 5a: `ListTags` không lọc theo status → tên/slug tag của bài nháp lộ cho khách (cùng lớp info-disclosure với C1). Fix: `ListTags(ctx, publishedOnly)` — khách chưa đăng nhập chỉ nhận tag JOIN với bài PUBLISHED. Handler test `TestHandler_AnonymousTagsOnlyFromPublished`.

### 🟢 Low (tóm tắt)

- L1: `corsmw/cors.go:28` — `Vary: Origin` nên set vô điều kiện; thêm `Access-Control-Max-Age`.
- L2: `auth/provider_google.go:64-83` — nên verify `exp/aud/iss` id_token (1 call `coreos/go-oidc`).
- L3: sort thiếu tiebreaker → pagination không ổn định khi trùng giá trị; append `, posts.id ASC` (`posts/repository.go:24-33`).
- L4: ILIKE không escape `%`/`_` (`repository.go:162`) — an toàn injection nhưng sai ngữ nghĩa search.
- L5: `media` nhận `Filename` nhưng không dùng (`media/domain.go:33`) — bỏ hoặc lưu metadata. (Key gen `uploads/yyyy/mm/uuid.ext` đã tốt.)
- L6: `main.go:29` panic vs `os.Exit(1)` không nhất quán.
- L7: `/healthz` trả 200 kể cả khi Postgres chết (`main.go:79-81`) — ping DB / tách liveness–readiness. ✅ **RESOLVED (2026-07-11, commit 653f426)** — `/healthz` ping DB (timeout 2s) → 503 nếu DB down.
- L8: `NewS3Storage` trả unexported type; `expires` 15' hardcode → đưa vào `S3Config`.
- L9: `ShouldBindJSON` `err.Error()` leak internals Go ra client (`posts/handler.go:166,196`).
- L10: tags mồ côi không bao giờ được dọn → inflate `/tags` + `Stats.Tags`.
- L11: `getBoolEnv` nuốt lỗi parse (`config.go:80-90`) — `SESSION_COOKIE_SECURE=ture` fail im lặng; nên trả error từ `Load`. ✅ **RESOLVED một phần (2026-07-11, commit 33026db)** — thêm assertion `samesite=none ⇒ secure` + normalize lowercase SameSite; phần `getBoolEnv` nuốt lỗi vẫn mở.
- L12 *(phát hiện khi làm Slice 5d, 2026-07-12)*: test integration core dùng chung dev DB (`TEST_DATABASE_URL`) — seed data thủ công (E2E/verify) làm các test đếm toàn bảng (Stats/List total) fail chập chờn dù tx-rollback. Cùng lớp: 2 test dispatcher outbox (`outbox_test.go` `TestDispatcher_ProcessesAndMarks`/`HandlerErrorKeepsEvent`) query pending không filter — có thể dính row committed từ session khác. Fix gợi ý: DB test riêng (vd `blog_test`), hoặc test đếm theo delta/filter và scope query dispatcher-test theo event id.

**Kiến trúc cho Phase 2:** ✅ **outbox ĐÃ TRIỂN KHAI (2026-07-12, commits 73ce4f2 + f4854f3, Slice 5d).** Package `internal/platform/outbox`: bảng `outbox(id, aggregate, aggregate_id, event_type, payload jsonb, created_at, processed_at)` + partial index unprocessed; repo posts ghi `post.created/updated/deleted` (payload `{id, slug, status, version}`) **trong cùng transaction**; `Dispatcher` poll 10s với `Handler` pluggable (hiện `LogHandler` — Phase 2 thay bằng consumer thật hoặc AI worker poll thẳng bảng). Chưa có `FOR UPDATE SKIP LOCKED` (single-instance, đã note trong code).

---

## 3. Admin SPA (`apps/admin` + packages) — B+

**Đã verify đúng (không cần sửa):** editor code-split thật (`React.lazy` + dynamic import, `EditorSwitch.tsx:6-7` — chunk editor không chọn không bao giờ được fetch); `apiFetch` overload + Zod + `ApiSchemaError` thiết kế tốt; query keys tập trung, phân cấp, invalidate đúng top-level; `validateSearch` + `.catch()` defaults + functional `navigate({ search })` textbook; `keepPreviousData` chống flicker; guard login/`_authed` không loop; `ToastProvider` memoize context value đúng.

### 🟠 High

- ✅ **RESOLVED (2026-07-11, commit 59ba496)** — prefill gate bằng `hasHydratedRef` (hydrate đúng 1 lần); `initialHtmlRef` chốt HTML nạp editor lần đầu. Test refetch object mới không ghi đè form đang dirty.
- **A1 — Background refetch xoá bài đang sửa (mất dữ liệu).** `features/posts/PostFormPage.tsx:76-81` — effect prefill chạy theo identity của `loaded`, không chỉ lần đầu; refetch nền (v5 mặc định `refetchOnReconnect`, staleTime 30s) → object mới → `reset(postToFormValues(loaded))` ghi đè nội dung đang gõ. Tệ hơn: editor uncontrolled (`initialHtml`), UI vẫn hiện text của user nhưng hidden field giữ HTML cũ của server — **submit lưu nội dung stale**. **Fix:** gate bằng `hasHydrated` ref (hoặc `formState.isDirty`), hoặc detail query `staleTime: Infinity` khi form mounted.
- ✅ **RESOLVED (2026-07-11, commit 32c6d11)** — `beforeLoad` chỉ redirect khi `err instanceof ApiError && err.status === 401`; lỗi khác rethrow cho error boundary.
- **A2 — API sập = bị đá về login.** `routes/_authed.tsx:6-11` — `beforeLoad` coi *mọi* lỗi `ensureQueryData` là chưa đăng nhập (500/CORS/API down đều redirect `/login`). **Fix:** chỉ redirect khi `ApiError.status === 401`; rethrow phần còn lại cho error boundary.
- ✅ **RESOLVED (2026-07-11, commit 32c6d11)** — `QueryCache`/`MutationCache` `onError` bắt `ApiError 401` → reset auth query + navigate `/login`; vị trí trước khi hết hạn lưu `sessionStorage` (sống sót qua full-page OAuth redirect), consume ở `_authed.beforeLoad` sau khi auth lại. Open-redirect guard `isInternalPath` (chặn `//`, backslash, control char).
  - 🔧 **Follow-up (2026-07-11, commit 6ed03e7):** bản đầu ghép `location.pathname + location.search` → `location.search` của TanStack Router là **object đã parse**, ghép string+object ném `Cannot convert object to primitive value` làm vỡ guard thành error boundary. Đã đổi sang `location.href` (chuỗi path+search sẵn có). Phát hiện khi chạy stack live.
- **A3 — Session hết hạn giữa phiên không xử lý.** `features/auth/api.ts:14` staleTime 5' → guard pass từ cache sau khi session chết; 401 từ data query chỉ hiện `RouteError`/toast, không bao giờ về login. **Fix:** `QueryCache`/`MutationCache` `onError` trong `lib/queryClient.ts`: 401 → reset auth query + `router.navigate({ to: "/login" })` kèm `redirect` search param (param này hiện cũng chưa có).

### 🟡 Medium

- ✅ **RESOLVED (2026-07-11, commit 59ba496)** — `contentJson` chuyển sang `useRef`, chỉ đọc lúc submit → keystroke editor không re-render form. Test submit gửi đúng content_json mới nhất.
- **A4 — `contentJson` là `useState`** (`PostFormPage.tsx:72,164-167`) nhưng chỉ đọc lúc submit → mỗi keystroke trong rich editor re-render cả form (2 card + Select + toolbar). Optimize thật, không cargo-cult: đổi sang `useRef`. (Cả 2 editor cũng serialize full document → HTML mỗi keystroke — `TiptapEditor.tsx:48`, `LexicalEditor.tsx:96-103`; debounce `onChange` sẽ nhân đôi lợi ích.)
- ✅ **A5 — RESOLVED (2026-07-11, commit 239f422)** — mutations invalidate thêm `tagKeys.all` (+ chuyển `tagKeys` về `features/tags/keys.ts`).
- **A5 — Tạo/sửa post có thể tạo tag mới nhưng chỉ invalidate `postKeys.all`** (`features/posts/queries.ts:49-71`) → tags list stale, tag mới không hiện ở filter. **Fix:** invalidate thêm `tagKeys.all`.
- ✅ **A6 — RESOLVED (2026-07-11, commit f14fcc1)** — `onDelete?` optional + augmentation chuyển ra `lib/table-meta.ts`.
- **A6 — Module augmentation `TableMeta.onDelete` bắt buộc cho MỌI table** (`components/ui/data-table.tsx:25-30`) — table tiếp theo không có delete phải cấp fake handler. **Fix:** `onDelete?:` + chuyển augmentation ra file riêng.
- ✅ **A7 — RESOLVED (2026-07-11, commit 239f422)** — toolbar props `PostStatus | ""`, xoá casts, route dùng `PostStatusSchema.or(z.literal(""))`.
- **A7 — Toolbar erase union `PostStatus` về `string`** (`PostsToolbar.tsx:33-36`) ép parent `as PostStatus | ""` cast (`PostsListPage.tsx:24,89` — cast dòng 24 hoàn toàn thừa vì `validateSearch` đã cho đúng union). Route cũng re-declare enum inline (`routes/_authed.posts.index.tsx:11`) thay vì `PostStatusSchema.or(z.literal(""))` — 2 nguồn sự thật có thể drift. **Fix:** type props bằng union, xoá cả 3 cast.
- ✅ **A8 — RESOLVED (2026-07-11, commit f14fcc1)** — queryFn forward `{ signal }` vào `listPosts`/`getPostBySlug` → `apiFetch`.
- **A8 — `apiFetch` không nhận `AbortSignal`** (`lib/apiClient.ts:40`), queryFn không pass `{ signal }` → out-of-order response có thể settle cache stale với `keepPreviousData`. **Fix:** thread `signal` từ `queries.ts:26,31` vào `fetch`.
- ✅ **A9 — RESOLVED (2026-07-11, commit f14fcc1)** — navigate `/login` trước, `qc.clear()` sau.
- **A9 — `useSignOut` gọi `qc.clear()` khi component `_authed` còn mounted** (`features/auth/hooks.ts:18-21`) → observer refetch ngay → 401 → flash suspense/error đua với navigate. **Fix:** navigate trước, clear sau.

### 🟢 Low (tóm tắt)

- Nút "Thêm bài viết" ở Topbar chết (không onClick/link) (`app/Topbar.tsx:16-19`); Bell/search/workspace ở Sidebar cũng inert.
- `AppShell` map title theo exact path → `/posts/new` hiện "Dashboard" (`app/AppShell.tsx:5-15`).
- ✅ **RESOLVED (2026-07-11, commit 239f422)** `tagKeys` dead code + sai chỗ → chuyển `features/tags/keys.ts`, dùng trong `tagsQueryOptions`.
- ✅ **RESOLVED (2026-07-11, commit f14fcc1)** `updatePost` dùng brand `PostId`.
- ✅ **RESOLVED (2026-07-11, commit f14fcc1)** 204-with-schema → throw `ApiSchemaError`; interface `ApiError` → `ApiErrorBody`.
- 3 `void ensureQueryData` không catch → unhandled rejection (`routes/_authed.index.tsx:12-14`). *(chưa làm — minor, để backlog)*
- Lexical toolbar không có active state (`aria-pressed`) — parity gap với Tiptap (`lexical/LexicalEditor.tsx:172-189`). *(defer — editor parity, ngoài phạm vi 5c)*
- Media: không dọn ảnh mồ côi, PUT không progress/timeout (`features/media/api.ts`) — ghi TODO sweep server-side. *(defer — thuộc backend/Slice 5d)*
- ✅ **RESOLVED (2026-07-11, commit b6c6706)** a11y: error toast `role="alert"`; sortable `<th>` thêm `aria-sort`.
- ✅ **RESOLVED (2026-07-11, commit b6c6706)** Xoá item cuối trang cuối → clamp `page` về trang cuối mới.
- Test: zero coverage cho code rủi ro nhất (auth guard, PostFormPage submit/prefill — A1 sẽ bị bắt, editors); fixture `as unknown as Post` erase brand → nên có `makePost` factory dùng `PostIdSchema.parse`.

---

## 4. Web Next.js (`apps/web`) — B

**Bằng chứng verify:** `apps/web/.turbo/turbo-build.log:17-24` — `ƒ /` (dynamic!), `● /blog/[slug]` (SSG), `● /tags/[slug]` (SSG), `○ /tags`.

**Đã verify đúng:** Zod parse tại boundary, ép `status=PUBLISHED` tập trung + filter belt-and-braces ở single post (`features/posts/api.ts:34-39`, có test), escape XML, try/catch quanh `generateStaticParams`, client components tối thiểu. API client **cố ý không share** với admin (admin = session-oriented, web = RSC-cache-oriented) — quyết định đúng.

### 🟠 High

- ✅ **RESOLVED (2026-07-11, commit 9c04692 + 52d937a)** — chuyển sang path-based pagination (`pageHref` path segment + routes `/page/[n]`, `/tags/[slug]/page/[n]` với `generateStaticParams` + component chung `PostsPage`). Verify production `next build && next start`: `/` và `/page/2` trả nội dung khác nhau; build log `○ /` (static) + `● /page/[n]` (SSG); `/page/999` → soft-404.
- **W1 — Pagination hỏng ở production.** `app/tags/[slug]/page.tsx:23-26` — route SSG (build log `●`) nhưng phân trang bằng `?page=` query; static cache key theo pathname → tag đã prerender luôn serve HTML trang 1 bất kể `?page=2`. Chỉ chạy đúng ở `next dev` (vì thế E2E verify Slice 4 không bắt được; seed chưa có tag >10 bài). **Fix:** path-based pagination `/tags/[slug]/page/[n]` trong `generateStaticParams` (hoặc `force-dynamic` — không khuyến nghị).

### 🟡 Medium

- ✅ **RESOLVED (2026-07-11, commit 52d937a)** — trang chủ bỏ đọc `searchParams` → static (build log `○ /` thay vì `ƒ /`); soft-404 khi page vượt total. ISR `revalidate=60` giờ có hiệu lực thật.
- **W2 — Trang chủ render dynamic mỗi request** (`app/page.tsx:10-14` đọc `searchParams` → build log `ƒ /`); `revalidate = 60` (dòng 7) vô hiệu cho ISR; `listPublished` (dòng 15) không error handling → core sập lúc cache miss = visitor thấy 500 mặc định. **Fix:** path-based pagination `/page/[n]` → trang chủ param-less, SSG+ISR thật.
- ✅ **RESOLVED (2026-07-11, commit 43702e5)** — bỏ `.catch(() => [])` ở sitemap + rss route → lỗi throw, ISR giữ bản tốt cuối.
- **W3 — Sitemap/RSS rỗng khi core sập lúc revalidate.** `app/sitemap.ts:9-10`, `app/rss.xml/route.ts:8` — `.catch(() => [])` → publish sitemap **rỗng** và cache trong ISR window; crawler thấy cả site biến mất. **Fix:** để throw — revalidation fail thì ISR giữ bản tốt cuối; chỉ nuốt lỗi khi chưa có bản nào (first build).
- ✅ **RESOLVED (2026-07-11, commit 7cf7f54)** — `generateMetadata` cho `/tags/[slug]` + `/tags/[slug]/page/[n]` (title `#slug`, canonical) + static metadata `/tags`.
- **W4 — Tag pages không có metadata** (`app/tags/[slug]/page.tsx`, `app/tags/page.tsx`) — mọi trang tag cùng `<title>Ultimate website</title>`, không description/canonical. **Fix:** `generateMetadata({ params })`.
- ✅ **RESOLVED (2026-07-11, commit 23b09d7)** — JSON-LD `BlogPosting` (escape `<` chống breakout) + cover image `sizes`.
- **W5 — Không có JSON-LD `BlogPosting`** ở `app/blog/[slug]/page.tsx` — bỏ lỡ rich results; data đã có sẵn tại chỗ (dòng 40).
- ✅ **RESOLVED (2026-07-11, commit 14f8319)** — `not-found.tsx` + `error.tsx` branded (header/footer từ layout). Verify `/khong-ton-tai` → 404 branded.
- **W6 — Không có `not-found.tsx`/`error.tsx`/`loading.tsx`** (verify bằng glob) — `notFound()` render 404 trắng không header/footer; error render 500 mặc định. **Fix:** branded pages tái dùng `SiteHeader`/`SiteFooter`.
- ✅ **RESOLVED (2026-07-11, commit 0b2d569 + 64bede2)** — `rehype-sanitize` server-side (RSC) với allowlist mở rộng cho editor output (chặn `<script>`/`on*`/`javascript:`, giữ table/task-list/`<mark>`/img) + CSP header (không nonce, giữ SSG) qua `next.config` `headers()` + `nosniff`/`Referrer-Policy`. Verify: bài chèn `<script>` render KHÔNG chạy; response có CSP header; security-review sạch.
- **W7 — Không sanitize + không CSP.** `features/posts/components/post-content.tsx:6` `dangerouslySetInnerHTML` không sanitize (chấp nhận được với single trusted author) NHƯNG `next.config.mjs` không có CSP header nào → admin bị chiếm session (hoặc bug serialize Tiptap/Lexical) = stored XSS trên origin công khai với zero mitigation. **Fix:** `rehype-sanitize`/`sanitize-html` server-side (RSC, chi phí trả 1 lần/ISR render, allowlist tune cho table/task-list/highlight) + CSP qua `headers()` (`script-src 'self'; object-src 'none'` tối thiểu).

### 🟢 Low (tóm tắt)

- ✅ **RESOLVED (2026-07-11, commit ee8c4f8)** Không OG image fallback + twitter card cứng → OG fallback `/og-default.png` + card `summary` khi không cover (`features/posts/metadata.ts`).
- ✅ **RESOLVED (2026-07-11, commit 43702e5)** RSS thiếu `atom:link`/`language`/`lastBuildDate` + chưa escape URL → đã thêm đủ + escape link/guid.
- ✅ **RESOLVED (2026-07-11, commit 2e58504)** **Font:** migrate `next/font/google` (Lora + Inter) qua CSS variable + chuẩn hoá weight lẻ về cut tĩnh 400–700.
- `reading-progress.tsx:13,27` — setState mỗi scroll event + animate `width`; bản senior: ref + rAF ghi `transform: scaleX()` trực tiếp, không re-render React. *(chưa làm — micro-opt, để backlog)*
- ✅ **RESOLVED (2026-07-11, commit 23b09d7)** Cover image thiếu `sizes` → thêm `sizes="(max-width: 42rem) 100vw, 42rem"`.
- ✅ **RESOLVED (2026-07-11, commit 64bede2)** `next.config` pattern localhost ship prod + media host fail im lặng → gate theo `NODE_ENV` + fail-fast thiếu `NEXT_PUBLIC_MEDIA_HOST` ở prod build.
- `listAllPublished` page qua **full payload gồm `content_html`** chỉ để lấy slug/date cho sitemap/RSS/staticParams (`features/posts/api.ts:49-59`) — OK ở scale blog; sau này thêm endpoint slim `fields=`. *(chưa làm — scale sau)*
- ✅ **RESOLVED (2026-07-11, commit 52d937a)** `?page=` quá trang cuối → soft-404 `notFound()` (path-based, đã đóng ở W1/W2).
- Test: utils thuần cover tốt, nhưng zero test cho `sitemap.ts` (hành vi catch→empty), `format.ts` (readingTime tiếng Việt), boundary `Pagination`. **Bài học chính:** W1/W2 là loại bug unit test không bắt được — cần smoke test production-mode (`next build && next start` + assert `?page=2` trả nội dung khác).

---

## 5. Findings xuyên suốt (cross-cutting)

1. **Trust boundary đặt sai chỗ:** web lọc PUBLISHED client-side trong khi API trả tất cả — fix ở core (C1), giữ guard ở web làm belt-and-braces.
2. **"Verify E2E live" của Slice 4 có blind spot:** chạy ở dev mode nên miss W1/W2 (render mode chỉ lộ ở production build). → thêm bước verify production-mode vào quy trình slice.
3. **Error path là vùng yếu chung cả 3 mảng:** core nuốt 500 (H3), admin coi mọi lỗi là 401 (A2) và không xử lý 401 thật (A3), web publish sitemap rỗng khi lỗi (W3).
4. **Type-safety Go ↔ TS chưa có codegen** (§1.2) — nên chốt trước Phase 2.

---

## 6. Plan refactor đề xuất — "Slice 5: Hardening" (3 đợt)

> Theo quy trình chuẩn: brainstorm → spec (`docs/superpowers/specs/`) → TDD → verify E2E → commit. Ước lượng tổng: ~3 ngày.

### Đợt 1 — Security & data-loss (~1 ngày) — LÀM TRƯỚC MỌI THỨ
1. **Visibility policy ở core** (C1): unauthenticated → ép `status=PUBLISHED`, slug non-published → 404; gate `/posts/stats*` sau `RequireAuth`. Kèm 2 handler test (draft ẩn với anonymous, hiện với session).
2. **Fix prefill clobbering + `contentJson` → ref** (A1, A4) ở `PostFormPage` — ~15 dòng, kèm test.
3. **Ký Content-Length vào presign** (H1) + **middleware `requireJSON`** cho write routes (H4) + assert startup `samesite=none ⇒ secure`.

### Đợt 2 — Production-readiness (~1 ngày)
4. **`http.Server` + graceful shutdown + pool config + healthz ping DB** (H2, M6, L7) — 1 commit, đều trong `main.go`.
5. **Request-logging middleware** (H3): request ID + contextual `slog` vào context; `respondError` log raw error.
6. **Auth pipeline 401-aware ở admin** (A2, A3): `beforeLoad` chỉ redirect 401 + `redirect` search param; `QueryCache.onError` bắt 401.
7. **Web path-based pagination** (W1, W2 + soft-404): `app/page/[n]/page.tsx` + `app/tags/[slug]/page/[n]/page.tsx` với `generateStaticParams` từ `totalPages`; **`not-found.tsx` + `error.tsx`** (W6); bỏ `.catch(()=>[])` ở sitemap/rss (W3).

### Đợt 3 — Polish, SEO & chuẩn bị Phase 2 (~1 ngày)
8. **SEO pass** (W4, W5 + low): tag metadata, JSON-LD, OG fallback, RSS self-link/language; **`next/font` migration + chuẩn hoá weight**.
9. **Sanitize + CSP** (W7); **TS tightening ở admin** (A5–A8 + low): union `PostStatus` end-to-end, `PostId` brand, `onDelete?`, AbortSignal, tag invalidation; core: tiebreaker `id ASC`, `ON CONFLICT` tag upsert (M1).
10. **Outbox table cho Phase 2** (nửa ngày): transactional outbox + AI worker poll/LISTEN — mở đường RAG index không stale.

Các finding medium/low còn lại (M2–M5, L*, A9, W low) xử lý cuốn chiếu trong đợt 2–3 hoặc để backlog tuỳ spec.

---

## 7. Skills khuyến nghị

**Dùng ngay (có sẵn):**
- `superpowers:brainstorming` → spec Slice 5 → `test-driven-development` từng fix → `security-review` sau đợt 1 → `code-review` trước merge.
- `verify`: **bắt buộc chạy `next build && next start`** để chứng minh pagination fix — unit test không bắt được loại bug này.

**Bổ sung nên có:**
- **Project skill `verify-prod-web`** (viết bằng `superpowers:writing-skills`): `next build && next start` + assert `/page/2` khác trang 1 — bịt đúng blind spot khiến Slice 4 miss W1.
- `claude-code-setup:claude-automation-recommender`: sinh hooks (auto `golangci-lint`, `pnpm typecheck` pre-commit) — repo chưa có golangci-lint trong quy trình.
- **CI**: commit `.github/workflows` (lint + test + build cả 3 target) trước khi deploy — dùng `commit-commands:commit-push-pr`.
- **Postgres MCP server** (analysis doc §18): cài khi vào Phase 2 để debug pgvector/RAG.
