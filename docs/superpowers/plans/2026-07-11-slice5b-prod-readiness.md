# Slice 5b — Production-readiness Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đưa hệ thống lên mức sẵn sàng production — pagination web đúng ở production (W1/W2), core graceful shutdown + timeouts + logging (H2/H3/M6/L7), admin phân biệt API-sập vs chưa-đăng-nhập + giữ vị trí khi session hết hạn (A2/A3).

**Architecture:** Web chuyển pagination sang path-based (`/page/[n]`) qua component chung `PostsPage` để khôi phục SSG+ISR. Core thêm middleware `reqlog` (request ID + contextual slog) + `http.Server` có timeout + graceful shutdown. Admin: `beforeLoad`/`QueryCache.onError` chỉ redirect khi 401; vị trí trước khi hết hạn lưu `sessionStorage` (sống sót qua full-page OAuth redirect).

**Tech Stack:** Next.js 14 App Router; Go + Gin + `log/slog` + `google/uuid`; React 18 + TanStack Router/Query; Vitest + Go testing.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-slice5b-prod-readiness-design.md`.
- KHÔNG thêm dependency Go mới (dùng `log/slog` + `google/uuid` đã có).
- `next build` phải cho `/`, `/page/[n]`, `/tags/[slug]`, `/tags/[slug]/page/[n]` là static (`●`/`○`) — KHÔNG có `ƒ /`. Đây là bằng chứng W1/W2 (unit test không bắt được).
- redirect sau login chỉ nhận path nội bộ (bắt đầu `/`, không `//`) — tránh open-redirect.
- Comment tiếng Việt theo phong cách file hiện có.
- Test: web `pnpm --filter @ultimate/web test`; admin `pnpm --filter @ultimate/admin test`; core `cd services/core && go test ./...` (integration cần `TEST_DATABASE_URL=postgres://blog:blog@localhost:5432/blog_test?sslmode=disable`).
- Sau khi xong TẤT CẢ tasks (Task 8): đánh dấu `✅ RESOLVED` W1/W2/H2/H3/A2/A3 (+M6/L7) trong review doc + cập nhật CLAUDE.md.

---

### Task 1: Web — `pageHref` path-based (W1 nền tảng)

**Files:**
- Modify: `apps/web/src/features/posts/pagination-utils.ts`
- Test: `apps/web/src/features/posts/pagination-utils.test.ts`

**Interfaces:**
- Produces: `pageHref(basePath, page)` — trang 1 → `basePath`; trang N≥2 → `${basePath}/page/N` (xử lý `basePath="/"` → `/page/N`).

- [ ] **Step 1: Write the failing test** — thêm vào `pagination-utils.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pageHref } from "./pagination-utils";

describe("pageHref (path-based)", () => {
  it("trang 1 → basePath nguyên vẹn", () => {
    expect(pageHref("/", 1)).toBe("/");
    expect(pageHref("/tags/go", 1)).toBe("/tags/go");
  });
  it("trang N≥2 → path segment /page/N", () => {
    expect(pageHref("/tags/go", 3)).toBe("/tags/go/page/3");
  });
  it("basePath='/' → /page/N (không thành //page/N)", () => {
    expect(pageHref("/", 2)).toBe("/page/2");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/pagination-utils.test.ts`
Expected: FAIL — `pageHref("/tags/go",3)` hiện trả `/tags/go?page=3`.

- [ ] **Step 3: Implement** — trong `pagination-utils.ts` thay `pageHref`:

```ts
export function pageHref(basePath: string, page: number): string {
  if (page <= 1) return basePath;
  const base = basePath === "/" ? "" : basePath;
  return `${base}/page/${page}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ultimate/web exec vitest run src/features/posts/pagination-utils.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/posts/pagination-utils.ts apps/web/src/features/posts/pagination-utils.test.ts
git commit -m "feat(web): pageHref path-based cho pagination (W1)"
```

---

### Task 2: Web — `PostsPage` chung + routes path-based + soft-404 (W1, W2)

**Files:**
- Create: `apps/web/src/features/posts/components/posts-page.tsx`
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/page/[n]/page.tsx`
- Modify: `apps/web/src/app/tags/[slug]/page.tsx`
- Create: `apps/web/src/app/tags/[slug]/page/[n]/page.tsx`

**Interfaces:**
- Consumes: `listPublished({ page, tag? })`, `listTags()`, `totalPages`, `pageHref` (Task 1), `PostList`, `Pagination`, `PAGE_SIZE`, `notFound` (next/navigation).
- Produces: `async function PostsPage({ page, tag, basePath }: { page: number; tag?: string; basePath: string }): Promise<JSX.Element>` — fetch + soft-404 + render header/list/pagination.

- [ ] **Step 1: Tạo component chung** `apps/web/src/features/posts/components/posts-page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { listPublished } from "@/features/posts/api";
import { PostList } from "@/features/posts/components/post-list";
import { Pagination } from "@/features/posts/components/pagination";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

type Props = { page: number; tag?: string; basePath: string };

// PostsPage render danh sách bài PUBLISHED có phân trang. Dùng chung cho trang chủ
// và trang tag; soft-404 khi page vượt tổng số trang (total > 0).
export async function PostsPage({ page, tag, basePath }: Props) {
  const { data, total } = await listPublished(tag ? { page, tag } : { page });
  const pages = totalPages(total, PAGE_SIZE);
  if (page > pages && total > 0) notFound();

  return (
    <main className="mx-auto max-w-3xl px-5 py-14 sm:py-20">
      <header className={tag ? "mb-8" : "mb-12"}>
        <p className="article-kicker">{tag ? "Chủ đề" : "Blog"}</p>
        <h1 className="article-title mt-3 text-[2.4rem] sm:text-[2.9rem]">
          {tag ? `#${tag}` : "Bài viết"}
        </h1>
        {tag ? (
          <p className="mt-3 text-muted-foreground">{total} bài viết</p>
        ) : (
          <p className="mt-4 max-w-[42rem] text-lg leading-relaxed text-muted-foreground">
            Ghi chép về backend, kiến trúc và những thứ đang học — bằng Go, Next.js và hơn thế nữa.
          </p>
        )}
      </header>
      <PostList posts={data} />
      <Pagination page={page} totalPages={pages} basePath={basePath} />
    </main>
  );
}
```

- [ ] **Step 2: Trang chủ tĩnh** — thay toàn bộ `apps/web/src/app/page.tsx`:

```tsx
import { PostsPage } from "@/features/posts/components/posts-page";

export const revalidate = 60;

export default function HomePage() {
  return <PostsPage page={1} basePath="/" />;
}
```

- [ ] **Step 3: Route trang chủ 2+** — tạo `apps/web/src/app/page/[n]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { listPublished } from "@/features/posts/api";
import { PostsPage } from "@/features/posts/components/posts-page";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

// Sinh sẵn các trang 2..N lúc build (trang 1 là "/"). Lỗi core → [] (degrade).
export async function generateStaticParams() {
  try {
    const { total } = await listPublished({ page: 1 });
    const pages = totalPages(total, PAGE_SIZE);
    return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ n: String(i + 2) }));
  } catch {
    return [];
  }
}

export default function HomePaged({ params }: { params: { n: string } }) {
  const page = Number(params.n);
  if (!Number.isInteger(page) || page < 2) notFound();
  return <PostsPage page={page} basePath="/" />;
}
```

- [ ] **Step 4: Trang tag tĩnh** — thay toàn bộ `apps/web/src/app/tags/[slug]/page.tsx`:

```tsx
import { listTags } from "@/features/posts/api";
import { PostsPage } from "@/features/posts/components/posts-page";

export const revalidate = 60;

export async function generateStaticParams() {
  try {
    const tags = await listTags();
    return tags.map((t) => ({ slug: t.slug }));
  } catch {
    return [];
  }
}

export default function TagPage({ params }: { params: { slug: string } }) {
  return <PostsPage page={1} tag={params.slug} basePath={`/tags/${params.slug}`} />;
}
```

- [ ] **Step 5: Route tag 2+** — tạo `apps/web/src/app/tags/[slug]/page/[n]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { listPublished, listTags } from "@/features/posts/api";
import { PostsPage } from "@/features/posts/components/posts-page";
import { totalPages } from "@/features/posts/pagination-utils";
import { PAGE_SIZE } from "@/lib/config";

export const revalidate = 60;

// Sinh cặp {slug, n} cho các trang 2+ của mỗi tag. Lỗi core → [] (degrade).
export async function generateStaticParams() {
  try {
    const tags = await listTags();
    const out: { slug: string; n: string }[] = [];
    for (const t of tags) {
      const { total } = await listPublished({ page: 1, tag: t.slug });
      const pages = totalPages(total, PAGE_SIZE);
      for (let p = 2; p <= pages; p++) out.push({ slug: t.slug, n: String(p) });
    }
    return out;
  } catch {
    return [];
  }
}

export default function TagPaged({ params }: { params: { slug: string; n: string } }) {
  const page = Number(params.n);
  if (!Number.isInteger(page) || page < 2) notFound();
  return <PostsPage page={page} tag={params.slug} basePath={`/tags/${params.slug}`} />;
}
```

- [ ] **Step 6: Verify build là static (W1/W2 đóng)**

Run: `pnpm --filter @ultimate/web build`
Expected: build thành công; trong bảng route: `○ /` (hoặc `●`), `● /page/[n]`, `● /tags/[slug]`, `● /tags/[slug]/page/[n]` — **KHÔNG có `ƒ /`**. (Cần core chạy để `generateStaticParams`/fetch có dữ liệu; nếu core tắt, fetch degrade nhưng route vẫn phải là static — kiểm tra ký hiệu, không phải nội dung.)

- [ ] **Step 7: Full web test + commit**

Run: `pnpm --filter @ultimate/web test`

```bash
git add apps/web/src/features/posts/components/posts-page.tsx apps/web/src/app/page.tsx "apps/web/src/app/page/[n]/page.tsx" "apps/web/src/app/tags/[slug]/page.tsx" "apps/web/src/app/tags/[slug]/page/[n]/page.tsx"
git commit -m "feat(web): path-based pagination /page/[n] + soft-404 → khôi phục SSG+ISR (W1, W2)"
```

---

### Task 3: Core — package `reqlog` (H3 nền tảng)

**Files:**
- Create: `services/core/internal/shared/reqlog/reqlog.go`
- Test: `services/core/internal/shared/reqlog/reqlog_test.go`

**Interfaces:**
- Produces:
  - `Middleware(base *slog.Logger) gin.HandlerFunc` — sinh/đọc `X-Request-ID`, set header + logger vào context, log completion.
  - `From(ctx context.Context) *slog.Logger` — lấy logger trong context; fallback `slog.Default()`.

- [ ] **Step 1: Write the failing test** — `services/core/internal/shared/reqlog/reqlog_test.go`:

```go
package reqlog

import (
	"bytes"
	"context"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func TestMiddleware_SetsRequestIDHeaderAndLogsCompletion(t *testing.T) {
	var buf bytes.Buffer
	base := slog.New(slog.NewTextHandler(&buf, nil))

	r := gin.New()
	r.Use(Middleware(base))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))

	if w.Header().Get("X-Request-ID") == "" {
		t.Error("response phải có header X-Request-ID")
	}
	logged := buf.String()
	if !strings.Contains(logged, "request_id=") {
		t.Errorf("completion log phải kèm request_id, got: %s", logged)
	}
	if !strings.Contains(logged, "status=200") {
		t.Errorf("completion log phải kèm status, got: %s", logged)
	}
}

func TestMiddleware_HonorsIncomingRequestID(t *testing.T) {
	r := gin.New()
	r.Use(Middleware(slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("X-Request-ID", "abc-123")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if got := w.Header().Get("X-Request-ID"); got != "abc-123" {
		t.Errorf("X-Request-ID = %q, want abc-123 (giữ giá trị client gửi)", got)
	}
}

func TestFrom_FallbackNonNil(t *testing.T) {
	if From(context.Background()) == nil {
		t.Error("From ctx trống phải trả logger non-nil (fallback slog.Default)")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/core && go test ./internal/shared/reqlog/ -v`
Expected: FAIL compile — package/`Middleware`/`From` chưa tồn tại.

- [ ] **Step 3: Implement** — `services/core/internal/shared/reqlog/reqlog.go`:

```go
// Package reqlog cung cấp middleware log request (request ID + contextual slog).
package reqlog

import (
	"context"
	"log/slog"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ctxKey struct{}

const headerRequestID = "X-Request-ID"

// Middleware sinh/đọc X-Request-ID, đặt *slog.Logger (đã gắn request_id) vào
// context, và log một dòng completion sau khi xử lý xong.
func Middleware(base *slog.Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		id := c.GetHeader(headerRequestID)
		if id == "" {
			id = uuid.NewString()
		}
		c.Writer.Header().Set(headerRequestID, id)

		l := base.With("request_id", id)
		ctx := context.WithValue(c.Request.Context(), ctxKey{}, l)
		c.Request = c.Request.WithContext(ctx)

		start := time.Now()
		c.Next()

		l.Info("request",
			"method", c.Request.Method,
			"path", c.Request.URL.Path,
			"status", c.Writer.Status(),
			"latency_ms", time.Since(start).Milliseconds(),
		)
	}
}

// From lấy logger trong context; fallback slog.Default() nếu chưa được set
// (an toàn khi gọi ngoài middleware, vd trong test).
func From(ctx context.Context) *slog.Logger {
	if l, ok := ctx.Value(ctxKey{}).(*slog.Logger); ok {
		return l
	}
	return slog.Default()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/core && go test ./internal/shared/reqlog/ -v`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/shared/reqlog/
git commit -m "feat(core): package reqlog — middleware request ID + contextual slog (H3)"
```

---

### Task 4: Core — wire reqlog + log lỗi 500 (H3)

**Files:**
- Modify: `services/core/cmd/api/main.go` (thêm `r.Use(reqlog.Middleware(log))`)
- Modify: `services/core/internal/modules/posts/handler.go` (`respondError` nhánh 500)
- Modify: `services/core/internal/modules/media/handler.go` (nhánh 500 trong `presign`)

**Interfaces:**
- Consumes: `reqlog.Middleware`, `reqlog.From` (Task 3).

- [ ] **Step 1: Wire middleware** — trong `services/core/cmd/api/main.go`, thêm import `".../internal/shared/reqlog"`, và sau `r.Use(gin.Recovery())` thêm:

```go
	r.Use(reqlog.Middleware(log))
```

- [ ] **Step 2: Log lỗi 500 ở posts** — `services/core/internal/modules/posts/handler.go`, sửa nhánh `default` của `respondError`:

```go
	default:
		reqlog.From(c.Request.Context()).Error("request failed", "err", err)
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "internal server error")
```

Thêm import `".../internal/shared/reqlog"`.

- [ ] **Step 3: Log lỗi 500 ở media** — `services/core/internal/modules/media/handler.go`, trong `presign` sửa nhánh 500 cuối:

```go
		reqlog.From(c.Request.Context()).Error("presign failed", "err", err)
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "internal server error")
```

Thêm import `".../internal/shared/reqlog"`.

- [ ] **Step 4: Build + full test**

Run: `cd services/core && go build ./... && go test ./...` (kèm `TEST_DATABASE_URL`)
Expected: build OK; toàn bộ test PASS (test handler cũ không quan tâm log nên không ảnh hưởng).

- [ ] **Step 5: Commit**

```bash
git add services/core/cmd/api/main.go services/core/internal/modules/posts/handler.go services/core/internal/modules/media/handler.go
git commit -m "feat(core): wire reqlog + ghi lỗi 500 kèm request_id (H3)"
```

---

### Task 5: Core — graceful shutdown + timeouts + pool + healthz (H2, M6, L7)

**Files:**
- Modify: `services/core/cmd/api/main.go`

**Interfaces:**
- Consumes: `sqlDB` (đã có từ `db.DB()`), `cfg.Port`, `sm.LoadAndSave(r)`.

- [ ] **Step 1: Pool config** — sau khi có `sqlDB` (`sqlDB, err := db.DB()`), thêm:

```go
	sqlDB.SetMaxOpenConns(10)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(30 * time.Minute)
```

- [ ] **Step 2: /healthz ping DB** — thay handler `/healthz`:

```go
	r.GET("/healthz", func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), 2*time.Second)
		defer cancel()
		if err := sqlDB.PingContext(ctx); err != nil {
			c.JSON(http.StatusServiceUnavailable, gin.H{"status": "db down"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
```

- [ ] **Step 3: http.Server + graceful shutdown** — thay khối `http.ListenAndServe(...)` cuối `main`:

```go
	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           sm.LoadAndSave(r),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      15 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	go func() {
		log.Info("core service listening", "port", cfg.Port, "env", cfg.AppEnv)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	log.Info("shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("graceful shutdown failed", "err", err)
	}
	_ = sqlDB.Close()
```

Thêm imports: `"context"`, `"errors"`, `"os/signal"`, `"syscall"` (giữ `"os"`, `"time"`, `"net/http"`). Bỏ dòng `log.Info("core service listening"...)` cũ nếu còn (đã chuyển vào goroutine).

- [ ] **Step 4: Build + vet**

Run: `cd services/core && go build ./... && go vet ./cmd/api/`
Expected: sạch.

- [ ] **Step 5: Verify thủ công (graceful + healthz)**

- Chạy `go run ./cmd/api`; `curl -s -o /dev/null -w "%{http_code}" localhost:8080/healthz` → 200; response header có `X-Request-ID` (từ Task 4).
- Ctrl+C (SIGINT) → log "shutting down" rồi thoát sạch (không panic).
- (Tuỳ chọn) dừng Postgres container → `/healthz` → 503.

- [ ] **Step 6: Commit**

```bash
git add services/core/cmd/api/main.go
git commit -m "feat(core): http.Server timeouts + graceful shutdown + pool + healthz ping DB (H2, M6, L7)"
```

---

### Task 6: Admin — 401-aware guard + post-login redirect (A2, A3)

**Files:**
- Create: `apps/admin/src/lib/router-ref.ts`
- Create: `apps/admin/src/lib/post-login-redirect.ts`
- Modify: `apps/admin/src/lib/queryClient.ts`
- Modify: `apps/admin/src/main.tsx`
- Modify: `apps/admin/src/routes/_authed.tsx`
- Test: `apps/admin/src/lib/post-login-redirect.test.ts`

**Interfaces:**
- Consumes: `ApiError` (`@/lib/apiClient`), `queryClient`, router (`@tanstack/react-router`).
- Produces:
  - `router-ref.ts`: `setRouter(r)`, `getRouter()` (throw nếu chưa set).
  - `post-login-redirect.ts`: `savePostLoginRedirect(path: string)`, `takePostLoginRedirect(): string | null` (validate path nội bộ; đọc-rồi-xoá).

**Vì sao sessionStorage:** sau OAuth, core redirect full-page về admin root `/` → mọi state URL/`?redirect=` của trang `/login` mất. `sessionStorage` sống sót qua full-page redirect nên là kênh duy nhất giữ được vị trí.

- [ ] **Step 1: Write the failing test** — `apps/admin/src/lib/post-login-redirect.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { savePostLoginRedirect, takePostLoginRedirect } from "./post-login-redirect";

beforeEach(() => sessionStorage.clear());

describe("post-login redirect", () => {
  it("lưu rồi lấy (take) trả path đã lưu và xoá sau khi đọc", () => {
    savePostLoginRedirect("/posts");
    expect(takePostLoginRedirect()).toBe("/posts");
    expect(takePostLoginRedirect()).toBeNull(); // đã bị xoá
  });
  it("bỏ path không nội bộ (open-redirect guard)", () => {
    savePostLoginRedirect("//evil.com");
    expect(takePostLoginRedirect()).toBeNull();
    savePostLoginRedirect("http://evil.com");
    expect(takePostLoginRedirect()).toBeNull();
  });
  it("ctx trống → null", () => {
    expect(takePostLoginRedirect()).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ultimate/admin exec vitest run src/lib/post-login-redirect.test.ts`
Expected: FAIL — module chưa tồn tại.

- [ ] **Step 3: Implement `post-login-redirect.ts`**:

```ts
const KEY = "postLoginRedirect";

// Chỉ chấp nhận path nội bộ tuyệt đối ("/..." nhưng không "//") — tránh open-redirect.
function isInternalPath(p: string): boolean {
  return p.startsWith("/") && !p.startsWith("//");
}

export function savePostLoginRedirect(path: string): void {
  if (isInternalPath(path)) sessionStorage.setItem(KEY, path);
}

export function takePostLoginRedirect(): string | null {
  const p = sessionStorage.getItem(KEY);
  sessionStorage.removeItem(KEY);
  return p && isInternalPath(p) ? p : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ultimate/admin exec vitest run src/lib/post-login-redirect.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: `router-ref.ts`** (tránh circular import queryClient ↔ router):

```ts
import type { Router } from "@tanstack/react-router";

let router: Router<never, never> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setRouter(r: any): void {
  router = r;
}

export function getRouter() {
  if (!router) throw new Error("router chưa được set (gọi setRouter trong main.tsx)");
  return router;
}
```

- [ ] **Step 6: queryClient onError 401** — thay `apps/admin/src/lib/queryClient.ts`:

```ts
import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import { ApiError } from "./apiClient";
import { getRouter } from "./router-ref";
import { savePostLoginRedirect } from "./post-login-redirect";

// 401 giữa phiên (session hết hạn) → lưu vị trí hiện tại + điều hướng về /login.
function handle401(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    const router = getRouter();
    queryClient.setQueryData(["auth", "me"], null);
    savePostLoginRedirect(router.state.location.pathname + router.state.location.search);
    void router.navigate({ to: "/login" });
  }
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError: handle401 }),
  mutationCache: new MutationCache({ onError: handle401 }),
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});
```

- [ ] **Step 7: set router trong main.tsx** — sau `const router = createRouter({...})` thêm:

```ts
import { setRouter } from "@/lib/router-ref";
// ...
setRouter(router);
```

- [ ] **Step 8: _authed.tsx chỉ redirect khi 401 + lưu vị trí** — thay `apps/admin/src/routes/_authed.tsx`:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";
import { AppShell } from "@/app/AppShell";
import { authQueryOptions } from "@/features/auth/api";
import { ApiError } from "@/lib/apiClient";
import { savePostLoginRedirect, takePostLoginRedirect } from "@/lib/post-login-redirect";

export const Route = createFileRoute("/_authed")({
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(authQueryOptions);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        savePostLoginRedirect(location.pathname + location.search);
        throw redirect({ to: "/login" });
      }
      throw err; // 500/CORS/API sập → error boundary, KHÔNG coi là chưa đăng nhập
    }
    // Vừa đăng nhập xong (quay lại từ OAuth) → nếu có vị trí đã lưu, đưa về đó.
    const back = takePostLoginRedirect();
    if (back && back !== location.pathname + location.search) {
      throw redirect({ to: back });
    }
  },
  component: AppShell,
});
```

- [ ] **Step 9: Full admin test + typecheck + build**

Run: `pnpm --filter @ultimate/admin test && pnpm --filter @ultimate/admin build`
Expected: xanh (kèm test mới + các test cũ không đổi hành vi).

- [ ] **Step 10: Commit**

```bash
git add apps/admin/src/lib/router-ref.ts apps/admin/src/lib/post-login-redirect.ts apps/admin/src/lib/post-login-redirect.test.ts apps/admin/src/lib/queryClient.ts apps/admin/src/main.tsx apps/admin/src/routes/_authed.tsx
git commit -m "fix(admin): 401-aware guard (A2) + giữ vị trí sau login qua sessionStorage (A3)"
```

---

### Task 7: E2E verify (production mode)

- [ ] **Step 1: Web production build + smoke**

```bash
pnpm --filter @ultimate/web build   # xác nhận route static (Task 2 step 6)
pnpm --filter @ultimate/web start    # production server :3000 (cần core :8080 + seed >10 bài để có trang 2)
```
- `curl -s localhost:3000/ | grep -o '<h1[^>]*>[^<]*' | head -1` và `curl -s localhost:3000/page/2 | ...` → **nội dung bài khác nhau** giữa `/` và `/page/2` (không còn W1).
- `curl -s -o /dev/null -w "%{http_code}" localhost:3000/page/999` → 404 (soft-404).

- [ ] **Step 2: Core graceful + logging + healthz**

- `go run ./cmd/api`; mọi response có header `X-Request-ID`; `/healthz` → 200; dừng Postgres → `/healthz` → 503.
- Gửi SIGTERM khi đang có request → log "shutting down", thoát sạch.

- [ ] **Step 3: Admin 401-aware (browser)**

- Login → xoá cookie session (DevTools) → mở danh sách posts → 401 → về `/login` → login lại → **quay về `/posts`** (đúng vị trí).
- Tắt core (API sập) khi đang ở trang authed → **KHÔNG bị đá về login**, thấy error boundary (`RouteError`).

- [ ] **Step 4: Commit (nếu có điều chỉnh sau verify)** — nếu không có thay đổi, bỏ qua.

---

### Task 8: Security-review + đánh dấu RESOLVED

- [ ] **Step 1: Security review** — invoke skill `security-review` cho diff branch; chú ý open-redirect ở `post-login-redirect` (đã có guard `isInternalPath`). Xử lý mọi finding ≥ high.

- [ ] **Step 2: Đánh dấu RESOLVED** — trong `docs/reviews/2026-07-11-senior-code-review.md` thêm `✅ RESOLVED (2026-07-11, commit <hash>)` vào đầu các finding: **W1, W2** (Web High/Medium), **H2, H3** (Go core High), **A2, A3** (Admin High), **M6, L7** (Go core Medium/Low). Không xoá nội dung finding.

- [ ] **Step 3: Cập nhật CLAUDE.md** — thêm dòng **Slice 5b — DONE** vào "Trạng thái hiện tại"; cập nhật "📍 Điểm hiện tại" + khối "🩺 Issue tracker" (việc khẩn còn lại = 0; chỉ còn đợt 3 polish: SEO, sanitize/CSP, next/font, TS tightening, M1–M5, outbox).

- [ ] **Step 4: Final commit**

```bash
git add docs/reviews/2026-07-11-senior-code-review.md CLAUDE.md docs/superpowers/plans/2026-07-11-slice5b-prod-readiness.md
git commit -m "docs: đánh dấu W1/W2/H2/H3/A2/A3 resolved — Slice 5b hoàn tất"
```
