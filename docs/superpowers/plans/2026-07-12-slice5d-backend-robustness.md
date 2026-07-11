# Slice 5d — Backend Robustness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve M1–M5 (tag ON CONFLICT, allowlist recheck, route shadowing, body-size limit, optimistic locking end-to-end) + transactional outbox chuẩn bị Phase 2.

**Architecture:** Core Go (Gin + GORM, Clean-lite per module) nhận 4 fix độc lập + 1 package platform mới (`outbox`); admin SPA nhận 2 thay đổi nhỏ (URL stats, version + 409 conflict UI). Spec: `docs/superpowers/specs/2026-07-12-slice5d-backend-robustness-design.md`.

**Tech Stack:** Go 1.x (Gin, GORM, scs, Atlas), React (TanStack Query, react-hook-form, Zod), pnpm + Turborepo, Postgres 16.

## Global Constraints

- Comment code bằng tiếng Việt, theo giọng comment sẵn có của repo.
- Test core cần Postgres dev đang chạy (`docker compose up -d` ở gốc repo) và env `TEST_DATABASE_URL=postgres://blog:blog@localhost:5432/blog?sslmode=disable` — pattern tx-rollback, không làm bẩn DB. PowerShell: `$env:TEST_DATABASE_URL = 'postgres://blog:blog@localhost:5432/blog?sslmode=disable'`.
- Chạy test core: `cd services/core; go test ./...`. Chạy test admin: `pnpm --filter @ultimate/admin test -- --run`. Typecheck admin/types: `pnpm --filter @ultimate/admin typecheck` (hoặc `pnpm turbo build`).
- Commit message theo conventional commits như log hiện tại (`fix(core): ...`, `feat(admin): ...`), kết thúc bằng dòng `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- KHÔNG sửa `docs/reviews/2026-07-11-senior-code-review.md` cho tới Task 8 (đánh dấu ✅ một lần khi verify xong).
- Atlas: chạy từ `services/core`, binary là `./atlas.exe`. Diff cần Docker đang chạy (dev DB tạm `docker://postgres/16/dev`).

---

### Task 1: M4 — Body-size limit (middleware `bodylimit` + config + 413)

**Files:**
- Create: `services/core/internal/shared/bodylimit/bodylimit.go`
- Create: `services/core/internal/shared/bodylimit/bodylimit_test.go`
- Modify: `services/core/internal/platform/config/config.go` (thêm `MaxBodyBytes`)
- Modify: `services/core/internal/modules/posts/handler.go` (helper `bindJSON` map 413)
- Modify: `services/core/internal/modules/media/handler.go` (dùng cùng pattern)
- Modify: `services/core/cmd/api/main.go` (wire middleware)
- Modify: `services/core/.env.example` (thêm `MAX_BODY_BYTES` comment)

**Interfaces:**
- Produces: `bodylimit.Middleware(maxBytes int64) gin.HandlerFunc`; `bodylimit.IsTooLarge(err error) bool`; `Config.MaxBodyBytes int64` (env `MAX_BODY_BYTES`, default `2097152`).

- [ ] **Step 1: Viết failing test**

`services/core/internal/shared/bodylimit/bodylimit_test.go`:

```go
package bodylimit

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// newServer dựng engine có limit nhỏ; handler bind JSON và map lỗi như handler thật.
func newServer(limit int64) *gin.Engine {
	r := gin.New()
	r.Use(Middleware(limit))
	r.POST("/x", func(c *gin.Context) {
		var v map[string]any
		if err := c.ShouldBindJSON(&v); err != nil {
			if IsTooLarge(err) {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"code": "PAYLOAD_TOO_LARGE"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY"})
			return
		}
		c.Status(http.StatusOK)
	})
	return r
}

func do(r *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestMiddleware_OverLimit413(t *testing.T) {
	r := newServer(16)
	w := do(r, `{"k":"`+strings.Repeat("a", 100)+`"}`)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413; body=%s", w.Code, w.Body.String())
	}
}

func TestMiddleware_UnderLimitOK(t *testing.T) {
	r := newServer(1024)
	w := do(r, `{"k":"v"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd services/core; go test ./internal/shared/bodylimit/`
Expected: FAIL (compile error — package chưa tồn tại).

- [ ] **Step 3: Implement `bodylimit.go`**

```go
// Package bodylimit giới hạn kích thước body request (M4) — chống client
// (hoặc kẻ tấn công) gửi payload lớn làm cạn RAM/backpressure DB.
package bodylimit

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
)

// Middleware bọc body bằng http.MaxBytesReader; đọc quá maxBytes → lỗi
// *http.MaxBytesError khi handler bind (map sang 413 bằng IsTooLarge).
func Middleware(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

// IsTooLarge cho biết err (từ ShouldBindJSON/io.ReadAll) do body vượt giới hạn.
func IsTooLarge(err error) bool {
	var mbe *http.MaxBytesError
	return errors.As(err, &mbe)
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd services/core; go test ./internal/shared/bodylimit/`
Expected: PASS.

- [ ] **Step 5: Config + wire + map 413 ở posts/media handler**

`config.go` — thêm field vào `Config` (sau khối Storage):

```go
	// Giới hạn body request (M4). Ảnh không đi qua core (presigned PUT) nên
	// 2 MiB thoải mái cho content_html bài dài.
	MaxBodyBytes int64
```

trong `Load()` (sau khối Storage):

```go
		MaxBodyBytes: getInt64Env("MAX_BODY_BYTES", 2<<20),
```

và helper cuối file:

```go
func getInt64Env(key string, fallback int64) int64 {
	v := os.Getenv(key)
	if v == "" {
		return fallback
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
```

`main.go` — sau `r.Use(corsmw.New(...))`:

```go
	r.Use(bodylimit.Middleware(cfg.MaxBodyBytes))
```

(import `"github.com/vule96/ultimate-website/services/core/internal/shared/bodylimit"`.)

`posts/handler.go` — thêm helper (cạnh `respondError`) và thay 2 chỗ `ShouldBindJSON` trong `create`/`update`:

```go
// bindJSON bind body JSON vào dst; lỗi thì tự ghi response (400 hoặc 413) và trả false.
func bindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		if bodylimit.IsTooLarge(err) {
			httperr.Write(c, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "request body too large")
			return false
		}
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return false
	}
	return true
}
```

Trong `create` và `update`:

```go
	var req upsertRequest
	if !bindJSON(c, &req) {
		return
	}
```

`media/handler.go` `presign` — thay khối bind tương tự:

```go
	var req presignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		if bodylimit.IsTooLarge(err) {
			httperr.Write(c, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "request body too large")
			return
		}
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", err.Error())
		return
	}
```

(cả hai handler import package `bodylimit`.)

`.env.example` — thêm dưới khối chung:

```bash
# Giới hạn body request (bytes). Mặc định 2097152 (2 MiB).
# MAX_BODY_BYTES=2097152
```

- [ ] **Step 6: Chạy toàn bộ test core + build**

Run: `cd services/core; go build ./...; go test ./...`
Expected: build OK, PASS toàn bộ (test cũ không đổi hành vi).

- [ ] **Step 7: Commit**

```bash
git add services/core
git commit -m "fix(core): giới hạn body size qua http.MaxBytesReader, map 413 (M4)"
```

---

### Task 2: M2 — RequireAuth re-check allowlist mỗi request

**Files:**
- Modify: `services/core/internal/modules/auth/middleware.go`
- Create: `services/core/internal/modules/auth/middleware_test.go`
- Modify: `services/core/cmd/api/main.go` (tách biến `allowlist`, đổi call-site)

**Interfaces:**
- Consumes: `auth.Allowlist.IsAllowed(email string) bool` (sẵn có).
- Produces: chữ ký mới `auth.RequireAuth(sm *scs.SessionManager, allowlist *Allowlist) gin.HandlerFunc`.

- [ ] **Step 1: Viết failing test**

`services/core/internal/modules/auth/middleware_test.go`:

```go
package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// newAuthServer dựng server có route login giả (đặt email vào session) và
// route protected sau RequireAuth với allowlist cho trước.
func newAuthServer(allowlistCSV, loginEmail string) http.Handler {
	sm := scs.New() // MemStore mặc định — đủ cho test middleware
	r := gin.New()
	r.POST("/fake-login", func(c *gin.Context) {
		sm.Put(c.Request.Context(), sessionKeyAdminEmail, loginEmail)
		c.Status(http.StatusNoContent)
	})
	protected := r.Group("", RequireAuth(sm, NewAllowlist(allowlistCSV)))
	protected.GET("/secret", func(c *gin.Context) { c.Status(http.StatusOK) })
	return sm.LoadAndSave(r)
}

// loginAndGet login lấy cookie rồi GET /secret bằng cookie đó, trả response.
func loginAndGet(t *testing.T, h http.Handler) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/fake-login", nil))
	cookie := rec.Header().Get("Set-Cookie")
	if cookie == "" {
		t.Fatal("expected session cookie from fake-login")
	}
	req := httptest.NewRequest(http.MethodGet, "/secret", nil)
	req.Header.Set("Cookie", cookie)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req)
	return rec2
}

func TestRequireAuth_AllowedEmailPasses(t *testing.T) {
	h := newAuthServer("admin@example.com", "admin@example.com")
	if w := loginAndGet(t, h); w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestRequireAuth_RemovedEmail401AndDestroysSession(t *testing.T) {
	// Email có session sống nhưng KHÔNG còn trong allowlist → 401 (M2).
	h := newAuthServer("still@example.com", "gone@example.com")
	if w := loginAndGet(t, h); w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}

func TestRequireAuth_NoSession401(t *testing.T) {
	h := newAuthServer("admin@example.com", "admin@example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/secret", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd services/core; go test ./internal/modules/auth/`
Expected: FAIL — compile error (`RequireAuth` chưa nhận allowlist).

- [ ] **Step 3: Sửa `RequireAuth`**

`middleware.go` — thay hàm `RequireAuth`:

```go
// RequireAuth chặn request nếu chưa đăng nhập, và re-check allowlist mỗi request
// (M2): email bị gỡ khỏi ADMIN_ALLOWLIST thì session mất hiệu lực ngay (destroy),
// không phải đợi hết hạn 7 ngày.
func RequireAuth(sm *scs.SessionManager, allowlist *Allowlist) gin.HandlerFunc {
	return func(c *gin.Context) {
		ctx := c.Request.Context()
		email := sm.GetString(ctx, sessionKeyAdminEmail)
		if email == "" {
			httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
			c.Abort()
			return
		}
		if !allowlist.IsAllowed(email) {
			_ = sm.Destroy(ctx) // session không còn giá trị; lỗi destroy không chặn việc trả 401
			httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "email no longer permitted")
			c.Abort()
			return
		}
		c.Next()
	}
}
```

`cmd/api/main.go` — tách allowlist dùng chung và đổi call-site:

```go
	allowlist := auth.NewAllowlist(cfg.AdminAllowlist)
	authSvc := auth.NewService(provider, allowlist)
	...
	writeMW := []gin.HandlerFunc{jsonmw.RequireJSON(), auth.RequireAuth(sm, allowlist)}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd services/core; go build ./...; go test ./internal/modules/auth/ ./...`
Expected: PASS toàn bộ.

- [ ] **Step 5: Commit**

```bash
git add services/core
git commit -m "fix(auth): RequireAuth re-check allowlist mỗi request, destroy session khi email bị gỡ (M2)"
```

---

### Task 3: M3 — Dời stats routes sang `/stats/posts` (core + admin)

**Files:**
- Modify: `services/core/internal/modules/posts/handler.go:40-41` (routes)
- Modify: `services/core/internal/modules/posts/handler_test.go` (URL trong test stats sẵn có + test shadowing mới)
- Modify: `apps/admin/src/features/posts/api.ts:64,68`
- Modify: `apps/admin/src/features/posts/api.test.ts` (URL assertions nếu có)

**Interfaces:**
- Produces: `GET /api/v1/stats/posts`, `GET /api/v1/stats/posts/timeseries` (sau protectedMW); `GET /api/v1/posts/:slug` không còn bị che.

- [ ] **Step 1: Viết failing test (core)**

Thêm vào `posts/handler_test.go`:

```go
func TestHandler_StatsNewRoute(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodGet, "/api/v1/stats/posts", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /stats/posts = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodGet, "/api/v1/stats/posts/timeseries?months=3", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /stats/posts/timeseries = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_PostSlugStatsNotShadowed(t *testing.T) {
	// M3: bài viết slug "stats" phải xem được qua /posts/stats (không bị route tĩnh che).
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{
		"title": "Stats", "slug": "stats", "status": "PUBLISHED",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create = %d; body=%s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodGet, "/api/v1/posts/stats", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /posts/stats = %d, want 200 (bài viết); body=%s", w.Code, w.Body.String())
	}
	if decode(t, w)["title"] != "Stats" {
		t.Errorf("expected bài viết 'Stats', got %s", w.Body.String())
	}
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd services/core; go test ./internal/modules/posts/ -run "StatsNewRoute|NotShadowed"`
Expected: FAIL — `/stats/posts` 404; `/posts/stats` trả stats JSON (không có `title`).

- [ ] **Step 3: Đổi route trong `RegisterRoutes`**

```go
	protected := rg.Group("", protectedMW...)
	// Aggregate endpoints tách namespace /stats — tránh route tĩnh che slug bài viết (M3).
	protected.GET("/stats/posts", h.stats)
	protected.GET("/stats/posts/timeseries", h.timeseries)
	protected.POST("/posts", h.create)
	protected.PUT("/posts/:id", h.update)
	protected.DELETE("/posts/:id", h.delete)
```

Sửa mọi test cũ trong `handler_test.go` đang gọi `/api/v1/posts/stats*` sang URL mới (grep `posts/stats`).

- [ ] **Step 4: Chạy test core, xác nhận pass**

Run: `cd services/core; go test ./internal/modules/posts/`
Expected: PASS.

- [ ] **Step 5: Đổi URL ở admin + test admin**

`apps/admin/src/features/posts/api.ts`:

```ts
export function fetchStats(): Promise<PostStats> {
  return apiFetch("/api/v1/stats/posts", PostStatsSchema);
}

export function fetchTimeseries(months = 8): Promise<PostTimeseries> {
  return apiFetch(`/api/v1/stats/posts/timeseries?months=${months}`, PostTimeseriesSchema);
}
```

Nếu `api.test.ts` assert URL cũ → cập nhật cùng giá trị mới.

Run: `pnpm --filter @ultimate/admin test -- --run`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add services/core apps/admin
git commit -m "fix(core,admin): dời stats routes sang /stats/posts — hết shadowing slug (M3)"
```

---

### Task 4: M1 — Tag upsert batch `ON CONFLICT`

**Files:**
- Modify: `services/core/internal/modules/posts/repository.go:269-282` (`upsertTags`)
- Modify: `services/core/internal/modules/posts/repository_test.go` (test mới)

**Interfaces:**
- Produces: `upsertTags(tx *gorm.DB, tags []Tag) ([]gormTag, error)` — chữ ký giữ nguyên, atomic, không còn gọi `translateErr` (scope `translateErr` từ nay chỉ còn ở insert/update post).

- [ ] **Step 1: Viết failing test**

Thêm vào `repository_test.go`:

```go
func TestRepository_SharedTagSingleRow(t *testing.T) {
	// M1: 2 post cùng dùng một tag mới → chỉ 1 dòng tag, ID nhất quán.
	repo := newRepoTx(t)
	ctx := context.Background()

	p1 := samplePost("Bài 1", "bai-1", StatusDraft, "Go")
	if err := repo.Create(ctx, p1); err != nil {
		t.Fatalf("create p1: %v", err)
	}
	p2 := samplePost("Bài 2", "bai-2", StatusDraft, "Go")
	if err := repo.Create(ctx, p2); err != nil {
		t.Fatalf("create p2: %v", err)
	}

	if p1.Tags[0].ID != p2.Tags[0].ID {
		t.Errorf("tag ID không nhất quán: %s vs %s", p1.Tags[0].ID, p2.Tags[0].ID)
	}
	var count int64
	if err := repo.db.Model(&gormTag{}).Where("slug = ?", "go").Count(&count).Error; err != nil {
		t.Fatalf("count tags: %v", err)
	}
	if count != 1 {
		t.Errorf("tag rows = %d, want 1", count)
	}
}

func TestRepository_UpsertTagsEmptyNoop(t *testing.T) {
	repo := newRepoTx(t)
	got, err := upsertTags(repo.db, nil)
	if err != nil {
		t.Fatalf("upsertTags(nil): %v", err)
	}
	if len(got) != 0 {
		t.Errorf("want empty, got %d", len(got))
	}
}
```

(Lưu ý: `samplePost` là helper sẵn có trong file; nếu chữ ký khác `(title, slug, status, tags...)` thì chỉnh call cho khớp — xem `repository_test.go:47`.)

- [ ] **Step 2: Chạy test, xác nhận trạng thái**

Run: `cd services/core; go test ./internal/modules/posts/ -run "SharedTag|UpsertTagsEmpty"`
Expected: `SharedTagSingleRow` có thể PASS với code cũ (FirstOrCreate tuần tự vẫn đúng khi không concurrent) — đây là **regression guard**; điểm chính của task là đổi cơ chế sang atomic. Ghi nhận kết quả rồi qua Step 3.

- [ ] **Step 3: Thay `upsertTags`**

```go
// upsertTags đảm bảo mỗi tag tồn tại (theo slug) và trả về bản ghi có ID.
// Batch INSERT ... ON CONFLICT (slug) DO UPDATE — atomic (M1): concurrent save
// không còn dính unique-violation race, và chỉ 1 round-trip cho mọi tag.
// DO UPDATE (thay vì DO NOTHING) để RETURNING trả id cả với dòng đã tồn tại.
func upsertTags(tx *gorm.DB, tags []Tag) ([]gormTag, error) {
	if len(tags) == 0 {
		return nil, nil
	}
	gts := make([]gormTag, len(tags))
	for i, t := range tags {
		gts[i] = gormTag{Name: t.Name, Slug: t.Slug}
	}
	err := tx.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "slug"}},
		DoUpdates: clause.AssignmentColumns([]string{"name"}),
	}).Create(&gts).Error
	if err != nil {
		// Không translateErr ở đây: unique-violation của TAG không phải SLUG_TAKEN
		// của post (đó là bug M1 cũ). Lỗi hiếm còn lại (vd trùng name khác slug)
		// trả nguyên trạng → 500 có log, không đánh lừa client bằng 409.
		return nil, err
	}
	return gts, nil
}
```

- [ ] **Step 4: Chạy test, xác nhận pass**

Run: `cd services/core; go test ./internal/modules/posts/`
Expected: PASS toàn bộ (gồm test tag/CRUD sẵn có).

- [ ] **Step 5: Commit**

```bash
git add services/core
git commit -m "fix(posts): upsert tag batch ON CONFLICT, bỏ translateErr khỏi tag path (M1)"
```

---

### Task 5: M5 core — Optimistic locking (`version` + 409) + migration

**Files:**
- Modify: `services/core/internal/modules/posts/domain.go` (`Post.Version`, `ErrVersionConflict`)
- Modify: `services/core/internal/modules/posts/repository.go` (`gormPost.Version`, `Update` có điều kiện, mappers)
- Modify: `services/core/internal/modules/posts/service.go` (`UpdateInput.Version`, truyền vào existing)
- Modify: `services/core/internal/modules/posts/handler.go` (DTO version, validate, map 409)
- Modify: `services/core/internal/modules/posts/repository_test.go`, `service_test.go`, `handler_test.go`
- Create: `services/core/migrations/<timestamp>_add_post_version.sql` (Atlas sinh)

**Interfaces:**
- Produces: `Post.Version int64`; `ErrVersionConflict`; `UpdateInput.Version int64`; PUT `/posts/:id` yêu cầu body `version >= 1` (thiếu → 400 `VALIDATION_ERROR`), conflict → 409 `VERSION_CONFLICT`; mọi response post có field `version`.
- Consumes: Task 4 `upsertTags` (chữ ký không đổi).

- [ ] **Step 1: Viết failing test repo**

Thêm vào `repository_test.go`:

```go
func TestRepository_UpdateVersionConflict(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	p := samplePost("Bài A", "bai-a", StatusDraft)
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}
	if p.Version != 1 {
		t.Fatalf("version sau create = %d, want 1", p.Version)
	}

	// Update với version đúng → OK, version tăng.
	p.Title = "Bài A sửa"
	if err := repo.Update(ctx, p); err != nil {
		t.Fatalf("update: %v", err)
	}
	if p.Version != 2 {
		t.Errorf("version sau update = %d, want 2", p.Version)
	}

	// Update với version cũ (stale) → ErrVersionConflict.
	stale := *p
	stale.Version = 1
	if err := repo.Update(ctx, &stale); !errors.Is(err, ErrVersionConflict) {
		t.Errorf("stale update err = %v, want ErrVersionConflict", err)
	}
}

func TestRepository_UpdateNotFoundStillNotFound(t *testing.T) {
	repo := newRepoTx(t)
	p := samplePost("Ma", "ma", StatusDraft)
	p.ID = uuid.New()
	p.Version = 1
	if err := repo.Update(context.Background(), p); !errors.Is(err, ErrPostNotFound) {
		t.Errorf("err = %v, want ErrPostNotFound", err)
	}
}
```

(import thêm `"github.com/google/uuid"` nếu file chưa có.)

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd services/core; go test ./internal/modules/posts/ -run "VersionConflict|NotFoundStill"`
Expected: FAIL — `ErrVersionConflict` undefined.

- [ ] **Step 3: Implement domain + repo**

`domain.go` — thêm vào struct `Post` (sau `PublishedAt`): `Version int64`; thêm lỗi:

```go
	// ErrVersionConflict: update với version cũ — bài đã bị writer khác sửa (M5).
	ErrVersionConflict = errors.New("post version conflict")
```

`repository.go`:

- `gormPost` thêm (sau `PublishedAt`): `Version int64 \`gorm:"not null;default:1"\``
- `toGormModel`: thêm `Version: p.Version,`
- `toDomain`: thêm `Version: gp.Version,`
- `applyGenerated`: thêm `p.Version = gp.Version`
- `Create`: sau `gp := toGormModel(p); gp.Tags = nil` thêm:

```go
		if gp.Version == 0 {
			gp.Version = 1
		}
```

- Thay toàn bộ `Update`:

```go
// Update ghi đè bài viết theo ID + thay toàn bộ tags, với optimistic locking (M5):
// chỉ ghi khi version trong DB khớp version client đang cầm; lệch → ErrVersionConflict.
func (r *GormRepository) Update(ctx context.Context, p *Post) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		gp := toGormModel(p)
		// Updates bằng map để không bỏ sót zero-value (vd xoá excerpt → nil).
		res := tx.Model(&gormPost{}).
			Where("id = ? AND version = ?", p.ID, p.Version).
			Updates(map[string]any{
				"title":        gp.Title,
				"slug":         gp.Slug,
				"content_json": gp.ContentJSON,
				"content_html": gp.ContentHTML,
				"excerpt":      gp.Excerpt,
				"cover_image":  gp.CoverImage,
				"status":       gp.Status,
				"meta_title":   gp.MetaTitle,
				"meta_desc":    gp.MetaDesc,
				"published_at": gp.PublishedAt,
				"version":      gorm.Expr("version + 1"),
			})
		if res.Error != nil {
			return translateErr(res.Error)
		}
		if res.RowsAffected == 0 {
			// Phân biệt not-found vs version lệch.
			var count int64
			if err := tx.Model(&gormPost{}).Where("id = ?", p.ID).Count(&count).Error; err != nil {
				return err
			}
			if count == 0 {
				return ErrPostNotFound
			}
			return ErrVersionConflict
		}
		tags, err := upsertTags(tx, p.Tags)
		if err != nil {
			return err
		}
		if err := tx.Model(&gormPost{ID: p.ID}).Association("Tags").Replace(tags); err != nil {
			return err
		}
		// Nạp lại giá trị DB sinh ra (updated_at, version mới) về domain.
		var fresh gormPost
		if err := tx.First(&fresh, "id = ?", p.ID).Error; err != nil {
			return err
		}
		applyGenerated(p, fresh, tags)
		return nil
	})
}
```

- [ ] **Step 4: Chạy test repo, xác nhận pass**

Run: `cd services/core; go test ./internal/modules/posts/ -run Repository`
Expected: PASS (AutoMigrate trong `TestMain` tự thêm cột `version` vào DB test).

- [ ] **Step 5: Service + handler (test trước)**

Thêm vào `handler_test.go`:

```go
func TestHandler_UpdateRequiresVersion(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "V Post"})
	id := decode(t, w)["id"].(string)

	// Thiếu version → 400.
	w = doJSON(t, r, http.MethodPut, "/api/v1/posts/"+id, map[string]any{"title": "V Post 2"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("update thiếu version = %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_UpdateVersionConflict409(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "C Post"})
	body := decode(t, w)
	id := body["id"].(string)
	if body["version"].(float64) != 1 {
		t.Fatalf("version sau create = %v, want 1", body["version"])
	}

	// Lần 1 với version 1 → OK, version thành 2.
	w = doJSON(t, r, http.MethodPut, "/api/v1/posts/"+id, map[string]any{"title": "C Post x", "version": 1})
	if w.Code != http.StatusOK {
		t.Fatalf("update 1 = %d; body=%s", w.Code, w.Body.String())
	}
	if decode(t, w)["version"].(float64) != 2 {
		t.Errorf("version sau update = %v, want 2", decode(t, w)["version"])
	}

	// Lần 2 vẫn gửi version 1 (stale) → 409 VERSION_CONFLICT.
	w = doJSON(t, r, http.MethodPut, "/api/v1/posts/"+id, map[string]any{"title": "C Post y", "version": 1})
	if w.Code != http.StatusConflict {
		t.Fatalf("stale update = %d, want 409; body=%s", w.Code, w.Body.String())
	}
	errObj := decode(t, w)["error"].(map[string]any)
	if errObj["code"] != "VERSION_CONFLICT" {
		t.Errorf("code = %v, want VERSION_CONFLICT", errObj["code"])
	}
}
```

Run: `cd services/core; go test ./internal/modules/posts/ -run "RequiresVersion|Conflict409"` → FAIL.

Implement:

`service.go` — `UpdateInput` thêm field `Version int64` (cuối struct, comment `// optimistic locking (M5)`); trong `Service.Update`, sau `existing.Tags = normalizeTags(in.TagNames)` thêm:

```go
	// M5: version phải là bản client đang cầm (không phải bản vừa GetByID) —
	// repo dùng nó làm điều kiện WHERE để phát hiện lost-update.
	existing.Version = in.Version
```

`handler.go`:

- `upsertRequest` thêm: `Version int64 \`json:"version"\`` (comment `// bắt buộc với update (M5); create bỏ qua`)
- `postResponse` thêm: `Version int64 \`json:"version"\``; `toResponse` thêm `Version: p.Version,`
- `update` handler, sau bind + trước gọi svc:

```go
	if req.Version < 1 {
		httperr.Write(c, http.StatusBadRequest, "VALIDATION_ERROR", "version is required for update")
		return
	}
```

  và thêm `Version: req.Version,` vào `UpdateInput{...}`.
- `respondError` thêm case (trước default):

```go
	case errors.Is(err, ErrVersionConflict):
		httperr.Write(c, http.StatusConflict, "VERSION_CONFLICT", "post was modified by someone else")
```

Sửa các test PUT sẵn có trong `handler_test.go` + `service_test.go` (nếu có test Update): thêm `"version": 1` (hoặc `Version: existing.Version`) cho khớp yêu cầu mới.

- [ ] **Step 6: Chạy toàn bộ test core**

Run: `cd services/core; go test ./...`
Expected: PASS toàn bộ.

- [ ] **Step 7: Sinh + apply migration Atlas**

```powershell
cd services/core
./atlas.exe migrate diff add_post_version --env gorm
./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"
```

Expected: migration mới trong `services/core/migrations/` chứa `ALTER TABLE "posts" ADD COLUMN "version" bigint NOT NULL DEFAULT 1`; apply OK. (Nếu diff phát sinh thay đổi ngoài ý muốn — dừng lại xem xét trước khi apply.)

- [ ] **Step 8: Commit**

```bash
git add services/core
git commit -m "feat(posts): optimistic locking — cột version, 409 VERSION_CONFLICT (M5 core)"
```

---

### Task 6: M5 admin FE — gửi `version`, 409 → conflict banner + tải lại

**Files:**
- Modify: `packages/types/src/index.ts` (`PostSchema.version`, `UpsertPostInput.version`)
- Modify: `apps/admin/src/features/posts/PostFormPage.tsx`
- Modify: `apps/admin/src/features/posts/PostFormPage.test.tsx` (+ fixtures các test khác dùng `Post`)

**Interfaces:**
- Consumes: PUT `/posts/:id` yêu cầu `version`; 409 body `{error:{code:"VERSION_CONFLICT"}}`; `ApiError.code` (sẵn có ở `apiClient.ts`).
- Produces: `PostSchema` có `version: number`; `UpsertPostInput` có `version?: number`.

- [ ] **Step 1: Types**

`packages/types/src/index.ts`:

- `PostSchema` thêm (sau `published_at`): `version: z.number().int(),`
- `UpsertPostInput`: thêm vào object literal `version: number;` (comment `/** Optimistic locking (M5): bắt buộc khi update; create bỏ qua. */`) và thêm `"version"` vào danh sách `SetOptional`.

- [ ] **Step 2: Cập nhật fixtures → test admin xanh trở lại**

Mọi fixture/mock `Post` trong test admin (grep `content_html` trong `apps/admin/src/**/*.test.*` để tìm) thêm `version: 1`.

Run: `pnpm --filter @ultimate/admin test -- --run; pnpm --filter @ultimate/admin typecheck`
Expected: typecheck FAIL tại `PostFormPage` chưa gửi version? — KHÔNG (version optional trong input). Test PASS, typecheck PASS. Nếu fixture nào thiếu `version` → Zod parse fail trong test → bổ sung.

- [ ] **Step 3: Viết failing test cho form**

`PostFormPage.test.tsx` — file đã có harness mock `./queries` qua `vi.hoisted` (`mocks.usePostQuery/createMutate/updateMutate`) + fixture `basePost`. Sửa/thêm:

1. Thêm `refetch: vi.fn()` vào object `vi.hoisted`:

```tsx
const mocks = vi.hoisted(() => ({
  usePostQuery: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  refetch: vi.fn(),
}));
```

2. Import thêm `ApiError`:

```tsx
import { ApiError } from "@/lib/apiClient";
```

3. Thêm describe mới cuối file:

```tsx
describe("PostFormPage — optimistic locking (M5)", () => {
  it("gửi version của bản đã load khi update", async () => {
    mocks.usePostQuery.mockReturnValue({
      data: { ...basePost, version: 3 } as unknown as Post,
      isPending: false,
      isError: false,
      refetch: mocks.refetch,
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled());
    const [vars] = mocks.updateMutate.mock.calls[0] as [{ id: string; input: { version?: number } }];
    expect(vars.input.version).toBe(3);
  });

  it("409 VERSION_CONFLICT → banner conflict + nút tải lại gọi refetch", async () => {
    mocks.usePostQuery.mockReturnValue({
      data: basePost,
      isPending: false,
      isError: false,
      refetch: mocks.refetch,
    });
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));
    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled());

    // Mô phỏng server trả 409: gọi onError mà component truyền vào mutate.
    const [, opts] = mocks.updateMutate.mock.calls[0] as [
      unknown,
      { onError: (e: unknown) => void },
    ];
    opts.onError(new ApiError(409, "VERSION_CONFLICT", "post was modified by someone else"));

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Bài đã bị sửa ở nơi khác");

    fireEvent.click(screen.getByRole("button", { name: "Tải bản mới nhất" }));
    expect(mocks.refetch).toHaveBeenCalled();
  });
});
```

(Fixture `basePost` đã có `version: 1` từ Step 2. Lưu ý: `ToastProvider` cũng render `role="alert"` cho toast — nếu `findByRole("alert")` khớp nhiều phần tử, dùng `findAllByRole` và tìm phần tử chứa text conflict.)

Run: `pnpm --filter @ultimate/admin test -- --run PostFormPage`
Expected: FAIL (chưa có version + banner).

- [ ] **Step 4: Implement `PostFormPage.tsx`**

Thay đổi (giữ nguyên phần còn lại):

```tsx
const [conflict, setConflict] = useState(false);
// Đổi key để remount editor khi nạp lại bản mới (editor uncontrolled, chỉ đọc initialHtml lúc mount).
const [editorKey, setEditorKey] = useState(0);
```

Trong `onSubmit`, thay `onError`:

```tsx
const onError = (err: unknown) => {
  if (err instanceof ApiError && err.code === "VERSION_CONFLICT") {
    setConflict(true); // M5: bài đã bị sửa ở nơi khác — không đè, cho user chọn tải lại
    return;
  }
  setFormError(err instanceof ApiError ? err.message : "Lưu bài viết thất bại.");
};
```

Update mutation gửi version:

```tsx
updateMutation.mutate(
  { id: loaded.id, input: { ...input, version: loaded.version } },
  { onSuccess: ..., onError },
);
```

Hàm tải lại + banner (đặt banner cạnh khối `formError`):

```tsx
function reloadLatest() {
  setConflict(false);
  hasHydratedRef.current = false;   // cho phép hydrate lại từ data mới
  initialHtmlRef.current = null;    // chốt lại HTML editor theo bản mới
  setEditorKey((k) => k + 1);       // remount editor với initialHtml mới
  void postQuery.refetch();
}
```

```tsx
{conflict && (
  <div
    role="alert"
    className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-50 p-3 text-sm text-amber-800"
  >
    <span>Bài đã bị sửa ở nơi khác — thay đổi của bạn chưa được lưu.</span>
    <Button type="button" variant="outline" size="sm" onClick={reloadLatest}>
      Tải bản mới nhất
    </Button>
  </div>
)}
```

`EditorSwitch` thêm `key={editorKey}`.

- [ ] **Step 5: Chạy test + typecheck**

Run: `pnpm --filter @ultimate/admin test -- --run; pnpm --filter @ultimate/admin typecheck`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add packages/types apps/admin
git commit -m "feat(admin): gửi version khi update, 409 VERSION_CONFLICT → banner + tải lại (M5 FE)"
```

---

### Task 7: Outbox — bảng + writer trong transaction + dispatcher poll

**Files:**
- Create: `services/core/internal/platform/outbox/outbox.go` (model + `Write`)
- Create: `services/core/internal/platform/outbox/dispatcher.go`
- Create: `services/core/internal/platform/outbox/outbox_test.go`
- Modify: `services/core/internal/modules/posts/repository.go` (ghi event trong `Create`/`Update`/`Delete`)
- Modify: `services/core/internal/modules/posts/repository_test.go` (`TestMain` AutoMigrate + test event)
- Modify: `services/core/cmd/atlas-loader/main.go` (đăng ký model)
- Modify: `services/core/cmd/api/main.go` (chạy dispatcher)
- Create: `services/core/migrations/<timestamp>_add_outbox.sql` (Atlas sinh)

**Interfaces:**
- Produces: `outbox.Event` (fields: `ID uuid.UUID, Aggregate string, AggregateID uuid.UUID, EventType string, Payload datatypes.JSON, CreatedAt time.Time, ProcessedAt *time.Time`); `outbox.Write(tx *gorm.DB, aggregate string, aggregateID uuid.UUID, eventType string, payload any) error`; `outbox.Models() []any`; `outbox.NewDispatcher(db *gorm.DB, h Handler, log *slog.Logger, interval time.Duration) *Dispatcher` với `Run(ctx)`; `outbox.Handler` interface `Handle(ctx context.Context, e Event) error`; `outbox.LogHandler{Log *slog.Logger}`.
- Consumes: transaction sẵn có trong posts repo (Task 5 `Update` đã bọc tx).

- [ ] **Step 1: Viết failing test outbox package**

`services/core/internal/platform/outbox/outbox_test.go`:

```go
package outbox

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"

	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
)

var testDB *gorm.DB

func TestMain(m *testing.M) {
	if dsn := os.Getenv("TEST_DATABASE_URL"); dsn != "" {
		db, err := database.Open(dsn, false)
		if err != nil {
			fmt.Println("cannot connect TEST_DATABASE_URL:", err)
			os.Exit(1)
		}
		if err := db.AutoMigrate(&Event{}); err != nil {
			fmt.Println("automigrate failed:", err)
			os.Exit(1)
		}
		db.Logger = gormlogger.Default.LogMode(gormlogger.Silent)
		testDB = db
	}
	os.Exit(m.Run())
}

// newTx trả *gorm.DB trong transaction rollback sau test (không bẩn DB).
func newTx(t *testing.T) *gorm.DB {
	t.Helper()
	if testDB == nil {
		t.Skip("set TEST_DATABASE_URL to run outbox integration tests")
	}
	tx := testDB.Begin()
	t.Cleanup(func() { tx.Rollback() })
	return tx
}

// fakeHandler ghi lại event nhận được; failN lần đầu trả lỗi.
type fakeHandler struct {
	got   []Event
	failN int
}

func (f *fakeHandler) Handle(_ context.Context, e Event) error {
	if f.failN > 0 {
		f.failN--
		return fmt.Errorf("boom")
	}
	f.got = append(f.got, e)
	return nil
}

func TestWrite_InsertsEvent(t *testing.T) {
	tx := newTx(t)
	id := uuid.New()
	if err := Write(tx, "post", id, "post.created", map[string]any{"slug": "x"}); err != nil {
		t.Fatalf("Write: %v", err)
	}
	var e Event
	if err := tx.First(&e, "aggregate_id = ?", id).Error; err != nil {
		t.Fatalf("find event: %v", err)
	}
	if e.EventType != "post.created" || e.ProcessedAt != nil {
		t.Errorf("event = %+v", e)
	}
}

func TestDispatcher_ProcessesAndMarks(t *testing.T) {
	tx := newTx(t)
	id := uuid.New()
	_ = Write(tx, "post", id, "post.updated", map[string]any{"slug": "y"})

	h := &fakeHandler{}
	d := NewDispatcher(tx, h, slog.New(slog.NewTextHandler(os.Stderr, nil)), time.Second)
	d.dispatchPending(context.Background())

	if len(h.got) != 1 || h.got[0].AggregateID != id {
		t.Fatalf("handler got %+v", h.got)
	}
	var e Event
	_ = tx.First(&e, "aggregate_id = ?", id).Error
	if e.ProcessedAt == nil {
		t.Error("expected processed_at set")
	}
}

func TestDispatcher_HandlerErrorKeepsEvent(t *testing.T) {
	tx := newTx(t)
	id := uuid.New()
	_ = Write(tx, "post", id, "post.updated", map[string]any{"slug": "z"})

	h := &fakeHandler{failN: 1}
	d := NewDispatcher(tx, h, slog.New(slog.NewTextHandler(os.Stderr, nil)), time.Second)
	d.dispatchPending(context.Background())

	var e Event
	_ = tx.First(&e, "aggregate_id = ?", id).Error
	if e.ProcessedAt != nil {
		t.Error("event lỗi phải được giữ lại (processed_at NULL) để retry")
	}
	// Vòng poll sau: handler hết lỗi → xử lý được.
	d.dispatchPending(context.Background())
	_ = tx.First(&e, "aggregate_id = ?", id).Error
	if e.ProcessedAt == nil {
		t.Error("expected processed_at set sau retry")
	}
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `cd services/core; go test ./internal/platform/outbox/`
Expected: FAIL — package chưa tồn tại.

- [ ] **Step 3: Implement `outbox.go` + `dispatcher.go`**

`outbox.go`:

```go
// Package outbox cài transactional outbox pattern (chuẩn bị Phase 2):
// module nghiệp vụ ghi event vào bảng outbox TRONG CÙNG transaction với write —
// không bao giờ có chuyện DB đã đổi mà event bị mất (crash giữa chừng).
// Consumer (Phase 2: AI worker index RAG) poll bảng này qua Dispatcher/trực tiếp.
package outbox

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

// Event là một bản ghi outbox — "lá thư chưa gửi" cho consumer.
type Event struct {
	ID          uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey"`
	Aggregate   string         `gorm:"not null"` // vd "post"
	AggregateID uuid.UUID      `gorm:"type:uuid;not null"`
	EventType   string         `gorm:"not null"` // vd "post.created"
	Payload     datatypes.JSON `gorm:"type:jsonb;not null"`
	CreatedAt   time.Time      `gorm:"not null;default:now();index:idx_outbox_unprocessed,where:processed_at IS NULL"`
	ProcessedAt *time.Time
}

func (Event) TableName() string { return "outbox" }

// Models trả về GORM model cho công cụ migration (Atlas loader).
func Models() []any { return []any{&Event{}} }

// Write ghi 1 event bằng chính tx đang mở — PHẢI gọi trong cùng transaction
// với write nghiệp vụ để giữ tính atomic của outbox pattern.
func Write(tx *gorm.DB, aggregate string, aggregateID uuid.UUID, eventType string, payload any) error {
	raw, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	return tx.Create(&Event{
		Aggregate:   aggregate,
		AggregateID: aggregateID,
		EventType:   eventType,
		Payload:     datatypes.JSON(raw),
	}).Error
}
```

`dispatcher.go`:

```go
package outbox

import (
	"context"
	"log/slog"
	"time"

	"gorm.io/gorm"
)

// Handler xử lý một event outbox. Trả error → event được giữ lại, retry vòng poll sau.
type Handler interface {
	Handle(ctx context.Context, e Event) error
}

// LogHandler là handler mặc định khi chưa có consumer thật (Phase 2 thay bằng
// handler đẩy queue, hoặc AI worker poll thẳng bảng và tắt dispatcher).
type LogHandler struct{ Log *slog.Logger }

// Handle log event ra slog.
func (h LogHandler) Handle(_ context.Context, e Event) error {
	h.Log.Info("outbox event", "id", e.ID, "aggregate", e.Aggregate,
		"aggregate_id", e.AggregateID, "event_type", e.EventType)
	return nil
}

// Dispatcher poll bảng outbox định kỳ, giao event chưa xử lý cho Handler.
// Deployment hiện tại single-instance nên chưa cần FOR UPDATE SKIP LOCKED —
// thêm khi scale ngang (Phase 2+).
type Dispatcher struct {
	db       *gorm.DB
	handler  Handler
	log      *slog.Logger
	interval time.Duration
	batch    int
}

// NewDispatcher tạo Dispatcher với batch mặc định 50 event/vòng.
func NewDispatcher(db *gorm.DB, h Handler, log *slog.Logger, interval time.Duration) *Dispatcher {
	return &Dispatcher{db: db, handler: h, log: log, interval: interval, batch: 50}
}

// Run poll cho tới khi ctx bị huỷ (gắn vào ctx graceful-shutdown của server —
// event chưa xử lý nằm lại DB, không mất).
func (d *Dispatcher) Run(ctx context.Context) {
	t := time.NewTicker(d.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			d.dispatchPending(ctx)
		}
	}
}

// dispatchPending xử lý một batch event chưa processed, cũ trước.
func (d *Dispatcher) dispatchPending(ctx context.Context) {
	var events []Event
	err := d.db.WithContext(ctx).
		Where("processed_at IS NULL").
		Order("created_at ASC").
		Limit(d.batch).
		Find(&events).Error
	if err != nil {
		d.log.Error("outbox: fetch pending failed", "err", err)
		return
	}
	for _, e := range events {
		if err := d.handler.Handle(ctx, e); err != nil {
			d.log.Error("outbox: handle failed — giữ lại retry", "id", e.ID, "err", err)
			continue
		}
		now := time.Now()
		if err := d.db.WithContext(ctx).Model(&Event{}).
			Where("id = ?", e.ID).Update("processed_at", now).Error; err != nil {
			d.log.Error("outbox: mark processed failed", "id", e.ID, "err", err)
		}
	}
}
```

Run: `cd services/core; go test ./internal/platform/outbox/` → Expected: PASS.

- [ ] **Step 4: Failing test — posts repo ghi event**

`repository_test.go`: sửa `TestMain` AutoMigrate thành:

```go
		if err := db.AutoMigrate(&gormPost{}, &gormTag{}, &outbox.Event{}); err != nil {
```

(import `"github.com/vule96/ultimate-website/services/core/internal/platform/outbox"`.)

Thêm test:

```go
// outboxEvents đọc event outbox của một post trong tx của repo.
func outboxEvents(t *testing.T, repo *GormRepository, id uuid.UUID) []outbox.Event {
	t.Helper()
	var evs []outbox.Event
	if err := repo.db.Order("created_at ASC").Find(&evs, "aggregate_id = ?", id).Error; err != nil {
		t.Fatalf("find outbox: %v", err)
	}
	return evs
}

func TestRepository_OutboxEvents(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	p := samplePost("Sự kiện", "su-kien", StatusPublished)
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}
	evs := outboxEvents(t, repo, p.ID)
	if len(evs) != 1 || evs[0].EventType != "post.created" {
		t.Fatalf("sau create: %+v", evs)
	}

	p.Title = "Sự kiện 2"
	if err := repo.Update(ctx, p); err != nil {
		t.Fatalf("update: %v", err)
	}
	evs = outboxEvents(t, repo, p.ID)
	if len(evs) != 2 || evs[1].EventType != "post.updated" {
		t.Fatalf("sau update: %+v", evs)
	}

	if err := repo.Delete(ctx, p.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	evs = outboxEvents(t, repo, p.ID)
	if len(evs) != 3 || evs[2].EventType != "post.deleted" {
		t.Fatalf("sau delete: %+v", evs)
	}
}

func TestRepository_NoEventWhenCreateFails(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	p1 := samplePost("Trùng", "trung", StatusDraft)
	if err := repo.Create(ctx, p1); err != nil {
		t.Fatalf("create p1: %v", err)
	}
	p2 := samplePost("Trùng 2", "trung", StatusDraft) // slug trùng → fail
	if err := repo.Create(ctx, p2); err == nil {
		t.Fatal("expected slug conflict")
	}
	var count int64
	if err := repo.db.Model(&outbox.Event{}).Where("event_type = ?", "post.created").
		Where("payload->>'slug' = ?", "trung").Count(&count).Error; err != nil {
		t.Fatalf("count: %v", err)
	}
	if count != 1 {
		t.Errorf("events = %d, want 1 (transaction fail không để lại event)", count)
	}
}
```

Run: `cd services/core; go test ./internal/modules/posts/ -run Outbox` → FAIL.

- [ ] **Step 5: Ghi event trong repo posts**

`repository.go` — import `outbox`, thêm helper cuối file:

```go
// postEventPayload là payload chung cho outbox event của post — consumer
// (Phase 2 AI worker) tự lọc theo status.
func postEventPayload(id uuid.UUID, slug, status string, version int64) map[string]any {
	return map[string]any{"id": id, "slug": slug, "status": status, "version": version}
}
```

`Create` — trước `applyGenerated(p, gp, tags)`:

```go
		if err := outbox.Write(tx, "post", gp.ID, "post.created",
			postEventPayload(gp.ID, gp.Slug, gp.Status, gp.Version)); err != nil {
			return err
		}
```

`Update` — sau khi `First(&fresh, ...)` OK, trước `applyGenerated`:

```go
		if err := outbox.Write(tx, "post", fresh.ID, "post.updated",
			postEventPayload(fresh.ID, fresh.Slug, fresh.Status, fresh.Version)); err != nil {
			return err
		}
```

`Delete` — bọc transaction để đọc bài trước khi xoá (cần slug/status cho payload):

```go
// Delete xoá bài viết + quan hệ tags trong 1 transaction, ghi event post.deleted;
// trả ErrPostNotFound nếu không có.
func (r *GormRepository) Delete(ctx context.Context, id uuid.UUID) error {
	return r.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		var gp gormPost
		if err := tx.First(&gp, "id = ?", id).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				return ErrPostNotFound
			}
			return err
		}
		if err := tx.Select(clause.Associations).Delete(&gormPost{ID: id}).Error; err != nil {
			return err
		}
		return outbox.Write(tx, "post", id, "post.deleted",
			postEventPayload(id, gp.Slug, gp.Status, gp.Version))
	})
}
```

Run: `cd services/core; go test ./...` → Expected: PASS toàn bộ.

- [ ] **Step 6: Wiring atlas-loader + main.go + migration**

`cmd/atlas-loader/main.go` — thêm import outbox và:

```go
	models = append(models, outbox.Models()...)
```

`cmd/api/main.go` — sau khi có `ctx` graceful-shutdown (`ctx, stop := signal.NotifyContext(...)`), trước `go func() { srv.ListenAndServe... }`:

```go
	// Outbox dispatcher (chuẩn bị Phase 2): poll event chưa xử lý, handler hiện
	// tại chỉ log. Dừng theo ctx shutdown — event còn lại nằm trong DB, không mất.
	dispatcher := outbox.NewDispatcher(db, outbox.LogHandler{Log: log}, log, 10*time.Second)
	go dispatcher.Run(ctx)
```

Migration:

```powershell
cd services/core
./atlas.exe migrate diff add_outbox --env gorm
./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"
```

Expected: migration tạo bảng `outbox` + partial index; apply OK.

- [ ] **Step 7: Build + toàn bộ test**

Run: `cd services/core; go build ./...; go test ./...`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add services/core
git commit -m "feat(core): transactional outbox — bảng + ghi event post.* trong tx + dispatcher poll (Phase 2 prep)"
```

---

### Task 8: Verify E2E + security-review + cập nhật docs

**Files:**
- Modify: `docs/reviews/2026-07-11-senior-code-review.md` (✅ RESOLVED cho M1–M5 + note outbox)
- Modify: `CLAUDE.md` ("Trạng thái hiện tại" + "📍 Điểm hiện tại")

- [ ] **Step 1: Chạy full test + build lần cuối**

```powershell
cd services/core; go test ./...
pnpm --filter @ultimate/admin test -- --run
pnpm turbo build
```

Expected: tất cả PASS/xanh.

- [ ] **Step 2: Verify E2E với stack thật**

Khởi động: `docker compose up -d` → apply migration (nếu chưa) → `cd services/core; go run ./cmd/api` → `pnpm --filter @ultimate/admin dev`. Kiểm tra từng mục (dùng curl cho core, browser cho admin):

1. **M5:** login admin, mở cùng một bài ở 2 tab; tab 1 sửa + lưu OK; tab 2 sửa + lưu → thấy banner "Bài đã bị sửa ở nơi khác" + bấm "Tải bản mới nhất" → form nạp bản mới.
2. **M2:** đổi `ADMIN_ALLOWLIST` trong `.env` bỏ email đang login, restart core → request admin kế tiếp bị 401 và đá về trang login.
3. **M4:** `curl -i -X POST http://localhost:8080/api/v1/posts -H "Content-Type: application/json" --data-binary "@big.json"` với file >2 MiB (tạo bằng PowerShell: `'{"title":"' + ('a' * 3MB) + '"}' | Set-Content big.json -Encoding utf8 -NoNewline`) → **413** `PAYLOAD_TOO_LARGE` (401 nếu chưa kèm cookie — dùng cookie session thật, hoặc chỉ cần thấy 413 xảy ra trước auth là đạt vì middleware global).
4. **M3:** tạo bài slug `stats` PUBLISHED qua admin → `curl http://localhost:8080/api/v1/posts/stats` trả bài viết; Dashboard admin vẫn hiện stats + chart (URL mới).
5. **M1:** tạo 2 bài cùng tag mới → bảng `tags` chỉ 1 dòng (`docker exec -it <pg> psql -U blog -c "select * from tags"`).
6. **Outbox:** sau các thao tác trên, `select event_type, payload, processed_at from outbox order by created_at` → có event `post.created/updated/deleted`, `processed_at` được dispatcher set trong ~10s, log core có dòng `outbox event`.

- [ ] **Step 3: Security review**

Chạy skill `security-review` trên diff của slice; xử lý finding (nếu có) trước khi tiếp tục.

- [ ] **Step 4: Cập nhật issue tracker + CLAUDE.md**

- `docs/reviews/2026-07-11-senior-code-review.md`: đánh dấu `✅ RESOLVED (2026-07-12, commit <hash>)` ngay tại M1, M2, M3, M4, M5 (giữ nguyên nội dung finding); mục "Kiến trúc cho Phase 2" note outbox đã triển khai (bảng + writer + dispatcher log-handler).
- `CLAUDE.md`: thêm bullet `✅ Slice 5d — DONE` (tóm tắt như các slice trước, link spec + plan) + cập nhật dòng "📍 Điểm hiện tại" (Phase 1 + 5a–5d xong; bước kế tiếp: Deploy production hoặc Phase 2 AI).

- [ ] **Step 5: Commit cuối**

```bash
git add docs CLAUDE.md
git commit -m "docs: Slice 5d DONE — resolve M1-M5 + outbox, cập nhật tracker + CLAUDE.md"
```
