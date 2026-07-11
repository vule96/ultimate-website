# Slice 5a — Security & Data-loss Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Đóng 5 finding bảo mật/mất-dữ-liệu nghiêm trọng nhất (C1, H1, H4, A1, A4) từ `docs/reviews/2026-07-11-senior-code-review.md`.

**Architecture:** Core (Go/Gin) thêm visibility policy session-aware cho GET posts (handler truyền `authed bool` xuống service qua checker function do `auth.Identity(sm)` cung cấp — posts KHÔNG import auth trực tiếp mà nhận `func(ctx) bool`), ký Content-Length vào presigned PUT, middleware requireJSON chặn CSRF class, config fail-fast. Admin (React) freeze form-hydration bằng ref để background refetch không ghi đè.

**Tech Stack:** Go 1.x + Gin + GORM + scs; React 18 + react-hook-form + TanStack Query; Vitest + Testing Library.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-11-slice5a-security-hardening-design.md`.
- Module `posts` KHÔNG được import module `auth` (chỉ nhận `func(ctx context.Context) bool`).
- `GET /tags` giữ public. Web/admin FE không đổi API call nào.
- Error envelope thống nhất qua `httperr.Write` (`{"error":{code,message}}`).
- Mọi comment code viết tiếng Việt, theo phong cách file hiện có.
- Test Go handler/repo cần `TEST_DATABASE_URL` (skip nếu thiếu — pattern `newRepoTx` có sẵn); chạy test: `cd services/core && go test ./...`.
- Test admin: `pnpm --filter @ultimate/admin test`.
- Sau khi xong TẤT CẢ tasks: đánh dấu `✅ RESOLVED (2026-07-11, commit <hash>)` cho C1, H1, H4, A1, A4 trong `docs/reviews/2026-07-11-senior-code-review.md` (Task 7).

---

### Task 1: Config fail-fast — `SameSite=none` bắt buộc `Secure=true`

**Files:**
- Modify: `services/core/internal/platform/config/config.go`
- Create: `services/core/internal/platform/config/config_test.go`

**Interfaces:**
- Produces: `config.Load()` trả error khi `SESSION_COOKIE_SAMESITE=none` mà `SESSION_COOKIE_SECURE=false`; `Config.SessionSameSite` luôn lowercase+trim.

- [ ] **Step 1: Write the failing test**

Tạo `services/core/internal/platform/config/config_test.go`:

```go
package config

import (
	"strings"
	"testing"
)

// setRequiredEnv đặt env tối thiểu để Load() không fail vì thiếu DATABASE_URL.
func setRequiredEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://test")
}

func TestLoad_SameSiteNoneRequiresSecure(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("SESSION_COOKIE_SAMESITE", "none")
	t.Setenv("SESSION_COOKIE_SECURE", "false")

	_, err := Load()
	if err == nil {
		t.Fatal("want error when samesite=none and secure=false, got nil")
	}
	if !strings.Contains(err.Error(), "SESSION_COOKIE_SECURE") {
		t.Errorf("error should mention SESSION_COOKIE_SECURE, got: %v", err)
	}
}

func TestLoad_SameSiteNoneWithSecureOK(t *testing.T) {
	setRequiredEnv(t)
	t.Setenv("SESSION_COOKIE_SAMESITE", "None") // viết hoa → phải normalize
	t.Setenv("SESSION_COOKIE_SECURE", "true")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if cfg.SessionSameSite != "none" {
		t.Errorf("SessionSameSite = %q, want normalized \"none\"", cfg.SessionSameSite)
	}
}

func TestLoad_DefaultLaxOK(t *testing.T) {
	setRequiredEnv(t)
	if _, err := Load(); err != nil {
		t.Fatalf("unexpected error with defaults: %v", err)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/core && go test ./internal/platform/config/ -v`
Expected: FAIL — `TestLoad_SameSiteNoneRequiresSecure` (Load hiện không trả error) và `TestLoad_SameSiteNoneWithSecureOK` (chưa normalize "None"→"none").

- [ ] **Step 3: Implement**

Trong `services/core/internal/platform/config/config.go`:

Thêm `"strings"` vào imports. Sửa dòng đọc SameSite trong `Load()`:

```go
		SessionSameSite: strings.ToLower(strings.TrimSpace(getEnv("SESSION_COOKIE_SAMESITE", "lax"))),
```

Thêm assertion ngay trước `return cfg, nil` (sau check DatabaseURL):

```go
	// SameSite=None mà không Secure thì browser sẽ drop cookie — fail fast thay vì hỏng im lặng.
	if cfg.SessionSameSite == "none" && !cfg.SessionSecure {
		return Config{}, fmt.Errorf("config: SESSION_COOKIE_SAMESITE=none requires SESSION_COOKIE_SECURE=true")
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/core && go test ./internal/platform/config/ -v`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/platform/config/
git commit -m "fix(core): fail fast khi SESSION_COOKIE_SAMESITE=none mà không Secure (L11 một phần)"
```

---

### Task 2: Middleware `requireJSON` chặn CSRF class (H4)

**Files:**
- Create: `services/core/internal/shared/jsonmw/jsonmw.go`
- Create: `services/core/internal/shared/jsonmw/jsonmw_test.go`
- Modify: `services/core/cmd/api/main.go` (wiring)

**Interfaces:**
- Produces: `jsonmw.RequireJSON() gin.HandlerFunc` — POST/PUT/PATCH có Content-Type khác `application/json` → 415 envelope `UNSUPPORTED_MEDIA_TYPE`; GET/DELETE pass-through.
- Consumes: `httperr.Write(c, status, code, message)` (có sẵn).

- [ ] **Step 1: Write the failing test**

Tạo `services/core/internal/shared/jsonmw/jsonmw_test.go`:

```go
package jsonmw

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func newServer() *gin.Engine {
	r := gin.New()
	r.Use(RequireJSON())
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	r.POST("/x", ok)
	r.PUT("/x", ok)
	r.DELETE("/x", ok)
	r.GET("/x", ok)
	return r
}

func do(r *gin.Engine, method, contentType string) int {
	req := httptest.NewRequest(method, "/x", strings.NewReader(`{}`))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestRequireJSON_RejectsNonJSONWrites(t *testing.T) {
	r := newServer()
	for _, ct := range []string{"text/plain", "application/x-www-form-urlencoded", "multipart/form-data", ""} {
		if code := do(r, http.MethodPost, ct); code != http.StatusUnsupportedMediaType {
			t.Errorf("POST %q: code = %d, want 415", ct, code)
		}
		if code := do(r, http.MethodPut, ct); code != http.StatusUnsupportedMediaType {
			t.Errorf("PUT %q: code = %d, want 415", ct, code)
		}
	}
}

func TestRequireJSON_AllowsJSON(t *testing.T) {
	r := newServer()
	for _, ct := range []string{"application/json", "application/json; charset=utf-8"} {
		if code := do(r, http.MethodPost, ct); code != http.StatusOK {
			t.Errorf("POST %q: code = %d, want 200", ct, code)
		}
	}
}

func TestRequireJSON_IgnoresGetAndDelete(t *testing.T) {
	r := newServer()
	if code := do(r, http.MethodGet, "text/plain"); code != http.StatusOK {
		t.Errorf("GET: code = %d, want 200", code)
	}
	if code := do(r, http.MethodDelete, ""); code != http.StatusOK {
		t.Errorf("DELETE: code = %d, want 200", code)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/core && go test ./internal/shared/jsonmw/ -v`
Expected: FAIL compile — package chưa tồn tại / `RequireJSON` undefined.

- [ ] **Step 3: Implement**

Tạo `services/core/internal/shared/jsonmw/jsonmw.go`:

```go
// Package jsonmw chứa middleware ép Content-Type JSON cho các endpoint ghi.
//
// Mục đích chống CSRF class khi cookie SameSite=none: cross-site form/fetch chỉ gửi
// được "simple request" (text/plain, form-urlencoded...) không qua preflight; ép
// application/json biến request ghi thành non-simple → bị CORS preflight chặn.
package jsonmw

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

// RequireJSON chặn POST/PUT/PATCH có Content-Type khác application/json (415).
// GET/DELETE (không body) đi qua tự do.
func RequireJSON() gin.HandlerFunc {
	return func(c *gin.Context) {
		switch c.Request.Method {
		case http.MethodPost, http.MethodPut, http.MethodPatch:
			// c.ContentType() đã strip tham số (vd "; charset=utf-8").
			if c.ContentType() != "application/json" {
				httperr.Write(c, http.StatusUnsupportedMediaType,
					"UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json")
				c.Abort()
				return
			}
		}
		c.Next()
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/core && go test ./internal/shared/jsonmw/ -v`
Expected: PASS (3/3).

- [ ] **Step 5: Wire vào main.go**

Trong `services/core/cmd/api/main.go`: thêm import `"github.com/vule96/ultimate-website/services/core/internal/shared/jsonmw"`, rồi thay 2 dòng RegisterRoutes:

```go
	api := r.Group("/api/v1")
	writeMW := []gin.HandlerFunc{jsonmw.RequireJSON(), auth.RequireAuth(sm)}
	postsHandler.RegisterRoutes(api, writeMW...)
	mediaHandler.RegisterRoutes(api, writeMW...)
```

(LƯU Ý: ở Task 5 chữ ký `posts.NewHandler` sẽ đổi — task này chỉ đổi phần group/writeMW, giữ nguyên `postsHandler := ...` hiện tại.)

- [ ] **Step 6: Build + full test để chắc không vỡ gì**

Run: `cd services/core && go build ./... && go test ./...`
Expected: build OK, test PASS (test handler cũ dùng `doJSON` set đúng `application/json` nên không bị ảnh hưởng).

- [ ] **Step 7: Commit**

```bash
git add services/core/internal/shared/jsonmw/ services/core/cmd/api/main.go
git commit -m "fix(core): requireJSON middleware cho endpoint ghi — chặn CSRF simple-request (H4)"
```

---

### Task 3: Presign ký Content-Length (H1)

**Files:**
- Modify: `services/core/internal/modules/media/domain.go:49` (port `Storage`)
- Modify: `services/core/internal/modules/media/storage_s3.go:53-63`
- Modify: `services/core/internal/modules/media/service.go:41`
- Modify: `services/core/internal/modules/media/service_test.go` (fakeStorage)
- Modify: `services/core/internal/modules/media/storage_s3_test.go` (roundtrip + test mới)

**Interfaces:**
- Produces: `Storage.PresignPut(ctx context.Context, key, contentType string, size int64) (url string, expires time.Duration, err error)` — size được ký vào URL (`X-Amz-SignedHeaders` chứa `content-length`).

- [ ] **Step 1: Write the failing tests**

Trong `services/core/internal/modules/media/service_test.go` — sửa `fakeStorage` và thêm assertion:

```go
// fakeStorage là Storage giả cho unit test service (không cần MinIO).
type fakeStorage struct {
	lastKey         string
	lastContentType string
	lastSize        int64
}

func (f *fakeStorage) PresignPut(_ context.Context, key, contentType string, size int64) (string, time.Duration, error) {
	f.lastKey = key
	f.lastContentType = contentType
	f.lastSize = size
	return "https://storage.test/" + key + "?sig=x", 15 * time.Minute, nil
}
```

Trong `TestPresign_ValidPNG`, thêm sau block check `ExpiresIn`:

```go
	if st.lastSize != 1024 {
		t.Errorf("storage nhận size = %d, want 1024 (size phải được truyền xuống để ký)", st.lastSize)
	}
```

Thêm test mới vào `services/core/internal/modules/media/storage_s3_test.go` (unit — không cần MinIO, presign là offline):

```go
// Presigned URL phải ký content-length để storage từ chối PUT sai kích thước (H1).
func TestS3Storage_PresignPut_SignsContentLength(t *testing.T) {
	st := NewS3Storage(S3Config{
		Endpoint:     "https://storage.example.com",
		Region:       "auto",
		AccessKey:    "test-key",
		SecretKey:    "test-secret",
		Bucket:       "bucket",
		PublicURL:    "https://cdn.example.com",
		UsePathStyle: true,
	})

	u, _, err := st.PresignPut(context.Background(), "uploads/x.png", "image/png", 12345)
	if err != nil {
		t.Fatalf("presign: %v", err)
	}
	parsed, err := neturl.Parse(u)
	if err != nil {
		t.Fatalf("parse url: %v", err)
	}
	signed := parsed.Query().Get("X-Amz-SignedHeaders")
	if !strings.Contains(signed, "content-length") {
		t.Errorf("X-Amz-SignedHeaders = %q, want chứa content-length", signed)
	}
}
```

Imports cần thêm ở đầu `storage_s3_test.go`: `neturl "net/url"` và `"strings"`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/core && go test ./internal/modules/media/ -v`
Expected: FAIL compile — `fakeStorage.PresignPut` không còn khớp interface cũ / test mới gọi PresignPut 4 tham số.

- [ ] **Step 3: Implement**

`services/core/internal/modules/media/domain.go` — sửa port:

```go
// Storage là cổng (port) sinh presigned URL. Service không biết cài đặt cụ thể (S3/MinIO/R2).
// size được ký vào URL (Content-Length) để storage từ chối upload sai kích thước.
type Storage interface {
	PresignPut(ctx context.Context, key, contentType string, size int64) (url string, expires time.Duration, err error)
	PublicURL(key string) string
}
```

`services/core/internal/modules/media/storage_s3.go` — sửa impl:

```go
// PresignPut sinh presigned PUT URL cho object key; content-type và content-length
// đều là signed header — PUT với giá trị khác sẽ bị storage từ chối (403).
func (s *s3Storage) PresignPut(ctx context.Context, key, contentType string, size int64) (string, time.Duration, error) {
	req, err := s.presign.PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:        aws.String(s.bucket),
		Key:           aws.String(key),
		ContentType:   aws.String(contentType),
		ContentLength: aws.Int64(size),
	}, s3.WithPresignExpires(s.expires))
	if err != nil {
		return "", 0, err
	}
	return req.URL, s.expires, nil
}
```

`services/core/internal/modules/media/service.go:41` — truyền size:

```go
	url, expires, err := s.storage.PresignPut(ctx, key, in.ContentType, in.Size)
```

- [ ] **Step 4: Cập nhật integration roundtrip test (MinIO-gated)**

Trong `TestS3Storage_PresignPutRoundTrip` (`storage_s3_test.go`): sửa call presign + thêm subtest sai size ngay sau phần GET công khai:

```go
	url, _, err := st.PresignPut(ctx, key, "image/png", int64(len(content)))
```

và cuối hàm (sau check public content):

```go
	// PUT với size khác size đã ký → storage phải từ chối (chứng minh H1 đã đóng).
	wrongURL, _, err := st.PresignPut(ctx, "uploads/2026/07/wrong-size.png", "image/png", int64(len(content))+5)
	if err != nil {
		t.Fatalf("presign wrong size: %v", err)
	}
	wreq, _ := http.NewRequestWithContext(ctx, http.MethodPut, wrongURL, bytes.NewReader(content))
	wreq.Header.Set("Content-Type", "image/png")
	wresp, err := http.DefaultClient.Do(wreq)
	if err != nil {
		t.Fatalf("put wrong size: %v", err)
	}
	defer wresp.Body.Close()
	if wresp.StatusCode == http.StatusOK {
		t.Error("PUT với Content-Length khác giá trị đã ký phải bị từ chối, nhưng được 200")
	}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd services/core && go test ./internal/modules/media/ -v`
Expected: PASS — unit tests xanh; roundtrip SKIP nếu không có `STORAGE_TEST_ENDPOINT` (nếu MinIO đang chạy: `STORAGE_TEST_ENDPOINT=http://localhost:9000 go test ./internal/modules/media/ -v` → PASS cả roundtrip).

- [ ] **Step 6: Build toàn bộ + commit**

Run: `cd services/core && go build ./... && go test ./...`

```bash
git add services/core/internal/modules/media/
git commit -m "fix(core): ký Content-Length vào presigned PUT — enforce giới hạn 5MB thật (H1)"
```

---

### Task 4: `auth.Identity` — checker đăng nhập cho module khác

**Files:**
- Modify: `services/core/internal/modules/auth/middleware.go`
- Modify: `services/core/internal/modules/auth/handler_test.go` (hoặc thêm test vào cuối file test có sẵn của package auth)

**Interfaces:**
- Produces: `auth.Identity(sm *scs.SessionManager) func(ctx context.Context) bool` — true nếu session có `admin_email`. Task 5 dùng hàm này khi wiring.

- [ ] **Step 1: Write the failing test**

Thêm vào cuối `services/core/internal/modules/auth/handler_test.go` (nếu file đã có imports `net/http`, `net/http/httptest`, `testing` thì tái dùng; thiếu thì bổ sung, kèm `"github.com/alexedwards/scs/v2"`):

```go
func TestIdentity(t *testing.T) {
	sm := scs.New() // MemStore mặc định

	var got bool
	h := sm.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = Identity(sm)(r.Context())
		if r.URL.Query().Get("login") == "1" {
			sm.Put(r.Context(), sessionKeyAdminEmail, "admin@example.com")
		}
	}))

	// Request 1: chưa có session → false (đồng thời login để lấy cookie).
	w1 := httptest.NewRecorder()
	h.ServeHTTP(w1, httptest.NewRequest(http.MethodGet, "/?login=1", nil))
	if got {
		t.Error("request chưa đăng nhập: Identity phải trả false")
	}

	// Request 2: kèm cookie session → true.
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, c := range w1.Result().Cookies() {
		req2.AddCookie(c)
	}
	h.ServeHTTP(httptest.NewRecorder(), req2)
	if !got {
		t.Error("request có session admin_email: Identity phải trả true")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd services/core && go test ./internal/modules/auth/ -run TestIdentity -v`
Expected: FAIL compile — `Identity` undefined.

- [ ] **Step 3: Implement**

Thêm vào `services/core/internal/modules/auth/middleware.go` (thêm import `"context"`):

```go
// Identity trả về checker cho biết request (qua ctx đã đi qua scs LoadAndSave)
// đã đăng nhập admin hay chưa. Module khác (vd posts) nhận checker này khi wiring
// để quyết định visibility mà không cần import auth.
func Identity(sm *scs.SessionManager) func(ctx context.Context) bool {
	return func(ctx context.Context) bool {
		return sm.GetString(ctx, sessionKeyAdminEmail) != ""
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd services/core && go test ./internal/modules/auth/ -v`
Expected: PASS (toàn bộ package auth).

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/modules/auth/
git commit -m "feat(core): auth.Identity — checker đăng nhập cho module khác dùng khi wiring"
```

---

### Task 5: Visibility policy cho posts (C1) + gate stats

**Files:**
- Modify: `services/core/internal/modules/posts/service.go` (`ListFilter`, `List`, `GetBySlug`)
- Modify: `services/core/internal/modules/posts/handler.go` (`Handler`, `NewHandler`, `RegisterRoutes`, `list`, `getBySlug`)
- Modify: `services/core/internal/modules/posts/service_test.go` (mockRepo + tests mới)
- Modify: `services/core/internal/modules/posts/handler_test.go` (helper + tests mới)
- Modify: `services/core/cmd/api/main.go` (wiring `auth.Identity(sm)`)

**Interfaces:**
- Consumes: `auth.Identity(sm)` từ Task 4 (chỉ ở main.go); `jsonmw`/writeMW từ Task 2.
- Produces:
  - `posts.NewHandler(svc *Service, authed func(ctx context.Context) bool) *Handler`
  - `ListFilter.Authed bool` — `Service.List` ép `Status = "PUBLISHED"` khi `!Authed`
  - `Service.GetBySlug(ctx context.Context, slug string, authed bool) (*Post, error)` — trả `ErrPostNotFound` cho bài non-published khi `!authed`
  - Route `GET /posts/stats`, `GET /posts/stats/timeseries` nằm sau protectedMW.

- [ ] **Step 1: Write failing service tests**

Trong `services/core/internal/modules/posts/service_test.go`:

(a) Mở rộng `mockRepo` — thêm 2 field và sửa 2 method:

```go
type mockRepo struct {
	created     *Post
	updated     *Post
	createErr   error
	monthCounts map[string]int64
	lastFilter  ListFilter // filter cuối cùng List nhận được
	bySlug      *Post      // post trả về từ GetBySlug (nil → ErrPostNotFound)
}
```

```go
func (m *mockRepo) GetBySlug(_ context.Context, _ string) (*Post, error) {
	if m.bySlug != nil {
		return m.bySlug, nil
	}
	return nil, ErrPostNotFound
}
func (m *mockRepo) List(_ context.Context, f ListFilter) ([]Post, int64, error) {
	m.lastFilter = f
	return nil, 0, nil
}
```

(b) Thêm tests mới vào cuối file:

```go
func TestServiceList_AnonymousForcesPublished(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	// Anonymous cố tình xin status=DRAFT → service phải ép về PUBLISHED.
	if _, _, err := svc.List(context.Background(), ListFilter{Status: "DRAFT", Authed: false}); err != nil {
		t.Fatalf("list: %v", err)
	}
	if repo.lastFilter.Status != string(StatusPublished) {
		t.Errorf("filter.Status = %q, want %q", repo.lastFilter.Status, StatusPublished)
	}
}

func TestServiceList_AuthedKeepsStatus(t *testing.T) {
	repo := &mockRepo{}
	svc := newTestService(repo)

	if _, _, err := svc.List(context.Background(), ListFilter{Status: "DRAFT", Authed: true}); err != nil {
		t.Fatalf("list: %v", err)
	}
	if repo.lastFilter.Status != "DRAFT" {
		t.Errorf("filter.Status = %q, want DRAFT (authed giữ nguyên filter)", repo.lastFilter.Status)
	}
}

func TestServiceGetBySlug_AnonymousDraftNotFound(t *testing.T) {
	repo := &mockRepo{bySlug: &Post{Slug: "nhap", Status: StatusDraft}}
	svc := newTestService(repo)

	if _, err := svc.GetBySlug(context.Background(), "nhap", false); !errors.Is(err, ErrPostNotFound) {
		t.Fatalf("anonymous đọc DRAFT: want ErrPostNotFound, got %v", err)
	}
	// PENDING_APPROVAL cũng phải ẩn.
	repo.bySlug.Status = StatusPendingApproval
	if _, err := svc.GetBySlug(context.Background(), "nhap", false); !errors.Is(err, ErrPostNotFound) {
		t.Fatalf("anonymous đọc PENDING_APPROVAL: want ErrPostNotFound, got %v", err)
	}
}

func TestServiceGetBySlug_AnonymousPublishedOK(t *testing.T) {
	repo := &mockRepo{bySlug: &Post{Slug: "cong-khai", Status: StatusPublished}}
	svc := newTestService(repo)

	p, err := svc.GetBySlug(context.Background(), "cong-khai", false)
	if err != nil {
		t.Fatalf("anonymous đọc PUBLISHED: %v", err)
	}
	if p.Slug != "cong-khai" {
		t.Errorf("slug = %q", p.Slug)
	}
}

func TestServiceGetBySlug_AuthedDraftOK(t *testing.T) {
	repo := &mockRepo{bySlug: &Post{Slug: "nhap", Status: StatusDraft}}
	svc := newTestService(repo)

	if _, err := svc.GetBySlug(context.Background(), "nhap", true); err != nil {
		t.Fatalf("authed đọc DRAFT: %v", err)
	}
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd services/core && go test ./internal/modules/posts/ -run TestServiceList_Anonymous -v`
Expected: FAIL compile — `ListFilter` chưa có `Authed`, `GetBySlug` chưa nhận 3 tham số.

- [ ] **Step 3: Implement service**

`services/core/internal/modules/posts/service.go`:

`ListFilter` thêm field (sau `Order`):

```go
// ListFilter là điều kiện lọc + phân trang cho danh sách bài viết.
type ListFilter struct {
	Status string // lọc theo trạng thái (rỗng = tất cả)
	Tag    string // lọc theo slug tag (rỗng = tất cả)
	Search string // tìm theo tiêu đề (ILIKE, rỗng = tất cả)
	Sort   string // cột sắp xếp (whitelist; rỗng/lạ = created_at)
	Order  string // asc | desc (mặc định desc)
	Authed bool   // request đã đăng nhập admin chưa; false → chỉ thấy PUBLISHED
	Limit  int
	Offset int
}
```

`List` và `GetBySlug`:

```go
// GetBySlug trả về bài viết theo slug. Request chưa đăng nhập chỉ thấy bài
// PUBLISHED — bài khác trả ErrPostNotFound (404, không lộ tồn tại của slug).
func (s *Service) GetBySlug(ctx context.Context, slug string, authed bool) (*Post, error) {
	p, err := s.repo.GetBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	if !authed && p.Status != StatusPublished {
		return nil, ErrPostNotFound
	}
	return p, nil
}

// List trả về danh sách bài viết theo filter + tổng số bản ghi. Request chưa
// đăng nhập bị ép Status=PUBLISHED bất kể filter xin gì (trust boundary ở API).
func (s *Service) List(ctx context.Context, f ListFilter) ([]Post, int64, error) {
	if !f.Authed {
		f.Status = string(StatusPublished)
	}
	return s.repo.List(ctx, f)
}
```

Run: `cd services/core && go test ./internal/modules/posts/ -run "TestServiceList|TestServiceGetBySlug" -v`
Expected: service tests PASS (handler chưa compile được — bước sau).

- [ ] **Step 4: Write failing handler tests**

Trong `services/core/internal/modules/posts/handler_test.go`:

(a) Sửa helper — thay hàm `newTestServer` hiện tại bằng:

```go
// newServerWithAuth dựng engine với authed checker cố định (true = như đã login).
func newServerWithAuth(t *testing.T, authed bool) *gin.Engine {
	t.Helper()
	repo := newRepoTx(t) // t.Skip nếu không có TEST_DATABASE_URL
	svc := NewService(repo)
	r := gin.New()
	NewHandler(svc, func(context.Context) bool { return authed }).RegisterRoutes(r.Group("/api/v1"))
	return r
}

// newTestServer: server "đã đăng nhập" — giữ hành vi cũ cho các test CRUD sẵn có.
func newTestServer(t *testing.T) *gin.Engine { return newServerWithAuth(t, true) }

// newAnonTestServer: server ẩn danh — cho các test visibility công khai.
func newAnonTestServer(t *testing.T) *gin.Engine { return newServerWithAuth(t, false) }
```

Thêm `"context"` vào imports của file test.

(b) Thêm tests mới vào cuối file:

```go
func TestHandler_AnonymousListOnlyPublished(t *testing.T) {
	r := newAnonTestServer(t)
	// Fixtures: 1 DRAFT (mặc định) + 1 PUBLISHED. Write route trong test không bọc auth.
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Bản nháp"})
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Công khai", "status": "PUBLISHED"})

	// Anonymous xin thẳng DRAFT → vẫn chỉ thấy PUBLISHED.
	w := doJSON(t, r, http.MethodGet, "/api/v1/posts?status=DRAFT", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	body := decode(t, w)
	if body["total"].(float64) != 1 {
		t.Fatalf("total = %v, want 1 (chỉ bài PUBLISHED); body=%s", body["total"], w.Body.String())
	}
	data := body["data"].([]any)
	first := data[0].(map[string]any)
	if first["slug"] != "cong-khai" {
		t.Errorf("slug = %v, want cong-khai", first["slug"])
	}
}

func TestHandler_AnonymousGetDraft404(t *testing.T) {
	r := newAnonTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Bản nháp"})

	w := doJSON(t, r, http.MethodGet, "/api/v1/posts/ban-nhap", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("anonymous GET draft: status = %d, want 404; body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_AuthedGetDraftOK(t *testing.T) {
	r := newTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Bản nháp"})

	w := doJSON(t, r, http.MethodGet, "/api/v1/posts/ban-nhap", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("authed GET draft: status = %d, want 200", w.Code)
	}
}

func TestHandler_StatsBehindProtectedMW(t *testing.T) {
	repo := newRepoTx(t)
	svc := NewService(repo)
	r := gin.New()
	deny := func(c *gin.Context) {
		c.AbortWithStatus(http.StatusUnauthorized)
	}
	NewHandler(svc, func(context.Context) bool { return false }).RegisterRoutes(r.Group("/api/v1"), deny)

	for _, path := range []string{"/api/v1/posts/stats", "/api/v1/posts/stats/timeseries"} {
		w := doJSON(t, r, http.MethodGet, path, nil)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401 (stats phải nằm sau protectedMW)", path, w.Code)
		}
	}
	// List công khai vẫn đi qua bình thường.
	if w := doJSON(t, r, http.MethodGet, "/api/v1/posts", nil); w.Code != http.StatusOK {
		t.Errorf("GET /posts: status = %d, want 200", w.Code)
	}
}
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd services/core && go test ./internal/modules/posts/ -v`
Expected: FAIL compile — `NewHandler` chưa nhận authed checker.

- [ ] **Step 6: Implement handler**

`services/core/internal/modules/posts/handler.go`:

Thêm `"context"` vào imports. Sửa struct + constructor + routes:

```go
// Handler expose module posts qua HTTP (Gin).
type Handler struct {
	svc    *Service
	authed func(ctx context.Context) bool // request hiện tại đã đăng nhập admin chưa
}

// NewHandler tạo Handler từ Service và checker đăng nhập (vd auth.Identity(sm)).
func NewHandler(svc *Service, authed func(ctx context.Context) bool) *Handler {
	return &Handler{svc: svc, authed: authed}
}

// RegisterRoutes gắn các route của module posts. GET list/detail/tags công khai
// (service tự ép visibility); stats + endpoint ghi nằm sau protectedMW
// (vd jsonmw.RequireJSON + auth.RequireAuth).
func (h *Handler) RegisterRoutes(rg gin.IRouter, protectedMW ...gin.HandlerFunc) {
	rg.GET("/posts", h.list)
	rg.GET("/posts/:slug", h.getBySlug)
	rg.GET("/tags", h.listTags)

	protected := rg.Group("", protectedMW...)
	protected.GET("/posts/stats", h.stats)
	protected.GET("/posts/stats/timeseries", h.timeseries)
	protected.POST("/posts", h.create)
	protected.PUT("/posts/:id", h.update)
	protected.DELETE("/posts/:id", h.delete)
}
```

Sửa `list` — thêm `Authed` vào filter:

```go
	posts, total, err := h.svc.List(c.Request.Context(), ListFilter{
		Status: c.Query("status"),
		Tag:    c.Query("tag"),
		Search: strings.TrimSpace(c.Query("q")),
		Sort:   c.Query("sort"),
		Order:  c.Query("order"),
		Authed: h.authed(c.Request.Context()),
		Limit:  p.PageSize,
		Offset: p.Offset(),
	})
```

Sửa `getBySlug`:

```go
func (h *Handler) getBySlug(c *gin.Context) {
	ctx := c.Request.Context()
	post, err := h.svc.GetBySlug(ctx, c.Param("slug"), h.authed(ctx))
	if err != nil {
		respondError(c, err)
		return
	}
	c.JSON(http.StatusOK, toResponse(*post))
}
```

- [ ] **Step 7: Wire main.go**

`services/core/cmd/api/main.go` — sửa dòng wiring posts:

```go
	// Wiring module posts. auth.Identity cho handler biết request đã đăng nhập chưa
	// (anonymous chỉ thấy bài PUBLISHED).
	postsHandler := posts.NewHandler(posts.NewService(posts.NewGormRepository(db)), auth.Identity(sm))
```

- [ ] **Step 8: Run full core test suite**

Run: `cd services/core && go build ./... && go test ./...`
Expected: PASS toàn bộ (kể cả các test CRUD cũ — chúng dùng `newTestServer` = authed).
LƯU Ý: test handler/repo cần `TEST_DATABASE_URL` — nếu skip, chạy lại với env đó bật (Docker Postgres đang chạy): PowerShell: `$env:TEST_DATABASE_URL = "postgres://blog:blog@localhost:5432/blog?sslmode=disable"; go test ./...`.

- [ ] **Step 9: Commit**

```bash
git add services/core/internal/modules/posts/ services/core/cmd/api/main.go
git commit -m "fix(core): visibility policy — anonymous chỉ thấy PUBLISHED, stats sau auth (C1)"
```

---

### Task 6: Admin — form không bị refetch ghi đè + contentJson ref (A1, A4)

**Files:**
- Modify: `apps/admin/src/features/posts/PostFormPage.tsx`
- Create: `apps/admin/src/features/posts/PostFormPage.test.tsx`

**Interfaces:**
- Consumes: `usePostQuery/useCreatePost/useUpdatePost` từ `./queries` (mock trong test); `toUpsertInput(values, contentJson)` từ `./formSchema` (giữ nguyên).
- Produces: hành vi — hydrate form đúng 1 lần; `contentJsonRef` không gây re-render; submit đọc `contentJsonRef.current`.

- [ ] **Step 1: Write the failing test**

Tạo `apps/admin/src/features/posts/PostFormPage.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Post } from "@ultimate/types";
import { ToastProvider } from "@ultimate/ui";
import { PostFormPage } from "./PostFormPage";

// --- Mocks: router, editor (lazy), queries ---
const mocks = vi.hoisted(() => ({
  usePostQuery: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ to, children, ...rest }: { to: string; children?: unknown }) => (
    <a href={String(to)} {...rest}>
      {children as never}
    </a>
  ),
}));

vi.mock("@/features/editor/EditorSwitch", () => ({
  EditorSwitch: ({
    initialHtml,
    onChange,
  }: {
    initialHtml: string;
    onChange: (v: { html: string; json: unknown }) => void;
  }) => (
    <textarea
      data-testid="editor"
      defaultValue={initialHtml}
      onChange={(e) => onChange({ html: e.target.value, json: { text: e.target.value } })}
    />
  ),
}));

vi.mock("./queries", () => ({
  usePostQuery: (slug: string | undefined) => mocks.usePostQuery(slug),
  useCreatePost: () => ({ mutate: mocks.createMutate, isPending: false }),
  useUpdatePost: () => ({ mutate: mocks.updateMutate, isPending: false }),
}));

const basePost = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "Bài gốc",
  slug: "bai-goc",
  content_json: { type: "doc" },
  content_html: "<p>Nội dung gốc</p>",
  excerpt: null,
  cover_image: null,
  status: "DRAFT",
  meta_title: null,
  meta_desc: null,
  published_at: null,
  tags: [],
  created_at: "2026-07-01T00:00:00Z",
  updated_at: "2026-07-01T00:00:00Z",
} as unknown as Post;

function renderPage() {
  return render(
    <ToastProvider>
      <PostFormPage slug="bai-goc" />
    </ToastProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("PostFormPage — hydrate & data-loss (A1, A4)", () => {
  it("prefill form từ post đã load", () => {
    mocks.usePostQuery.mockReturnValue({ data: basePost, isPending: false, isError: false });
    renderPage();
    expect(screen.getByPlaceholderText("Tiêu đề bài viết")).toHaveValue("Bài gốc");
  });

  it("background refetch (object mới) KHÔNG ghi đè nội dung user đang sửa", () => {
    mocks.usePostQuery.mockReturnValue({ data: basePost, isPending: false, isError: false });
    const view = renderPage();

    const title = screen.getByPlaceholderText("Tiêu đề bài viết");
    fireEvent.change(title, { target: { value: "User đang gõ dở" } });

    // Mô phỏng refetch: query trả về OBJECT MỚI (identity khác) với data server cũ.
    mocks.usePostQuery.mockReturnValue({
      data: { ...basePost, title: "Server ghi đè" } as unknown as Post,
      isPending: false,
      isError: false,
    });
    view.rerender(
      <ToastProvider>
        <PostFormPage slug="bai-goc" />
      </ToastProvider>,
    );

    expect(screen.getByPlaceholderText("Tiêu đề bài viết")).toHaveValue("User đang gõ dở");
  });

  it("submit gửi content_json MỚI NHẤT từ editor", async () => {
    mocks.usePostQuery.mockReturnValue({ data: basePost, isPending: false, isError: false });
    renderPage();

    fireEvent.change(screen.getByTestId("editor"), { target: { value: "<p>Mới</p>" } });
    fireEvent.click(screen.getByRole("button", { name: "Lưu" }));

    await waitFor(() => expect(mocks.updateMutate).toHaveBeenCalled());
    const [vars] = mocks.updateMutate.mock.calls[0] as [
      { id: string; input: { content_json: unknown } },
    ];
    expect(vars.input.content_json).toEqual({ text: "<p>Mới</p>" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ultimate/admin exec vitest run src/features/posts/PostFormPage.test.tsx`
Expected: test 1 PASS (prefill đã có), **test 2 FAIL** (form bị reset về "Server ghi đè") — chứng minh bug A1. Test 3 có thể pass/fail tuỳ state cũ; sau fix phải PASS cả 3.

- [ ] **Step 3: Implement**

Trong `apps/admin/src/features/posts/PostFormPage.tsx`:

(a) Sửa import dòng 1:

```tsx
import { useEffect, useRef, useState, type ReactNode } from "react";
```

(b) Thay block state/effect (hiện tại dòng 71-81):

```tsx
  // content_json native của editor (best-effort); HTML vẫn là nguồn nạp chung.
  // Dùng ref (không phải state): chỉ đọc lúc submit — keystroke không cần re-render form (A4).
  const contentJsonRef = useRef<unknown>({});

  // Hydrate form đúng MỘT lần khi post load xong. Background refetch tạo object mới
  // nhưng không được reset() đè lên nội dung user đang sửa (A1).
  const hasHydratedRef = useRef(false);
  // HTML nạp editor chốt tại lần load đầu (editor uncontrolled — chỉ đọc lúc mount).
  const initialHtmlRef = useRef<string | null>(null);

  const loaded = postQuery.data;
  if (loaded && initialHtmlRef.current === null) {
    initialHtmlRef.current = loaded.content_html;
  }
  useEffect(() => {
    if (loaded && !hasHydratedRef.current) {
      hasHydratedRef.current = true;
      reset(postToFormValues(loaded));
      contentJsonRef.current = loaded.content_json ?? {};
    }
  }, [loaded, reset]);
```

(c) Trong `onSubmit`, thay dòng `const input = toUpsertInput(values, contentJson);`:

```tsx
    const input = toUpsertInput(values, contentJsonRef.current);
```

(d) Trong JSX, thay `EditorSwitch` props:

```tsx
                <EditorSwitch
                  initialHtml={initialHtmlRef.current ?? ""}
                  onChange={({ html, json }) => {
                    setValue("content", html, { shouldDirty: true });
                    contentJsonRef.current = json;
                  }}
                  uploadImage={handleUploadImage}
                />
```

(e) Xoá dòng `const [contentJson, setContentJson] = useState<unknown>({});` cũ (và `useState` nếu không còn dùng — vẫn còn dùng cho `formError`, giữ import).

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ultimate/admin exec vitest run src/features/posts/PostFormPage.test.tsx`
Expected: PASS 3/3.

- [ ] **Step 5: Full admin test + typecheck + build**

Run: `pnpm --filter @ultimate/admin test && pnpm --filter @ultimate/admin build`
Expected: toàn bộ xanh.

- [ ] **Step 6: Commit**

```bash
git add apps/admin/src/features/posts/
git commit -m "fix(admin): form không bị background refetch ghi đè; contentJson dùng ref (A1, A4)"
```

---

### Task 7: Verify E2E + security review + đánh dấu RESOLVED

**Files:**
- Modify: `docs/reviews/2026-07-11-senior-code-review.md` (đánh dấu resolved)
- Modify: `CLAUDE.md` (Trạng thái hiện tại + Issue tracker)

- [ ] **Step 1: Chạy full stack dev**

Theo README gốc repo: `docker compose up -d` → core (`cd services/core && go run ./cmd/api`) → admin (`pnpm --filter @ultimate/admin dev`). Cần dữ liệu có ≥1 bài DRAFT + ≥1 bài PUBLISHED (tạo qua admin nếu thiếu).

- [ ] **Step 2: Verify visibility (C1) bằng curl — anonymous**

```bash
curl -s "http://localhost:8080/api/v1/posts?status=DRAFT"      # → data chỉ chứa PUBLISHED
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/v1/posts/<slug-bài-DRAFT>"   # → 404
curl -s -o /dev/null -w "%{http_code}" "http://localhost:8080/api/v1/posts/stats"              # → 401
```

- [ ] **Step 3: Verify admin vẫn đủ chức năng (browser)**

Login Google → posts list hiện cả DRAFT, Dashboard stats + chart hoạt động, tạo/sửa/xoá OK.

- [ ] **Step 4: Verify form không mất dữ liệu (A1)**

Mở sửa 1 bài → gõ thêm nội dung + đổi title → đợi >30s rồi blur/focus tab (trigger refetch) → nội dung còn nguyên → Lưu → mở lại thấy đúng nội dung mới.

- [ ] **Step 5: Verify presign size (H1) + requireJSON (H4)**

```bash
# H4: POST text/plain → 415 (dù có session hay không, middleware đứng trước auth)
curl -s -o /dev/null -w "%{http_code}" -X POST "http://localhost:8080/api/v1/posts" -H "Content-Type: text/plain" -d "x"   # → 415

# H1: upload ảnh qua admin editor vẫn OK (MinIO). Sau đó chạy integration test sai size:
cd services/core
$env:STORAGE_TEST_ENDPOINT = "http://localhost:9000"; go test ./internal/modules/media/ -run RoundTrip -v   # → PASS (gồm subtest wrong-size bị từ chối)
```

- [ ] **Step 6: Chạy security-review skill cho diff của slice**

Invoke skill `security-review` — mục tiêu: không finding mới ở mức high+ trong code vừa thêm.

- [ ] **Step 7: Đánh dấu RESOLVED + cập nhật CLAUDE.md**

Trong `docs/reviews/2026-07-11-senior-code-review.md`: thêm `✅ RESOLVED (2026-07-11, commit <hash>)` vào đầu các finding **C1, H1, H4** (mục Go core) và **A1, A4** (mục Admin — finding số 1 và 4), + L11 ghi chú "resolved một phần (assertion samesite/secure)". Trong `CLAUDE.md`: cập nhật khối "🩺 Issue tracker" (3 việc khẩn còn lại → chỉ W1) và thêm dòng Slice 5a DONE vào "Trạng thái hiện tại" + "📍 Điểm hiện tại".

- [ ] **Step 8: Final commit**

```bash
git add docs/reviews/2026-07-11-senior-code-review.md CLAUDE.md docs/superpowers/plans/2026-07-11-slice5a-security-hardening.md
git commit -m "docs: đánh dấu C1/H1/H4/A1/A4 resolved — Slice 5a hoàn tất"
```
