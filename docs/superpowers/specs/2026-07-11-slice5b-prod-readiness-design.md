# Slice 5b — Production-readiness Hardening (Đợt 2)

> Ngày: 2026-07-11 · Trạng thái: Design approved, chờ implementation plan.
> Nguồn findings: `docs/reviews/2026-07-11-senior-code-review.md`. Slice này resolve: **W1, W2, H2, H3, A2, A3** (+ M6, L7 kèm theo).
> Quyết định đã chốt khi brainstorm: (1) W1 = **path-based pagination** (`/page/[n]`), khôi phục SSG+ISR thật; (2) H3 = **slog + middleware tự viết** (không thêm dependency); (3) A3 = redirect về login **kèm `?redirect=`** giữ vị trí.

## Mục tiêu

Đưa hệ thống lên mức sẵn sàng chạy production:

1. **W1 + W2** — pagination web hoạt động đúng ở production (SSG+ISR thật, không phải dev-only).
2. **H2 + M6 + L7** — core có graceful shutdown, `http.Server` timeouts, pool DB cấu hình, `/healthz` ping DB.
3. **H3** — request logging (request ID + contextual slog); lỗi 500 được ghi thật.
4. **A2 + A3** — admin phân biệt "API sập" vs "chưa đăng nhập"; session hết hạn giữa chừng → về login giữ vị trí.

**Ngoài phạm vi (đợt 3):** SEO pass, sanitize/CSP, next/font, TS tightening admin, M1–M5, outbox.

## Thiết kế

### 1. Web — Path-based pagination (W1, W2, soft-404)

**Vấn đề:** `?page=N` trên route SSG → Next cache theo pathname → trang đã prerender luôn serve trang 1 bất kể query. Chỉ đúng ở `next dev`.

**Thay đổi:**

- Tách phần render dùng chung thành component nội bộ `PostsPage` (đặt tại `apps/web/src/features/posts/components/posts-page.tsx`):
  ```tsx
  // Nhận page + tag (optional) + heading; fetch listPublished, render PostList + Pagination; soft-404 khi page vượt totalPages.
  export async function PostsPage({ page, tag, basePath }: { page: number; tag?: string; basePath: string }): Promise<JSX.Element>
  ```
  Logic: `const { data, total } = await listPublished({ page, tag }); const pages = totalPages(total, PAGE_SIZE); if (page > pages && total > 0) notFound();` rồi render header (khác nhau giữa home/tag qua prop) + `PostList` + `Pagination`.
- **Trang chủ:**
  - `app/page.tsx` — bỏ `searchParams`, render `<PostsPage page={1} basePath="/" />`. Thành static (`export const revalidate = 60` giữ nguyên → ISR).
  - `app/page/[n]/page.tsx` — `generateStaticParams` sinh `[{n:"2"},...]` từ `totalPages(total, PAGE_SIZE)` (fetch `listAllPublished` count hoặc `listPublished({page:1})` lấy total); param `n` parse số, `n < 2 || NaN` → `notFound()`; render `<PostsPage page={n} basePath="/" />`.
- **Tags:**
  - `app/tags/[slug]/page.tsx` — render `<PostsPage page={1} tag={params.slug} basePath={/tags/${params.slug}} />`; `generateStaticParams` giữ nguyên (list tags).
  - `app/tags/[slug]/page/[n]/page.tsx` — `generateStaticParams` sinh cặp `{slug, n}` cho các trang 2+ mỗi tag; render `<PostsPage page={n} tag={slug} ... />`.
- **Pagination href:** đổi `pageHref` sang path-based:
  ```ts
  export function pageHref(basePath: string, page: number): string {
    if (page <= 1) return basePath;
    const base = basePath === "/" ? "" : basePath;
    return `${base}/page/${page}`;
  }
  ```
  (Trang 1 = `basePath`; trang N = `${basePath}/page/N`, xử lý `basePath="/"` → `/page/N`.)

**Kết quả kỳ vọng:** build log hiện `●`/`○` (static/SSG) cho `/`, `/page/[n]`, `/tags/[slug]`, `/tags/[slug]/page/[n]`; KHÔNG còn `ƒ /` (dynamic).

### 2. Core — Graceful shutdown + timeouts + pool + healthz (H2, M6, L7)

`services/core/cmd/api/main.go`:

- Thay `http.ListenAndServe(...)` bằng:
  ```go
  srv := &http.Server{
      Addr:              ":" + cfg.Port,
      Handler:           sm.LoadAndSave(r),
      ReadHeaderTimeout: 5 * time.Second,
      ReadTimeout:       10 * time.Second,
      WriteTimeout:      15 * time.Second,
      IdleTimeout:       60 * time.Second,
  }
  ```
- Graceful shutdown:
  ```go
  ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
  defer stop()
  go func() {
      if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
          log.Error("server error", "err", err); os.Exit(1)
      }
  }()
  <-ctx.Done()
  shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
  defer cancel()
  if err := srv.Shutdown(shutdownCtx); err != nil { log.Error("shutdown", "err", err) }
  _ = sqlDB.Close()
  ```
- Pool (sau khi lấy `sqlDB`): `sqlDB.SetMaxOpenConns(10); sqlDB.SetMaxIdleConns(5); sqlDB.SetConnMaxLifetime(30*time.Minute)`.
- `/healthz` ping DB:
  ```go
  r.GET("/healthz", func(c *gin.Context) {
      ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
      defer cancel()
      if err := sqlDB.PingContext(ctx); err != nil {
          c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db down"}); return
      }
      c.JSON(http.StatusOK, gin.H{"status": "ok"})
  })
  ```

### 3. Core — Request logging + request ID (H3)

Package mới `internal/shared/reqlog/reqlog.go`:

- Context key riêng (unexported struct type) cho `*slog.Logger`.
- `Middleware(base *slog.Logger) gin.HandlerFunc`:
  - Đọc `X-Request-ID` từ header; rỗng → `uuid.NewString()`.
  - Set `c.Writer.Header().Set("X-Request-ID", id)`.
  - `l := base.With("request_id", id)`; đặt vào `context` qua `context.WithValue`, gán lại `c.Request = c.Request.WithContext(ctx)`.
  - `start := time.Now()`; `c.Next()`; log completion: `l.Info("request", "method", ..., "path", ..., "status", c.Writer.Status(), "latency_ms", ...)`.
- `From(ctx context.Context) *slog.Logger`: trả logger trong context, fallback `slog.Default()` nếu thiếu (an toàn trong test).
- Wire trong `main.go`: `r.Use(reqlog.Middleware(log))` — sau `gin.Recovery()`, trước CORS/routes.
- **Log lỗi 500:** trong `respondError` của posts + media + auth, nhánh `default` (500) thêm:
  ```go
  reqlog.From(c.Request.Context()).Error("request failed", "err", err)
  ```
  (posts `respondError` nhận `*gin.Context` — đã có; media/auth tương tự. Chỉ log ở nhánh 500, không log lỗi 4xx domain.)

### 4. Admin — 401-aware auth pipeline (A2, A3)

- **A2** — `routes/_authed.tsx`:
  ```ts
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        throw redirect({ to: "/login", search: { redirect: location.href } });
      }
      throw err; // 500/CORS/API down → error boundary, KHÔNG coi là chưa đăng nhập
    }
  }
  ```
- **A3** — `lib/queryClient.ts`: thêm `QueryCache`/`MutationCache` `onError`:
  ```ts
  import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
  import { ApiError } from "./apiClient";
  import { getRouter } from "./router-ref"; // lazy getter tránh circular

  function handle401(error: unknown) {
    if (error instanceof ApiError && error.status === 401) {
      const router = getRouter();
      queryClient.setQueryData(["auth", "me"], null);
      void router.navigate({ to: "/login", search: { redirect: router.state.location.href } });
    }
  }
  export const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handle401 }),
    mutationCache: new MutationCache({ onError: handle401 }),
    defaultOptions: { queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false } },
  });
  ```
  - `lib/router-ref.ts`: module giữ ref router (`let router; export const setRouter = ...; export const getRouter = ...`), set trong `main.tsx` sau khi tạo router. Tránh vòng import (queryClient ↔ router).
- **redirect param** — `routes/login.tsx`:
  - `validateSearch`: `z.object({ redirect: z.string().optional() })`.
  - Khi login xong (hoặc `beforeLoad` login nếu đã auth) → `navigate({ to: search.redirect ?? "/" })`. Chỉ nhận redirect nội bộ (bắt đầu bằng `/`, không `//`) để tránh open-redirect.

## Test plan (TDD)

**Web (Vitest):**
| Test | Khẳng định |
|---|---|
| `pageHref` path-based | trang 1 → basePath; trang 3 → `${basePath}/page/3`; `basePath="/"` → `/page/3` |
| `totalPages` | boundary (0, chia hết, dư) — giữ test cũ |
| (verify) `next build` | build log: `/`, `/page/[n]`, `/tags/[slug]`, `/tags/[slug]/page/[n]` là static; không có `ƒ /` |

**Core (Go):**
| Test | Khẳng định |
|---|---|
| `reqlog` middleware | response có header `X-Request-ID`; `From(ctx)` trả logger đã set; completion log gọi (dùng slog handler bắt record) |
| `reqlog.From` fallback | ctx không có logger → trả non-nil (slog.Default) |
| `/healthz` (integration) | DB up → 200; (ping fail khó giả lập unit → verify thủ công) |

**Admin (Vitest):**
| Test | Khẳng định |
|---|---|
| `_authed.beforeLoad` | ApiError 401 → redirect `/login` kèm redirect param; ApiError 500 → KHÔNG redirect (rethrow) |
| `queryClient` onError | ApiError 401 → `router.navigate` tới `/login` được gọi; lỗi khác → không |
| `login` redirect | `redirect` param nội bộ → navigate về đó; param ngoài (`//evil`, `http://`) → bỏ, về `/` |

**Verify E2E:**
1. `next build && next start` (production mode): `/` và `/page/2` trả **nội dung khác nhau**; `/tags/<slug>/page/2` đúng trang 2; page vượt total → 404.
2. Core: gửi SIGTERM khi có request đang chạy (curl chậm) → server drain xong mới thoát; `/healthz` khi Postgres dừng → 503; response luôn có `X-Request-ID`; ép lỗi 500 → thấy log kèm request_id.
3. Admin: đăng nhập → xoá cookie session (DevTools) → thao tác (vd mở danh sách) → 401 → về `/login?redirect=/posts` → login lại → quay về `/posts`. Tắt core (API sập) → KHÔNG bị đá về login mà thấy error boundary.

## Definition of Done

- Toàn bộ test xanh (web + core + admin); `next build` + build admin + build core xanh.
- Verify E2E 3 nhóm trên pass (đặc biệt: production-build chứng minh W1/W2).
- Chạy `security-review` (chú ý open-redirect ở `redirect` param).
- Đánh dấu `✅ RESOLVED (2026-07-11, commit <hash>)` cho W1, W2, H2, H3, A2, A3 (+ M6, L7) trong review doc.
- Cập nhật `CLAUDE.md` (Slice 5b DONE + issue tracker: việc khẩn còn lại = 0; còn đợt 3 polish).
