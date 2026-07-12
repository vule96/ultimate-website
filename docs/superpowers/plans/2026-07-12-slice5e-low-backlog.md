# Slice 5e — Dọn backlog Low (L8, L9, L10, L11, L12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve 5 finding Low còn mở trong senior review — config fail-fast (L11), presign expires cấu hình được + return interface (L8), không leak lỗi bind ra client (L9), dọn orphan tags trong cùng tx (L10), cách li test DB + test chống DB bẩn (L12).

**Architecture:** Toàn bộ thay đổi nằm trong `services/core` (Gin + GORM, Clean-lite mỗi module) + `docker-compose.yml`. Không đụng FE. Mỗi task độc lập, TDD, commit riêng.

**Tech Stack:** Go 1.x, Gin, GORM/Postgres, testing chuẩn Go, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-07-12-slice5e-low-backlog-design.md`

## Global Constraints

- Nhánh làm việc: `slice-5e-low-backlog` (tạo từ `main` trước Task 1).
- Integration test cần `TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"` (DB `blog_test` — Task 5 tự động hoá việc tạo; nếu chưa có: `docker exec ultimate_postgres createdb -U blog blog_test`).
- Chạy test từ `services/core`. PowerShell: `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./...`.
- Comment code bằng tiếng Việt, giọng như code hiện có; message lỗi/API bằng tiếng Anh.
- Error envelope: dùng `httperr.Write(c, status, CODE, message)` như hiện tại.
- KHÔNG `git push`; commit local. Message commit tiếng Việt kiểu `fix(scope): ...` như history.

---

### Task 0: Tạo nhánh

- [ ] **Step 1:** Từ repo root:

```bash
git checkout -b slice-5e-low-backlog
```

---

### Task 1: L11 — `getBoolEnv`/`getInt64Env` trả error, `Load` fail-fast

**Files:**
- Modify: `services/core/internal/platform/config/config.go`
- Test: `services/core/internal/platform/config/config_test.go` (đã có file thì thêm test; chưa có thì tạo)

**Interfaces:**
- Produces: `getBoolEnv(key string, fallback bool) (bool, error)`, `getInt64Env(key string, fallback int64) (int64, error)`. Task 2 sẽ thêm `getDurationEnv` cùng pattern.

- [ ] **Step 1: Viết test fail** — thêm vào `config_test.go` (package `config`; nếu file chưa tồn tại, tạo với `package config` + import `os`, `testing`):

```go
func TestLoad_InvalidBoolEnvFails(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("SESSION_COOKIE_SECURE", "ture") // typo cố ý
	if _, err := Load(); err == nil {
		t.Fatal("expected error for invalid bool env, got nil")
	}
}

func TestLoad_InvalidInt64EnvFails(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("MAX_BODY_BYTES", "abc")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for invalid int env, got nil")
	}
}

func TestLoad_EmptyEnvUsesFallback(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("SESSION_COOKIE_SECURE", "")
	t.Setenv("MAX_BODY_BYTES", "")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.MaxBodyBytes != 2<<20 {
		t.Errorf("MaxBodyBytes = %d, want default 2MiB", cfg.MaxBodyBytes)
	}
}
```

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `go test ./internal/platform/config/ -run TestLoad_Invalid -v`
Expected: FAIL (`expected error for invalid bool env, got nil`) — vì hiện tại đang nuốt lỗi.

- [ ] **Step 3: Sửa `config.go`** — đổi 2 helper trả error và hoist lời gọi ra khỏi struct literal:

```go
func getBoolEnv(key string, fallback bool) (bool, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	b, err := strconv.ParseBool(v)
	if err != nil {
		return false, fmt.Errorf("config: %s must be a boolean (true/false), got %q", key, v)
	}
	return b, nil
}

func getInt64Env(key string, fallback int64) (int64, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n <= 0 {
		return 0, fmt.Errorf("config: %s must be a positive integer, got %q", key, v)
	}
	return n, nil
}
```

Trong `Load()`, thay các dòng dùng helper trong struct literal bằng biến hoisted (đặt TRƯỚC `cfg := Config{...}`):

```go
	sessionSecure, err := getBoolEnv("SESSION_COOKIE_SECURE", appEnv == "production")
	if err != nil {
		return Config{}, err
	}
	usePathStyle, err := getBoolEnv("STORAGE_USE_PATH_STYLE", false)
	if err != nil {
		return Config{}, err
	}
	maxBodyBytes, err := getInt64Env("MAX_BODY_BYTES", 2<<20)
	if err != nil {
		return Config{}, err
	}
```

và trong struct literal: `SessionSecure: sessionSecure,` / `StorageUsePathStyle: usePathStyle,` / `MaxBodyBytes: maxBodyBytes,`.

- [ ] **Step 4: Chạy test pass**

Run: `go test ./internal/platform/config/ -v`
Expected: PASS toàn bộ.

- [ ] **Step 5: Build toàn bộ + commit**

Run: `go build ./... && go test ./internal/platform/config/`
```bash
git add internal/platform/config/
git commit -m "fix(config): getBoolEnv/getInt64Env trả error — Load fail-fast khi env rác (L11)"
```

---

### Task 2: L8 — `PresignExpires` vào `S3Config`, `NewS3Storage` trả interface

**Files:**
- Modify: `services/core/internal/modules/media/storage_s3.go`
- Modify: `services/core/internal/platform/config/config.go` (thêm `StoragePresignExpires` + `getDurationEnv`)
- Modify: `services/core/cmd/api/main.go:76-84` (wire `PresignExpires`)
- Modify: `services/core/.env.example` (dòng mới sau `STORAGE_USE_PATH_STYLE`)
- Modify: `services/core/README.md` (mục Object storage — 1 dòng về `STORAGE_PRESIGN_EXPIRES`)
- Test: `services/core/internal/modules/media/storage_s3_test.go`, `services/core/internal/platform/config/config_test.go`

**Interfaces:**
- Consumes: pattern `getXxxEnv (val, error)` từ Task 1.
- Produces: `NewS3Storage(cfg S3Config) Storage` (trả interface thay vì `*s3Storage`); `S3Config.PresignExpires time.Duration` (0 → default 15m); `Config.StoragePresignExpires time.Duration`; env `STORAGE_PRESIGN_EXPIRES` (Go duration, vd `15m`).

- [ ] **Step 1: Viết test fail** — thêm vào `storage_s3_test.go`:

```go
func TestNewS3Storage_PresignExpiresConfigurable(t *testing.T) {
	st := NewS3Storage(S3Config{
		Region: "auto", AccessKey: "k", SecretKey: "s", Bucket: "b",
		PublicURL:      "http://cdn.example.com",
		PresignExpires: 5 * time.Minute,
	})
	_, expires, err := st.PresignPut(context.Background(), "uploads/x.png", "image/png", 100)
	if err != nil {
		t.Fatalf("PresignPut: %v", err)
	}
	if expires != 5*time.Minute {
		t.Errorf("expires = %v, want 5m", expires)
	}
}

func TestNewS3Storage_PresignExpiresDefault15m(t *testing.T) {
	st := NewS3Storage(S3Config{
		Region: "auto", AccessKey: "k", SecretKey: "s", Bucket: "b",
		PublicURL: "http://cdn.example.com",
	})
	_, expires, err := st.PresignPut(context.Background(), "uploads/x.png", "image/png", 100)
	if err != nil {
		t.Fatalf("PresignPut: %v", err)
	}
	if expires != 15*time.Minute {
		t.Errorf("expires = %v, want default 15m", expires)
	}
}
```

Và vào `config_test.go`:

```go
func TestLoad_InvalidDurationEnvFails(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("STORAGE_PRESIGN_EXPIRES", "fifteen")
	if _, err := Load(); err == nil {
		t.Fatal("expected error for invalid duration env, got nil")
	}
}

func TestLoad_PresignExpiresDefault(t *testing.T) {
	t.Setenv("DATABASE_URL", "postgres://x")
	t.Setenv("STORAGE_PRESIGN_EXPIRES", "")
	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	if cfg.StoragePresignExpires != 15*time.Minute {
		t.Errorf("StoragePresignExpires = %v, want 15m", cfg.StoragePresignExpires)
	}
}
```

(`config_test.go` cần import thêm `time`.)

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `go test ./internal/modules/media/ ./internal/platform/config/ -run 'PresignExpires|Duration' -v`
Expected: COMPILE FAIL (`unknown field PresignExpires` / `StoragePresignExpires`).

- [ ] **Step 3: Sửa `storage_s3.go`**:

```go
// S3Config là cấu hình cho storage S3-compatible (MinIO/R2/S3).
type S3Config struct {
	Endpoint       string // rỗng = AWS mặc định
	Region         string
	AccessKey      string
	SecretKey      string
	Bucket         string
	PublicURL      string        // base URL công khai (không có dấu / cuối)
	UsePathStyle   bool          // true cho MinIO
	PresignExpires time.Duration // thời hạn presigned URL; 0 = mặc định 15 phút
}
```

`NewS3Storage` trả interface + dùng expires từ config:

```go
// NewS3Storage tạo storage S3-compatible từ cấu hình.
func NewS3Storage(cfg S3Config) Storage {
	client := s3.New(s3.Options{
		Region:       cfg.Region,
		Credentials:  credentials.NewStaticCredentialsProvider(cfg.AccessKey, cfg.SecretKey, ""),
		BaseEndpoint: endpointPtr(cfg.Endpoint),
		UsePathStyle: cfg.UsePathStyle,
	})
	expires := cfg.PresignExpires
	if expires <= 0 {
		expires = 15 * time.Minute
	}
	return &s3Storage{
		client:    client,
		presign:   s3.NewPresignClient(client),
		bucket:    cfg.Bucket,
		publicURL: strings.TrimRight(cfg.PublicURL, "/"),
		expires:   expires,
	}
}
```

- [ ] **Step 4: Sửa `config.go`** — thêm field vào struct `Config` (khối Object storage):

```go
	StoragePresignExpires time.Duration // thời hạn presigned URL (STORAGE_PRESIGN_EXPIRES, mặc định 15m)
```

Thêm helper (import `time`):

```go
func getDurationEnv(key string, fallback time.Duration) (time.Duration, error) {
	v := os.Getenv(key)
	if v == "" {
		return fallback, nil
	}
	d, err := time.ParseDuration(v)
	if err != nil || d <= 0 {
		return 0, fmt.Errorf("config: %s must be a positive duration (e.g. 15m), got %q", key, v)
	}
	return d, nil
}
```

Trong `Load()`, hoist cùng chỗ các biến Task 1:

```go
	presignExpires, err := getDurationEnv("STORAGE_PRESIGN_EXPIRES", 15*time.Minute)
	if err != nil {
		return Config{}, err
	}
```

và struct literal: `StoragePresignExpires: presignExpires,`.

- [ ] **Step 5: Wire `main.go`** — trong khối `media.NewS3Storage(media.S3Config{...})` thêm:

```go
		PresignExpires: cfg.StoragePresignExpires,
```

- [ ] **Step 6: `.env.example` + README** — sau dòng `STORAGE_USE_PATH_STYLE=true ...` thêm:

```
# Thời hạn presigned URL upload (Go duration). Mặc định 15m.
STORAGE_PRESIGN_EXPIRES=15m
```

README core, mục Object storage, thêm 1 dòng: `- STORAGE_PRESIGN_EXPIRES (mặc định 15m): thời hạn presigned PUT URL.`

- [ ] **Step 7: Chạy test pass + build**

Run: `go build ./... && go test ./internal/modules/media/ ./internal/platform/config/ -v`
Expected: PASS toàn bộ (kể cả `service_test.go` cũ vẫn expect 15m default).

- [ ] **Step 8: Commit**

```bash
git add internal/modules/media/ internal/platform/config/ cmd/api/main.go .env.example README.md
git commit -m "fix(media): NewS3Storage trả interface Storage + PresignExpires cấu hình qua env (L8)"
```

---

### Task 3: L9 — không leak lỗi bind ra client

**Files:**
- Modify: `services/core/internal/modules/posts/handler.go:260-271` (hàm `bindJSON`)
- Modify: `services/core/internal/modules/media/handler.go:43-50` (nhánh bind lỗi)
- Test: `services/core/internal/modules/posts/handler_test.go`

**Interfaces:**
- Consumes: `httperr.Write`, `reqlog.From` (import `github.com/vule96/ultimate-website/services/core/internal/shared/reqlog` — media/handler.go đã dùng sẵn).
- Produces: response 400 `INVALID_BODY` với message cố định `"invalid request body"` (admin FE chỉ dựa vào code, không parse message — không cần đổi FE).

- [ ] **Step 1: Viết test fail** — thêm vào `handler_test.go` (integration, cần TEST_DATABASE_URL; theo pattern `newServerWithAuth` sẵn có):

```go
func TestHandler_InvalidJSONBodyGenericMessage(t *testing.T) {
	r := newServerWithAuth(t, true)
	// JSON sai kiểu: title là số → lỗi unmarshal của Go có tên struct/field.
	body := `{"title": 123}`
	req := httptest.NewRequest(http.MethodPost, "/api/v1/posts", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", w.Code)
	}
	got := w.Body.String()
	if !strings.Contains(got, "invalid request body") {
		t.Errorf("body = %s, want generic message", got)
	}
	// Không được lộ internals Go (tên type, package, field Go).
	for _, leak := range []string{"json:", "Go struct", "unmarshal", "posts."} {
		if strings.Contains(got, leak) {
			t.Errorf("body leaks internals (%q): %s", leak, got)
		}
	}
}
```

(Kiểm tra import của file test đã có `net/http`, `net/http/httptest`, `strings` — thiếu thì thêm.)

- [ ] **Step 2: Chạy test, xác nhận fail**

Run (PowerShell, từ `services/core`): `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./internal/modules/posts/ -run TestHandler_InvalidJSONBodyGenericMessage -v`
Expected: FAIL — body hiện chứa message unmarshal của Go.

- [ ] **Step 3: Sửa `posts/handler.go`** — hàm `bindJSON` (thêm import `reqlog` nếu chưa có):

```go
// bindJSON bind body JSON vào dst; lỗi thì tự ghi response (400 hoặc 413) và trả false.
// Message trả client cố định — chi tiết lỗi chỉ ghi log (L9: không leak internals Go).
func bindJSON(c *gin.Context, dst any) bool {
	if err := c.ShouldBindJSON(dst); err != nil {
		if bodylimit.IsTooLarge(err) {
			httperr.Write(c, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "request body too large")
			return false
		}
		reqlog.From(c.Request.Context()).Info("bind json failed", "err", err)
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return false
	}
	return true
}
```

- [ ] **Step 4: Sửa `media/handler.go`** — nhánh bind lỗi trong `presign` (dòng 43-50), thay `err.Error()`:

```go
	if err := c.ShouldBindJSON(&req); err != nil {
		if bodylimit.IsTooLarge(err) {
			httperr.Write(c, http.StatusRequestEntityTooLarge, "PAYLOAD_TOO_LARGE", "request body too large")
			return
		}
		reqlog.From(c.Request.Context()).Info("bind json failed", "err", err)
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
```

(GIỮ nguyên nhánh `VALIDATION_ERROR` dòng 58 — đó là message domain, không phải internals.)

- [ ] **Step 5: Chạy test pass**

Run: `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./internal/modules/posts/ ./internal/modules/media/ -v`
Expected: PASS toàn bộ. Nếu có test cũ assert message chi tiết của bind → sửa test đó sang expect `"invalid request body"`.

- [ ] **Step 6: Commit**

```bash
git add internal/modules/posts/ internal/modules/media/
git commit -m "fix(http): bind lỗi trả message generic, chi tiết vào log — hết leak internals Go (L9)"
```

---

### Task 4: L10 — dọn orphan tags trong cùng transaction

**Files:**
- Modify: `services/core/internal/modules/posts/repository.go` (helper mới + gọi trong `Update`, `Delete`)
- Test: `services/core/internal/modules/posts/repository_test.go`

**Interfaces:**
- Produces: `deleteOrphanTags(tx *gorm.DB) error` (unexported helper trong package posts).

- [ ] **Step 1: Viết test fail** — thêm vào `repository_test.go`. Dùng slug tag unique (uuid) để không đụng data bẩn nếu DB không sạch:

```go
// tagInList kiểm tra slug có trong danh sách tag trả về không.
func tagInList(tags []Tag, slug string) bool {
	for _, tg := range tags {
		if tg.Slug == slug {
			return true
		}
	}
	return false
}

func TestRepo_UpdateCleansOrphanTags(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	orphan := "orphan-" + uuid.NewString()[:8]
	kept := "kept-" + uuid.NewString()[:8]

	p := samplePost("Bài A", "bai-a-"+uuid.NewString()[:8], StatusDraft, orphan, kept)
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}
	// Bài khác vẫn dùng tag kept → kept không được xoá.
	p2 := samplePost("Bài B", "bai-b-"+uuid.NewString()[:8], StatusDraft, kept)
	if err := repo.Create(ctx, p2); err != nil {
		t.Fatalf("create p2: %v", err)
	}

	// Update bỏ hết tags của bài A → orphan mồ côi, kept vẫn còn bài B.
	p.Tags = nil
	if err := repo.Update(ctx, p); err != nil {
		t.Fatalf("update: %v", err)
	}

	tags, err := repo.ListTags(ctx, false)
	if err != nil {
		t.Fatalf("list tags: %v", err)
	}
	if tagInList(tags, Slugify(orphan)) {
		t.Errorf("orphan tag %q vẫn còn sau update", orphan)
	}
	if !tagInList(tags, Slugify(kept)) {
		t.Errorf("tag %q đang được bài khác dùng mà bị xoá", kept)
	}
}

func TestRepo_DeleteCleansOrphanTags(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	orphan := "orphan-" + uuid.NewString()[:8]

	p := samplePost("Bài C", "bai-c-"+uuid.NewString()[:8], StatusDraft, orphan)
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := repo.Delete(ctx, p.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}

	tags, err := repo.ListTags(ctx, false)
	if err != nil {
		t.Fatalf("list tags: %v", err)
	}
	if tagInList(tags, Slugify(orphan)) {
		t.Errorf("orphan tag %q vẫn còn sau delete post", orphan)
	}
}
```

(Lưu ý: `samplePost` đã `Slugify` tên tag khi tạo — vì tên có uuid nên slug = lowercase của tên; assert bằng `Slugify(...)` cho chắc.)

- [ ] **Step 2: Chạy test, xác nhận fail**

Run: `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./internal/modules/posts/ -run 'CleansOrphanTags' -v`
Expected: FAIL — orphan tag vẫn còn trong list.

- [ ] **Step 3: Thêm helper vào `repository.go`** (khu vực `--- helpers ---`):

```go
// deleteOrphanTags xoá tag không còn liên kết với bài nào (L10). Gọi trong cùng
// transaction ngay sau khi thay tags (Update) hoặc xoá post (Delete) — xoá "nhầm"
// không mất gì vì lần dùng lại tag sẽ được upsert theo slug (M1).
func deleteOrphanTags(tx *gorm.DB) error {
	return tx.Exec(
		`DELETE FROM tags WHERE NOT EXISTS (SELECT 1 FROM post_tags WHERE post_tags.tag_id = tags.id)`,
	).Error
}
```

- [ ] **Step 4: Gọi helper trong `Update` và `Delete`**

Trong `Update`, ngay SAU `Association("Tags").Replace(tags)` (trước khi nạp `fresh`):

```go
		if err := deleteOrphanTags(tx); err != nil {
			return err
		}
```

Trong `Delete`, ngay SAU khối check `RowsAffected == 0` (trước `outbox.Write`):

```go
		if err := deleteOrphanTags(tx); err != nil {
			return err
		}
```

- [ ] **Step 5: Chạy test pass** (toàn module — đảm bảo không phá test cũ như Stats.Tags đếm 2 tags còn sống):

Run: `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./internal/modules/posts/ -v`
Expected: PASS toàn bộ.

- [ ] **Step 6: Commit**

```bash
git add internal/modules/posts/
git commit -m "fix(posts): dọn orphan tags trong cùng tx sau update/delete (L10)"
```

---

### Task 5: L12 (infra) — tự động tạo `blog_test` trong docker-compose

**Files:**
- Create: `docker/postgres-init/10-create-test-db.sql`
- Modify: `docker-compose.yml` (mount thư mục init)
- Modify: `services/core/README.md` (mục test — DB test tự tạo với volume mới)

**Interfaces:**
- Produces: database `blog_test` (owner `blog`) có sẵn trên volume Postgres mới; volume cũ vẫn dùng lệnh `createdb` một-lần trong README.

- [ ] **Step 1: Tạo `docker/postgres-init/10-create-test-db.sql`**:

```sql
-- Tạo DB test cách li khỏi dev DB (L12). Script trong docker-entrypoint-initdb.d
-- chỉ chạy khi volume Postgres MỚI; volume cũ dùng lệnh createdb trong README core.
CREATE DATABASE blog_test OWNER blog;
```

- [ ] **Step 2: Mount vào `docker-compose.yml`** — service `postgres`, khối `volumes`:

```yaml
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres-init:/docker-entrypoint-initdb.d:ro
```

- [ ] **Step 3: Validate compose + tạo DB cho volume hiện tại**

Run: `docker compose config --quiet` → Expected: không lỗi.
Run (volume hiện tại đã init từ trước nên script không tự chạy): `docker exec ultimate_postgres psql -U blog -d blog -tAc "SELECT 1 FROM pg_database WHERE datname='blog_test'"` — nếu KHÔNG in `1` thì chạy `docker exec ultimate_postgres createdb -U blog blog_test`.

(KHÔNG chạy `docker compose down -v` — sẽ mất dev data. Verify script trên volume mới là bước optional cuối slice, chỉ làm nếu người dùng đồng ý.)

- [ ] **Step 4: Cập nhật `services/core/README.md`** — mục chạy integration test (quanh dòng 45-47), sửa thành:

```markdown
# Kèm integration test (repository/handler) → cần DB test `blog_test`
# (volume Postgres mới sẽ tự có nhờ docker/postgres-init; volume cũ tạo 1 lần:)
docker exec ultimate_postgres createdb -U blog blog_test   # chỉ cần với volume cũ
TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable" go test ./...
```

- [ ] **Step 5: Chạy toàn bộ test core trên `blog_test`**

Run: `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./...`
Expected: PASS toàn bộ (test tự AutoMigrate schema vào blog_test).

- [ ] **Step 6: Commit**

```bash
git add ../../docker/postgres-init/ ../../docker-compose.yml README.md
git commit -m "chore(dev): tự tạo DB blog_test qua postgres-init — cách li test khỏi dev DB (L12)"
```

---

### Task 6: L12 (test robust) — test đếm chống DB bẩn + dispatcher scope theo event

**Files:**
- Modify: `services/core/internal/modules/posts/repository_test.go` (`TestRepo_List`, `TestRepo_Search` [tên thật có thể khác — test quanh dòng 142-201], `TestRepo_Stats` [dòng 205+], test sort-fallback [dòng 256+])
- Modify: `services/core/internal/platform/outbox/outbox_test.go` (`fakeHandler`, 2 test dispatcher)

**Interfaces:**
- Consumes: `newRepoTx`, `samplePost`, `newTx` (helpers sẵn có).
- Produces: không đổi API nào — chỉ test. Dispatcher production giữ nguyên hành vi.

- [ ] **Step 1: `TestRepo_Stats` → đo delta.** Sửa test hiện có (dòng ~205): trước khi tạo data, gọi `repo.Stats(ctx)` lưu `before`; sau khi tạo, assert delta:

```go
func TestRepo_Stats(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	before, err := repo.Stats(ctx)
	if err != nil {
		t.Fatalf("stats before: %v", err)
	}
	// ... (giữ nguyên phần seed 4 bài hiện có của test) ...

	s, err := repo.Stats(ctx)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if got := s.Total - before.Total; got != 4 {
		t.Errorf("Total delta = %d, want 4", got)
	}
	// Tương tự: (s.Published - before.Published), (s.Draft - before.Draft),
	// (s.Tags - before.Tags) — giữ nguyên giá trị want của test cũ.
}
```

Áp cùng pattern cho MỌI assertion đếm trong test này (Published/Draft/Tags). LƯU Ý: nếu seed của test dùng tag slug cố định (vd "go") có thể đã tồn tại trong DB bẩn → delta Tags sai; đổi tag trong phần seed sang slug unique (`"go-"+uuid.NewString()[:8]`) và cập nhật want tương ứng.

- [ ] **Step 2: `TestRepo_List` + search + sort-fallback → scope bằng token unique.** Nguyên tắc: mỗi test tạo `tok := uuid.NewString()[:8]`; mọi bài seed có `Title` chứa `tok` (vd `"Hello "+tok`); mọi lời gọi `repo.List` thêm `Search: tok` vào filter (Search AND với Status/Tag nên không đổi ngữ nghĩa test); tag filter dùng slug tag unique (`"go-"+tok`). Giữ nguyên các giá trị want. Ví dụ pagination:

```go
	tok := uuid.NewString()[:8]
	// seed 3 bài, Title đều chứa tok ...
	page1, total, err := repo.List(ctx, ListFilter{Search: tok, Limit: 1, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 3 || len(page1) != 1 {
		t.Errorf("page1: total=%d len=%d, want 3/1", total, len(page1))
	}
```

Với test search tiếng Việt (`"người mới"` dòng ~187): giữ nội dung tiếng Việt nhưng nhét tok vào title (vd `"Rust cho người mới "+tok`) và search bằng `"người mới "+tok`.

- [ ] **Step 3: Chạy test posts pass**

Run: `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./internal/modules/posts/ -v`
Expected: PASS. Smoke-test chống DB bẩn: trỏ `TEST_DATABASE_URL` sang dev `blog` (có seed data) chạy lại `-run 'TestRepo_(List|Stats|Search)'` → vẫn PASS.

- [ ] **Step 4: Dispatcher test scope theo event id.** Sửa `fakeHandler` trong `outbox_test.go` — chỉ quan tâm aggregate của test, event lạ (từ DB bẩn) cho qua:

```go
// fakeHandler ghi lại event của đúng aggregate đang test (event lạ từ DB bẩn
// cho qua — L12); failN lần đầu trả lỗi cho aggregate đó.
type fakeHandler struct {
	only  uuid.UUID
	got   []Event
	failN int
}

func (f *fakeHandler) Handle(_ context.Context, e Event) error {
	if e.AggregateID != f.only {
		return nil
	}
	if f.failN > 0 {
		f.failN--
		return fmt.Errorf("boom")
	}
	f.got = append(f.got, e)
	return nil
}
```

Cập nhật 2 test khởi tạo handler: `h := &fakeHandler{only: id}` và `h := &fakeHandler{only: id, failN: 1}`. Assertions giữ nguyên (đã query theo `aggregate_id = ?`).

- [ ] **Step 5: Chạy test outbox pass**

Run: `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./internal/platform/outbox/ -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add internal/modules/posts/repository_test.go internal/platform/outbox/outbox_test.go
git commit -m "test(core): test đếm theo delta/token + dispatcher-test scope aggregate — chống DB bẩn (L12)"
```

---

### Task 7: Verify E2E + cập nhật tracker & CLAUDE.md + merge

**Files:**
- Modify: `docs/reviews/2026-07-11-senior-code-review.md` (đánh dấu L8, L9, L10, L11, L12 RESOLVED)
- Modify: `CLAUDE.md` (mục Trạng thái hiện tại + 📍 Điểm hiện tại)

- [ ] **Step 1: Toàn bộ test core xanh**

Run (từ `services/core`): `$env:TEST_DATABASE_URL="postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"; go test ./...`
Expected: PASS toàn bộ, không skip module nào ngoài dự kiến.

- [ ] **Step 2: Verify E2E bằng curl** — chạy core (`go run ./cmd/api`, cần Docker Postgres/MinIO đang chạy + `.env`), rồi:

1. **L9:** `curl -i -X POST http://localhost:8080/api/v1/posts -H "Content-Type: application/json" -d "{\"title\":123}"` → expect 401 (chưa login — RequireAuth trước bind) — vậy verify L9 qua test integration là đủ; NẾU muốn verify sống, tạm dùng route công khai không có → chấp nhận evidence từ test.
2. **L11:** `$env:SESSION_COOKIE_SECURE="ture"; go run ./cmd/api` → expect process exit ngay với message `config: SESSION_COOKIE_SECURE must be a boolean...`. Nhớ `Remove-Item Env:SESSION_COOKIE_SECURE` sau đó.
3. **L8:** với `.env` có `STORAGE_PRESIGN_EXPIRES=5m`, login admin (hoặc dùng test service_test) → response presign `expires_in` = 300. Evidence từ unit test là đủ nếu không tiện login.

- [ ] **Step 3: Đánh dấu RESOLVED trong tracker** — sửa `docs/reviews/2026-07-11-senior-code-review.md` các dòng L8 (dòng 86), L9 (87), L10 (88), L11 (89 — bỏ "một phần", giờ full), L12 (90): thêm hậu tố `✅ RESOLVED (2026-07-12, commit <hash Task tương ứng>)` — giữ nguyên nội dung finding.

- [ ] **Step 4: Cập nhật `CLAUDE.md`** — mục "Trạng thái hiện tại": thêm bullet `✅ Slice 5e — DONE (dọn backlog Low): L8, L9, L10, L11, L12...` (kèm spec/plan path); cập nhật dòng Issue tracker (backlog Low sạch, chỉ còn L1–L6 chưa yêu cầu) + dòng "📍 Điểm hiện tại" (backlog review sạch; bước kế tiếp: Deploy production hoặc Phase 2 — chưa chốt).

- [ ] **Step 5: Commit docs + merge về main**

```bash
git add docs/reviews/2026-07-11-senior-code-review.md CLAUDE.md
git commit -m "docs: Slice 5e DONE — resolve L8-L12, cập nhật tracker + CLAUDE.md"
git checkout main
git merge --no-ff slice-5e-low-backlog -m "merge: Slice 5e — dọn backlog Low (L8-L12)"
```

(Không push — chờ người dùng quyết.)
