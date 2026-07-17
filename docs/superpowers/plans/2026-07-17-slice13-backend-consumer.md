# Slice 13 — Backend consumer Mạch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay mock localStorage của trang chủ Mạch bằng backend thật — reader auth (Google OAuth BFF), bookmark + newsletter ở Postgres, cộng rate limit Redis cho endpoint public và dedupe view per-user.

**Architecture:** Module Go mới `internal/modules/readers` (clean-lite: domain → repository → service → handler) tái dùng `auth.OAuthProvider`/`auth.Identity`/`auth.NewGoogleProvider` nhưng session key riêng (`reader_id`) và KHÔNG allowlist. Rate limit + view dedupe là 2 tiện ích Redis dùng `redis.Cmdable` (test bằng miniredis). Frontend flip các service seam sẵn có (`bookmark-service.ts`, `newsletter-service.ts`, auth trong `magazine-store`) sang impl gọi API với `credentials: "include"`.

**Tech Stack:** Go 1.22 (Gin + GORM + Atlas + scs + go-redis v9), Postgres 16 (citext), Redis 7; Next.js 14 (App Router, next-intl, Zustand, vitest).

## Global Constraints

- Backend: mọi module theo clean-lite (domain → repository → service → handler); lỗi HTTP qua `shared/httperr.Write(c, status, code, msg)`; envelope lỗi `{"error":{"code","message"}}`.
- Session dùng chung 1 `scs.SessionManager`; key admin = `"admin_email"`, key reader = `"reader_id"` — **không đụng nhau**.
- Redis chết ở rate limit + dedupe = **fail-open** (cho qua / đếm bình thường), chỉ log warn.
- Endpoint state-changing (`POST/PUT/DELETE`) đặt sau `jsonmw.RequireJSON()` (đã có) — trừ endpoint OAuth GET redirect.
- `returnTo` / redirect phải guard open-redirect: chỉ chấp nhận path bắt đầu bằng đúng một `/` (không `//`, không `\`, không scheme).
- Tất cả giao tiếp/commit/docs bằng **tiếng Việt**; commit cuối mỗi task kết thúc bằng dòng `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Test Go chạy với DB `blog_test` (đã cấu hình từ Slice 5e): `go test ./...` trong `services/core`.
- Web test: `pnpm --filter @ultimate/web test`. Types: `pnpm --filter @ultimate/types build` sau khi sửa schema. i18n: `pnpm --filter @ultimate/web i18n:gen` sau khi thêm message key.
- Branch: `slice-13-backend-consumer` (đã tạo).

---

## File Structure

**Backend — tạo mới:**
- `services/core/internal/modules/readers/model.go` — GORM models `readerRow`, `bookmarkRow`, `subscriberRow` + `Models()` cho Atlas + domain structs `Reader`.
- `services/core/internal/modules/readers/repository.go` — interface `Repository` + `GormRepository` (upsert reader, get reader, bookmark add/remove/list, subscriber upsert).
- `services/core/internal/modules/readers/service.go` — `Service`: reader OAuth flow (StartLogin/CompleteLogin không allowlist), UpsertReader, bookmark ops, Subscribe.
- `services/core/internal/modules/readers/auth_handler.go` — `AuthHandler` + routes `/auth/reader/*` + middleware `RequireReader`.
- `services/core/internal/modules/readers/bookmark_handler.go` — `BookmarkHandler` + routes `/readers/me/bookmarks*`.
- `services/core/internal/modules/readers/subscriber_handler.go` — `SubscriberHandler` + route `POST /subscribers`.
- `services/core/internal/modules/readers/*_test.go` — test service/repo/handler/middleware.
- `services/core/internal/shared/ratelimit/ratelimit.go` — middleware `PerIP` + `redis.Cmdable`.
- `services/core/internal/shared/ratelimit/ratelimit_test.go`.
- `services/core/internal/modules/posts/dedupe.go` — `ViewDeduper` (SADD + TTL, fail-open).
- `services/core/internal/modules/posts/dedupe_test.go`.
- `services/core/internal/shared/redirect/redirect.go` — helper `SafePath(raw) (string, bool)` open-redirect guard (nếu chưa có; admin FE có mẫu nhưng ở TS — đây là bản Go).

**Backend — sửa:**
- `services/core/internal/platform/cache/redis.go` — thêm accessor `Client() *redis.Client`.
- `services/core/internal/platform/config/config.go` — env mới (`READER_REDIRECT_URL`, `WEB_BASE_URL`, `VIEW_DEDUP_SALT`, `CORS_ALLOWED_ORIGINS` đã có).
- `services/core/internal/modules/posts/handler.go` — `WithDeduper` + gọi dedupe trong `view`.
- `services/core/cmd/api/main.go` — wiring readers, ratelimit, deduper, reader provider.
- `services/core/cmd/atlas-loader/main.go` — thêm `readers.Models()` vào tập model Atlas.
- `services/core/.env.example` — env mới.
- `services/core/README.md` — mục reader auth + Google reader redirect URI.

**Frontend — sửa:**
- `apps/web/src/features/magazine/services/bookmark-service.ts` — interface async + `apiBookmarkService`.
- `apps/web/src/features/magazine/services/newsletter-service.ts` — `apiNewsletterService`.
- `apps/web/src/features/magazine/store/magazine-store.ts` — `hydrate`, `toggleSave` optimistic, `logout` API, user type thật.
- `apps/web/src/features/magazine/components/auth-modal.tsx` — nút "Tiếp tục với Google".
- `apps/web/src/features/magazine/types.ts` — đổi `MockUser` → `Reader`.
- `apps/web/src/lib/api.ts` (hoặc nơi định nghĩa API base) — helper reader endpoints.
- `apps/web/messages/vi.json` — key mới; `en.json` sinh qua i18n:gen.
- `apps/web/src/features/magazine/**/*.test.ts(x)` — cập nhật + test mới.

---

## PHASE 1 — DB & migration

### Task 1: Models + migration cho readers/bookmarks/subscribers

**Files:**
- Create: `services/core/internal/modules/readers/model.go`
- Modify: `services/core/cmd/atlas-loader/main.go`
- Test: (migration verify thủ công — không unit test)

**Interfaces:**
- Produces: `readers.Models() []any`; GORM structs `readerRow`, `bookmarkRow`, `subscriberRow`; domain `readers.Reader{ID uuid.UUID; GoogleSub, Email, Name string}`.

- [ ] **Step 1: Viết `model.go`**

```go
// Package readers quản lý người đọc blog (auth Google OAuth — KHÁC admin allowlist),
// bookmark bài viết và đăng ký newsletter.
package readers

import (
	"time"

	"github.com/google/uuid"
)

// Reader là danh tính người đọc đã đăng nhập (domain).
type Reader struct {
	ID        uuid.UUID
	GoogleSub string
	Email     string
	Name      string
}

// readerRow map bảng readers.
type readerRow struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	GoogleSub string    `gorm:"column:google_sub;type:text;not null;uniqueIndex"`
	Email     string    `gorm:"type:text;not null"`
	Name      string    `gorm:"type:text"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
	UpdatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
}

func (readerRow) TableName() string { return "readers" }

// bookmarkRow map bảng bookmarks (khoá chính kép reader_id+post_id).
type bookmarkRow struct {
	ReaderID  uuid.UUID `gorm:"column:reader_id;type:uuid;primaryKey"`
	PostID    uuid.UUID `gorm:"column:post_id;type:uuid;primaryKey"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
}

func (bookmarkRow) TableName() string { return "bookmarks" }

// subscriberRow map bảng subscribers. Email dùng citext (unique không phân biệt hoa/thường).
type subscriberRow struct {
	ID        uuid.UUID `gorm:"type:uuid;primaryKey;default:gen_random_uuid()"`
	Email     string    `gorm:"type:citext;not null;uniqueIndex"`
	Status    string    `gorm:"type:text;not null;default:'active'"`
	CreatedAt time.Time `gorm:"type:timestamptz;not null;default:now()"`
}

func (subscriberRow) TableName() string { return "subscribers" }

// Models trả model của package cho Atlas.
func Models() []any { return []any{&readerRow{}, &bookmarkRow{}, &subscriberRow{}} }
```

> Ghi chú FK: GORM tag không tạo FK cross-package tin cậy được ở đây; FK `bookmarks.reader_id → readers.id` và `bookmarks.post_id → posts.id` (ON DELETE CASCADE) + extension citext sẽ được thêm thủ công vào file migration sinh ra ở Step 4 (chỉnh SQL trước khi apply).

- [ ] **Step 2: Đăng ký models vào atlas-loader**

Mở `services/core/cmd/atlas-loader/main.go`, tìm chỗ gom models (vd `posts.Models()`, `auth`/`session.Models()`), thêm `readers.Models()` vào slice tổng (import `.../internal/modules/readers`). Ví dụ pattern hiện có:

```go
models := []any{}
models = append(models, posts.Models()...)
models = append(models, session.Models()...)
models = append(models, outbox.Models()...)
models = append(models, readers.Models()...) // MỚI
```

(Đọc file để khớp đúng biến/cách gom hiện tại — giữ nguyên style.)

- [ ] **Step 3: Sinh migration Atlas**

Run (trong `services/core`):
```bash
./atlas.exe migrate diff add_readers --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"
```
Expected: sinh file mới trong `services/core/migrations/` tạo 3 bảng.

- [ ] **Step 4: Chỉnh file migration — citext + FK cascade**

Mở file migration vừa sinh. **Thêm dòng đầu**:
```sql
CREATE EXTENSION IF NOT EXISTS citext;
```
Đảm bảo cột `subscribers.email` là `citext` (nếu Atlas sinh ra `text`, sửa lại thành `citext`). Thêm FK vào bảng `bookmarks` (nếu Atlas chưa sinh):
```sql
ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_reader"
  FOREIGN KEY ("reader_id") REFERENCES "readers" ("id") ON DELETE CASCADE;
ALTER TABLE "bookmarks" ADD CONSTRAINT "fk_bookmarks_post"
  FOREIGN KEY ("post_id") REFERENCES "posts" ("id") ON DELETE CASCADE;
```
Rồi cập nhật hash: `./atlas.exe migrate hash --env gorm`.

- [ ] **Step 5: Apply migration**

Run:
```bash
./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog?sslmode=disable"
```
Expected: applied, 3 bảng tồn tại. Verify: `psql ... -c "\dt"` thấy readers/bookmarks/subscribers.

- [ ] **Step 6: Apply migration lên `blog_test`** (để test Go dùng được)

Run:
```bash
./atlas.exe migrate apply --env gorm --url "postgres://blog:blog@localhost:5432/blog_test?sslmode=disable"
```
(Nếu quy trình test tự migrate — kiểm tra `postgres-init`/test setup Slice 5e — thì bỏ qua; đảm bảo blog_test có bảng trước khi chạy test repo.)

- [ ] **Step 7: Commit**

```bash
git add services/core/internal/modules/readers/model.go services/core/cmd/atlas-loader/main.go services/core/migrations/
git commit -m "feat(readers): models + migration readers/bookmarks/subscribers (citext + FK cascade)"
```

---

## PHASE 2 — readers repository

### Task 2: Repository (reader upsert/get, bookmark add/remove/list, subscriber upsert)

**Files:**
- Create: `services/core/internal/modules/readers/repository.go`
- Test: `services/core/internal/modules/readers/repository_test.go`

**Interfaces:**
- Consumes: models từ Task 1.
- Produces:
```go
type Repository interface {
	UpsertReader(ctx context.Context, googleSub, email, name string) (Reader, error)
	GetReader(ctx context.Context, id uuid.UUID) (Reader, error)
	AddBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	RemoveBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	ListBookmarks(ctx context.Context, readerID uuid.UUID) ([]uuid.UUID, error)
	UpsertSubscriber(ctx context.Context, email string) error
}
var ErrReaderNotFound = errors.New("reader not found")
func NewGormRepository(db *gorm.DB) *GormRepository
```

- [ ] **Step 1: Viết test repository (DB test)**

`repository_test.go` — theo pattern test DB hiện có (mở `blog_test` qua helper chung; xem `posts/repository_test.go` để lấy đúng cách tạo `*gorm.DB` test + cleanup). Test:

```go
package readers

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestUpsertReader_CreateThenUpdate(t *testing.T) {
	db := newTestDB(t) // helper dùng chung với các module (blog_test) — xem posts test
	repo := NewGormRepository(db)
	ctx := context.Background()
	sub := "sub-" + uuid.NewString()

	r1, err := repo.UpsertReader(ctx, sub, "a@example.com", "A")
	require.NoError(t, err)
	require.NotEqual(t, uuid.Nil, r1.ID)
	require.Equal(t, "a@example.com", r1.Email)

	// Upsert lại cùng google_sub → cập nhật email/name, giữ nguyên ID.
	r2, err := repo.UpsertReader(ctx, sub, "a2@example.com", "A2")
	require.NoError(t, err)
	require.Equal(t, r1.ID, r2.ID)
	require.Equal(t, "a2@example.com", r2.Email)
	require.Equal(t, "A2", r2.Name)
}

func TestBookmarks_AddIdempotentListRemove(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	r, _ := repo.UpsertReader(ctx, "sub-"+uuid.NewString(), "b@example.com", "B")
	post := seedPost(t, db) // helper tạo 1 post hợp lệ (FK) — xem posts test seed

	require.NoError(t, repo.AddBookmark(ctx, r.ID, post))
	require.NoError(t, repo.AddBookmark(ctx, r.ID, post)) // idempotent, không lỗi
	ids, err := repo.ListBookmarks(ctx, r.ID)
	require.NoError(t, err)
	require.Equal(t, []uuid.UUID{post}, ids)

	require.NoError(t, repo.RemoveBookmark(ctx, r.ID, post))
	require.NoError(t, repo.RemoveBookmark(ctx, r.ID, post)) // idempotent
	ids, _ = repo.ListBookmarks(ctx, r.ID)
	require.Empty(t, ids)
}

func TestUpsertSubscriber_Idempotent(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	email := uuid.NewString() + "@example.com"

	require.NoError(t, repo.UpsertSubscriber(ctx, email))
	require.NoError(t, repo.UpsertSubscriber(ctx, email))      // trùng → no-op
	require.NoError(t, repo.UpsertSubscriber(ctx, "UP"+email)) // citext: khác literal
}

func TestGetReader_NotFound(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	_, err := repo.GetReader(context.Background(), uuid.New())
	require.ErrorIs(t, err, ErrReaderNotFound)
}
```

> `newTestDB`, `seedPost`: nếu chưa có helper dùng chung, tạo `readers/testhelpers_test.go` sao chép cách `posts/repository_test.go` mở DB + tạo post tối thiểu. Đọc file đó trước để khớp.

- [ ] **Step 2: Chạy test — fail (chưa có impl)**

Run: `go test ./internal/modules/readers/ -run TestUpsertReader_CreateThenUpdate -v`
Expected: FAIL (undefined: NewGormRepository).

- [ ] **Step 3: Viết `repository.go`**

```go
package readers

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrReaderNotFound = errors.New("reader not found")

type Repository interface {
	UpsertReader(ctx context.Context, googleSub, email, name string) (Reader, error)
	GetReader(ctx context.Context, id uuid.UUID) (Reader, error)
	AddBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	RemoveBookmark(ctx context.Context, readerID, postID uuid.UUID) error
	ListBookmarks(ctx context.Context, readerID uuid.UUID) ([]uuid.UUID, error)
	UpsertSubscriber(ctx context.Context, email string) error
}

type GormRepository struct{ db *gorm.DB }

func NewGormRepository(db *gorm.DB) *GormRepository { return &GormRepository{db: db} }

func toReader(r readerRow) Reader {
	return Reader{ID: r.ID, GoogleSub: r.GoogleSub, Email: r.Email, Name: r.Name}
}

// UpsertReader tạo mới hoặc cập nhật email/name theo google_sub (định danh ổn định).
func (r *GormRepository) UpsertReader(ctx context.Context, googleSub, email, name string) (Reader, error) {
	row := readerRow{GoogleSub: googleSub, Email: email, Name: name}
	err := r.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "google_sub"}},
			DoUpdates: clause.Assignments(map[string]any{"email": email, "name": name, "updated_at": gorm.Expr("now()")}),
		}).
		Create(&row).Error
	if err != nil {
		return Reader{}, err
	}
	// Sau upsert, row.ID có thể chưa được nạp khi conflict → đọc lại theo google_sub.
	var out readerRow
	if err := r.db.WithContext(ctx).Where("google_sub = ?", googleSub).First(&out).Error; err != nil {
		return Reader{}, err
	}
	return toReader(out), nil
}

func (r *GormRepository) GetReader(ctx context.Context, id uuid.UUID) (Reader, error) {
	var row readerRow
	err := r.db.WithContext(ctx).Where("id = ?", id).First(&row).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return Reader{}, ErrReaderNotFound
	}
	if err != nil {
		return Reader{}, err
	}
	return toReader(row), nil
}

func (r *GormRepository) AddBookmark(ctx context.Context, readerID, postID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&bookmarkRow{ReaderID: readerID, PostID: postID}).Error
}

func (r *GormRepository) RemoveBookmark(ctx context.Context, readerID, postID uuid.UUID) error {
	return r.db.WithContext(ctx).
		Where("reader_id = ? AND post_id = ?", readerID, postID).
		Delete(&bookmarkRow{}).Error
}

func (r *GormRepository) ListBookmarks(ctx context.Context, readerID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := r.db.WithContext(ctx).Model(&bookmarkRow{}).
		Where("reader_id = ?", readerID).
		Order("created_at DESC").
		Pluck("post_id", &ids).Error
	return ids, err
}

func (r *GormRepository) UpsertSubscriber(ctx context.Context, email string) error {
	return r.db.WithContext(ctx).
		Clauses(clause.OnConflict{DoNothing: true}).
		Create(&subscriberRow{Email: email}).Error
}
```

- [ ] **Step 4: Chạy test — pass**

Run: `go test ./internal/modules/readers/ -v`
Expected: PASS toàn bộ test repository.

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/modules/readers/repository.go services/core/internal/modules/readers/repository_test.go services/core/internal/modules/readers/testhelpers_test.go
git commit -m "feat(readers): repository — reader upsert, bookmark, subscriber (idempotent, DB test)"
```

---

## PHASE 3 — readers service + reader OAuth flow

### Task 3: Service — reader OAuth (no allowlist) + bookmark + subscribe + email validate

**Files:**
- Create: `services/core/internal/modules/readers/service.go`
- Test: `services/core/internal/modules/readers/service_test.go`

**Interfaces:**
- Consumes: `Repository` (Task 2); `auth.OAuthProvider`, `auth.Identity`, `auth.ErrStateMismatch`, `auth.ErrEmailNotVerified` (import `.../modules/auth`).
- Produces:
```go
type Service struct{ ... }
func NewService(repo Repository, provider auth.OAuthProvider) *Service
func (s *Service) StartLogin() (state, verifier, url string, err error)
func (s *Service) CompleteLogin(ctx, code, gotState, wantState, verifier string) (Reader, error)
func (s *Service) GetReader(ctx, id uuid.UUID) (Reader, error)
func (s *Service) Bookmarks(ctx, readerID uuid.UUID) ([]uuid.UUID, error)
func (s *Service) AddBookmark(ctx, readerID, postID uuid.UUID) error
func (s *Service) RemoveBookmark(ctx, readerID, postID uuid.UUID) error
func (s *Service) Subscribe(ctx, email string) error
var ErrInvalidEmail = errors.New("invalid email")
```

- [ ] **Step 1: Viết test service**

`service_test.go` — dùng fake provider (mô phỏng `auth.OAuthProvider`) + fake repo (in-memory). Kiểm: CompleteLogin state mismatch → lỗi; email chưa verified → lỗi; hợp lệ → upsert reader (KHÔNG cần allowlist); Subscribe email rác → ErrInvalidEmail.

```go
package readers

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
)

type fakeProvider struct {
	id      auth.Identity
	authURL string
	err     error
}

func (f fakeProvider) AuthCodeURL(state, verifier string) string { return f.authURL }
func (f fakeProvider) Exchange(ctx context.Context, code, verifier string) (auth.Identity, error) {
	return f.id, f.err
}

type fakeRepo struct {
	readers map[string]Reader // key google_sub
	subs    map[string]bool
}

func newFakeRepo() *fakeRepo { return &fakeRepo{readers: map[string]Reader{}, subs: map[string]bool{}} }
func (r *fakeRepo) UpsertReader(_ context.Context, sub, email, name string) (Reader, error) {
	rd, ok := r.readers[sub]
	if !ok {
		rd = Reader{ID: uuid.New(), GoogleSub: sub}
	}
	rd.Email, rd.Name = email, name
	r.readers[sub] = rd
	return rd, nil
}
func (r *fakeRepo) GetReader(_ context.Context, id uuid.UUID) (Reader, error) {
	for _, rd := range r.readers {
		if rd.ID == id {
			return rd, nil
		}
	}
	return Reader{}, ErrReaderNotFound
}
func (r *fakeRepo) AddBookmark(context.Context, uuid.UUID, uuid.UUID) error    { return nil }
func (r *fakeRepo) RemoveBookmark(context.Context, uuid.UUID, uuid.UUID) error { return nil }
func (r *fakeRepo) ListBookmarks(context.Context, uuid.UUID) ([]uuid.UUID, error) {
	return nil, nil
}
func (r *fakeRepo) UpsertSubscriber(_ context.Context, email string) error { r.subs[email] = true; return nil }

func TestCompleteLogin_NoAllowlist_UpsertsReader(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, fakeProvider{id: auth.Identity{Email: "x@y.com", EmailVerified: true, Sub: "s1", Name: "X"}})
	rd, err := svc.CompleteLogin(context.Background(), "code", "st", "st", "vf")
	require.NoError(t, err)
	require.Equal(t, "x@y.com", rd.Email)
	require.Len(t, repo.readers, 1) // ai cũng vào — không allowlist
}

func TestCompleteLogin_StateMismatch(t *testing.T) {
	svc := NewService(newFakeRepo(), fakeProvider{})
	_, err := svc.CompleteLogin(context.Background(), "c", "bad", "want", "vf")
	require.ErrorIs(t, err, auth.ErrStateMismatch)
}

func TestCompleteLogin_EmailNotVerified(t *testing.T) {
	svc := NewService(newFakeRepo(), fakeProvider{id: auth.Identity{Email: "x@y.com", EmailVerified: false, Sub: "s"}})
	_, err := svc.CompleteLogin(context.Background(), "c", "st", "st", "vf")
	require.ErrorIs(t, err, auth.ErrEmailNotVerified)
}

func TestSubscribe_InvalidEmail(t *testing.T) {
	svc := NewService(newFakeRepo(), fakeProvider{})
	require.ErrorIs(t, svc.Subscribe(context.Background(), "not-an-email"), ErrInvalidEmail)
}

func TestSubscribe_Valid(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, fakeProvider{})
	require.NoError(t, svc.Subscribe(context.Background(), "ok@example.com"))
	require.True(t, repo.subs["ok@example.com"])
}

var _ = errors.Is // giữ import errors nếu cần
```

- [ ] **Step 2: Chạy test — fail**

Run: `go test ./internal/modules/readers/ -run TestCompleteLogin -v`
Expected: FAIL (undefined NewService).

- [ ] **Step 3: Viết `service.go`**

```go
package readers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"net/mail"
	"strings"

	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
)

var ErrInvalidEmail = errors.New("invalid email")

// Service business logic reader: OAuth (không allowlist), bookmark, newsletter.
type Service struct {
	repo     Repository
	provider auth.OAuthProvider
}

func NewService(repo Repository, provider auth.OAuthProvider) *Service {
	return &Service{repo: repo, provider: provider}
}

// StartLogin sinh state + PKCE verifier + URL redirect (giống admin nhưng flow riêng).
func (s *Service) StartLogin() (state, verifier, url string, err error) {
	if state, err = randomToken(); err != nil {
		return "", "", "", err
	}
	if verifier, err = randomToken(); err != nil {
		return "", "", "", err
	}
	return state, verifier, s.provider.AuthCodeURL(state, verifier), nil
}

// CompleteLogin: khớp state, đổi code, bắt buộc email verified, KHÔNG check allowlist,
// upsert reader theo google_sub.
func (s *Service) CompleteLogin(ctx context.Context, code, gotState, wantState, verifier string) (Reader, error) {
	if wantState == "" || gotState != wantState {
		return Reader{}, auth.ErrStateMismatch
	}
	id, err := s.provider.Exchange(ctx, code, verifier)
	if err != nil {
		return Reader{}, err
	}
	if !id.EmailVerified {
		return Reader{}, auth.ErrEmailNotVerified
	}
	return s.repo.UpsertReader(ctx, id.Sub, id.Email, id.Name)
}

func (s *Service) GetReader(ctx context.Context, id uuid.UUID) (Reader, error) {
	return s.repo.GetReader(ctx, id)
}

func (s *Service) Bookmarks(ctx context.Context, readerID uuid.UUID) ([]uuid.UUID, error) {
	return s.repo.ListBookmarks(ctx, readerID)
}

func (s *Service) AddBookmark(ctx context.Context, readerID, postID uuid.UUID) error {
	return s.repo.AddBookmark(ctx, readerID, postID)
}

func (s *Service) RemoveBookmark(ctx context.Context, readerID, postID uuid.UUID) error {
	return s.repo.RemoveBookmark(ctx, readerID, postID)
}

// Subscribe validate email rồi upsert (idempotent). Email rác → ErrInvalidEmail.
func (s *Service) Subscribe(ctx context.Context, email string) error {
	email = strings.TrimSpace(strings.ToLower(email))
	if _, err := mail.ParseAddress(email); err != nil {
		return ErrInvalidEmail
	}
	return s.repo.UpsertSubscriber(ctx, email)
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
```

- [ ] **Step 4: Chạy test — pass**

Run: `go test ./internal/modules/readers/ -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/modules/readers/service.go services/core/internal/modules/readers/service_test.go
git commit -m "feat(readers): service — reader OAuth (no allowlist) + bookmark + subscribe (email validate)"
```

---

## PHASE 4 — open-redirect guard (Go)

### Task 4: `shared/redirect.SafePath`

**Files:**
- Create: `services/core/internal/shared/redirect/redirect.go`
- Test: `services/core/internal/shared/redirect/redirect_test.go`

**Interfaces:**
- Produces: `func SafePath(raw string) (string, bool)` — trả path nội bộ an toàn + true, hoặc "" + false.

- [ ] **Step 1: Viết test**

```go
package redirect

import "testing"

func TestSafePath(t *testing.T) {
	cases := []struct {
		in   string
		want string
		ok   bool
	}{
		{"/blog/abc", "/blog/abc", true},
		{"/", "/", true},
		{"/tags/it?x=1", "/tags/it?x=1", true},
		{"", "", false},
		{"//evil.com", "", false},
		{"/\\evil.com", "", false},
		{"http://evil.com", "", false},
		{"https://evil.com", "", false},
		{"javascript:alert(1)", "", false},
		{"evil.com", "", false}, // không bắt đầu bằng /
	}
	for _, c := range cases {
		got, ok := SafePath(c.in)
		if got != c.want || ok != c.ok {
			t.Errorf("SafePath(%q) = (%q,%v), want (%q,%v)", c.in, got, ok, c.want, c.ok)
		}
	}
}
```

- [ ] **Step 2: Chạy — fail.** Run: `go test ./internal/shared/redirect/ -v` → FAIL.

- [ ] **Step 3: Viết `redirect.go`**

```go
// Package redirect cung cấp guard chống open-redirect cho tham số returnTo.
package redirect

import "strings"

// SafePath chỉ chấp nhận path nội bộ: bắt đầu bằng đúng một "/", không phải "//"
// hoặc "/\" (protocol-relative), không chứa scheme. Trả ("", false) nếu không an toàn.
func SafePath(raw string) (string, bool) {
	if raw == "" || raw[0] != '/' {
		return "", false
	}
	if strings.HasPrefix(raw, "//") || strings.HasPrefix(raw, "/\\") {
		return "", false
	}
	return raw, true
}
```

- [ ] **Step 4: Chạy — pass.** Run: `go test ./internal/shared/redirect/ -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/shared/redirect/
git commit -m "feat(shared): redirect.SafePath — open-redirect guard cho returnTo"
```

---

## PHASE 5 — reader auth handler + middleware

### Task 5: AuthHandler `/auth/reader/*` + `RequireReader`

**Files:**
- Create: `services/core/internal/modules/readers/auth_handler.go`
- Test: `services/core/internal/modules/readers/auth_handler_test.go`

**Interfaces:**
- Consumes: `Service` (Task 3), `*scs.SessionManager`, `redirect.SafePath` (Task 4), `auth.ErrStateMismatch/ErrEmailNotVerified`.
- Produces:
```go
const CtxReaderID = "reader_id_ctx"
func NewAuthHandler(svc *Service, sm *scs.SessionManager, webBaseURL string) *AuthHandler
func (h *AuthHandler) RegisterRoutes(rg gin.IRouter, loginMW ...gin.HandlerFunc)
func RequireReader(sm *scs.SessionManager) gin.HandlerFunc
func readerIDFrom(ctx context.Context, sm *scs.SessionManager) (uuid.UUID, bool)
```

Session keys (const trong package): `sessionKeyReaderID="reader_id"`, `sessionKeyReaderState="reader_oauth_state"`, `sessionKeyReaderVerifier="reader_oauth_verifier"`, `sessionKeyReaderReturnTo="reader_return_to"`.

- [ ] **Step 1: Viết test handler (`/auth/reader/me` + guard)**

Dùng `httptest` + scs. Test: `/auth/reader/me` không session → 401; middleware `RequireReader` chặn khi thiếu `reader_id`. Login redirect + callback dùng fake provider (đi qua service). Tham khảo `auth/handler_test.go` để lấy pattern khởi tạo scs test + inject session value.

```go
package readers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func TestReaderMe_Unauthenticated401(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sm := newTestSM(t) // helper scs test (memstore) — xem auth handler test
	h := NewAuthHandler(NewService(newFakeRepo(), fakeProvider{}), sm, "http://localhost:3000")
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Next() })
	h.RegisterRoutes(r)
	srv := sm.LoadAndSave(r)

	req := httptest.NewRequest(http.MethodGet, "/auth/reader/me", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireReader_BlocksAnon(t *testing.T) {
	gin.SetMode(gin.TestMode)
	sm := newTestSM(t)
	r := gin.New()
	g := r.Group("", RequireReader(sm))
	g.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	srv := sm.LoadAndSave(r)

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}
```

> `newTestSM`: tạo `scs.New()` với memstore in-test (không cần Postgres). Nếu `auth` test đã có helper tương tự, sao chép vào `readers` test (giữ độc lập).

- [ ] **Step 2: Chạy — fail.** Run: `go test ./internal/modules/readers/ -run TestReaderMe -v` → FAIL.

- [ ] **Step 3: Viết `auth_handler.go`**

```go
package readers

import (
	"context"
	"errors"
	"net/http"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
	"github.com/vule96/ultimate-website/services/core/internal/shared/redirect"
)

const (
	sessionKeyReaderID       = "reader_id"
	sessionKeyReaderState    = "reader_oauth_state"
	sessionKeyReaderVerifier = "reader_oauth_verifier"
	sessionKeyReaderReturnTo = "reader_return_to"
	// CtxReaderID là key đặt reader id vào gin.Context sau RequireReader.
	CtxReaderID = "reader_id_ctx"
)

type AuthHandler struct {
	svc        *Service
	sm         *scs.SessionManager
	webBaseURL string
}

func NewAuthHandler(svc *Service, sm *scs.SessionManager, webBaseURL string) *AuthHandler {
	return &AuthHandler{svc: svc, sm: sm, webBaseURL: webBaseURL}
}

// RegisterRoutes gắn /auth/reader/*. loginMW (rate limit) chỉ bọc login.
func (h *AuthHandler) RegisterRoutes(rg gin.IRouter, loginMW ...gin.HandlerFunc) {
	login := rg.Group("", loginMW...)
	login.GET("/auth/reader/google/login", h.login)
	rg.GET("/auth/reader/google/callback", h.callback)
	rg.POST("/auth/reader/logout", h.logout)
	rg.GET("/auth/reader/me", h.me)
}

func (h *AuthHandler) login(c *gin.Context) {
	ctx := c.Request.Context()
	state, verifier, url, err := h.svc.StartLogin()
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not start login")
		return
	}
	h.sm.Put(ctx, sessionKeyReaderState, state)
	h.sm.Put(ctx, sessionKeyReaderVerifier, verifier)
	if p, ok := redirect.SafePath(c.Query("returnTo")); ok {
		h.sm.Put(ctx, sessionKeyReaderReturnTo, p)
	}
	c.Redirect(http.StatusFound, url)
}

func (h *AuthHandler) callback(c *gin.Context) {
	ctx := c.Request.Context()
	wantState := h.sm.GetString(ctx, sessionKeyReaderState)
	verifier := h.sm.GetString(ctx, sessionKeyReaderVerifier)
	returnTo := h.sm.GetString(ctx, sessionKeyReaderReturnTo)
	h.sm.Remove(ctx, sessionKeyReaderState)
	h.sm.Remove(ctx, sessionKeyReaderVerifier)
	h.sm.Remove(ctx, sessionKeyReaderReturnTo)

	rd, err := h.svc.CompleteLogin(ctx, c.Query("code"), c.Query("state"), wantState, verifier)
	if err != nil {
		respondAuthError(c, err)
		return
	}
	if err := h.sm.RenewToken(ctx); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not create session")
		return
	}
	h.sm.Put(ctx, sessionKeyReaderID, rd.ID.String())

	dest := h.webBaseURL
	if p, ok := redirect.SafePath(returnTo); ok {
		dest = h.webBaseURL + p
	}
	c.Redirect(http.StatusFound, dest)
}

// logout chỉ gỡ phần reader — KHÔNG destroy toàn session (giữ admin nếu cùng browser).
func (h *AuthHandler) logout(c *gin.Context) {
	ctx := c.Request.Context()
	h.sm.Remove(ctx, sessionKeyReaderID)
	if err := h.sm.RenewToken(ctx); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not log out")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *AuthHandler) me(c *gin.Context) {
	ctx := c.Request.Context()
	id, ok := readerIDFrom(ctx, h.sm)
	if !ok {
		httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "not authenticated")
		return
	}
	rd, err := h.svc.GetReader(ctx, id)
	if err != nil {
		// Reader bị xoá khỏi DB → gỡ session, trả 401.
		h.sm.Remove(ctx, sessionKeyReaderID)
		httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "not authenticated")
		return
	}
	c.JSON(http.StatusOK, gin.H{"id": rd.ID, "email": rd.Email, "name": rd.Name})
}

func respondAuthError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, auth.ErrStateMismatch):
		httperr.Write(c, http.StatusUnauthorized, "STATE_MISMATCH", "invalid oauth state")
	case errors.Is(err, auth.ErrEmailNotVerified):
		httperr.Write(c, http.StatusForbidden, "EMAIL_NOT_VERIFIED", "email not verified")
	default:
		httperr.Write(c, http.StatusBadGateway, "OAUTH_FAILED", "oauth exchange failed")
	}
}

// readerIDFrom đọc reader id từ session (parse uuid).
func readerIDFrom(ctx context.Context, sm *scs.SessionManager) (uuid.UUID, bool) {
	s := sm.GetString(ctx, sessionKeyReaderID)
	if s == "" {
		return uuid.Nil, false
	}
	id, err := uuid.Parse(s)
	if err != nil {
		return uuid.Nil, false
	}
	return id, true
}

// RequireReader chặn request thiếu reader session; đặt reader id vào gin.Context.
func RequireReader(sm *scs.SessionManager) gin.HandlerFunc {
	return func(c *gin.Context) {
		id, ok := readerIDFrom(c.Request.Context(), sm)
		if !ok {
			httperr.Write(c, http.StatusUnauthorized, "UNAUTHORIZED", "authentication required")
			c.Abort()
			return
		}
		c.Set(CtxReaderID, id)
		c.Next()
	}
}
```

- [ ] **Step 4: Chạy — pass.** Run: `go test ./internal/modules/readers/ -v` → PASS.

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/modules/readers/auth_handler.go services/core/internal/modules/readers/auth_handler_test.go
git commit -m "feat(readers): auth handler /auth/reader/* (BFF, reader_id session) + RequireReader guard"
```

---

## PHASE 6 — bookmark + subscriber handlers

### Task 6: BookmarkHandler `/readers/me/bookmarks*`

**Files:**
- Create: `services/core/internal/modules/readers/bookmark_handler.go`
- Test: `services/core/internal/modules/readers/bookmark_handler_test.go`

**Interfaces:**
- Consumes: `Service`, `CtxReaderID`, `RequireReader`.
- Produces: `func NewBookmarkHandler(svc *Service) *BookmarkHandler`; `func (h *BookmarkHandler) RegisterRoutes(rg gin.IRouter, mw ...gin.HandlerFunc)`.

- [ ] **Step 1: Viết test** — GET/PUT/DELETE với reader id set qua middleware giả; PUT postId không hợp lệ → 400.

```go
package readers

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestBookmark_PutInvalidUUID400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rid := uuid.New()
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set(CtxReaderID, rid); c.Next() })
	NewBookmarkHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)

	req := httptest.NewRequest(http.MethodPut, "/readers/me/bookmarks/not-a-uuid", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestBookmark_PutDeleteOK(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rid := uuid.New()
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set(CtxReaderID, rid); c.Next() })
	NewBookmarkHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)

	pid := uuid.New().String()
	for _, m := range []string{http.MethodPut, http.MethodDelete} {
		req := httptest.NewRequest(m, "/readers/me/bookmarks/"+pid, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		require.Equal(t, http.StatusNoContent, w.Code)
	}
}
```

- [ ] **Step 2: Chạy — fail.**

- [ ] **Step 3: Viết `bookmark_handler.go`**

```go
package readers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

type BookmarkHandler struct{ svc *Service }

func NewBookmarkHandler(svc *Service) *BookmarkHandler { return &BookmarkHandler{svc: svc} }

// RegisterRoutes gắn /readers/me/bookmarks*. mw (RequireReader [+ RequireJSON cho write]) bọc tất cả.
func (h *BookmarkHandler) RegisterRoutes(rg gin.IRouter, mw ...gin.HandlerFunc) {
	g := rg.Group("/readers/me/bookmarks", mw...)
	g.GET("", h.list)
	g.PUT("/:postId", h.add)
	g.DELETE("/:postId", h.remove)
}

func (h *BookmarkHandler) readerID(c *gin.Context) uuid.UUID {
	return c.MustGet(CtxReaderID).(uuid.UUID)
}

func (h *BookmarkHandler) list(c *gin.Context) {
	ids, err := h.svc.Bookmarks(c.Request.Context(), h.readerID(c))
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not list bookmarks")
		return
	}
	if ids == nil {
		ids = []uuid.UUID{}
	}
	c.JSON(http.StatusOK, ids)
}

func (h *BookmarkHandler) add(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("postId"))
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_ID", "invalid post id")
		return
	}
	if err := h.svc.AddBookmark(c.Request.Context(), h.readerID(c), pid); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not add bookmark")
		return
	}
	c.Status(http.StatusNoContent)
}

func (h *BookmarkHandler) remove(c *gin.Context) {
	pid, err := uuid.Parse(c.Param("postId"))
	if err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_ID", "invalid post id")
		return
	}
	if err := h.svc.RemoveBookmark(c.Request.Context(), h.readerID(c), pid); err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not remove bookmark")
		return
	}
	c.Status(http.StatusNoContent)
}
```

> Lưu ý FK: nếu `AddBookmark` lỗi vì post_id không tồn tại (FK violation), trả 500 là chấp nhận (client chỉ gửi id có thật từ danh sách bài). Không cần phân biệt ở slice này.

- [ ] **Step 4: Chạy — pass.**

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/modules/readers/bookmark_handler.go services/core/internal/modules/readers/bookmark_handler_test.go
git commit -m "feat(readers): bookmark handler /readers/me/bookmarks (GET/PUT/DELETE, idempotent)"
```

### Task 7: SubscriberHandler `POST /subscribers`

**Files:**
- Create: `services/core/internal/modules/readers/subscriber_handler.go`
- Test: `services/core/internal/modules/readers/subscriber_handler_test.go`

**Interfaces:**
- Produces: `func NewSubscriberHandler(svc *Service) *SubscriberHandler`; `func (h *SubscriberHandler) RegisterRoutes(rg gin.IRouter, mw ...gin.HandlerFunc)`.

- [ ] **Step 1: Viết test** — email hợp lệ → 201; email rác → 400; gọi 2 lần cùng email → vẫn 201 (không leak tồn tại).

```go
package readers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"
)

func postSub(t *testing.T, r http.Handler, body string) int {
	req := httptest.NewRequest(http.MethodPost, "/subscribers", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestSubscribe_HandlerValidIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewSubscriberHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)
	require.Equal(t, http.StatusCreated, postSub(t, r, `{"email":"a@b.com"}`))
	require.Equal(t, http.StatusCreated, postSub(t, r, `{"email":"a@b.com"}`)) // không leak
}

func TestSubscribe_HandlerInvalid400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewSubscriberHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)
	require.Equal(t, http.StatusBadRequest, postSub(t, r, `{"email":"nope"}`))
}
```

- [ ] **Step 2: Chạy — fail.**

- [ ] **Step 3: Viết `subscriber_handler.go`**

```go
package readers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

type SubscriberHandler struct{ svc *Service }

func NewSubscriberHandler(svc *Service) *SubscriberHandler { return &SubscriberHandler{svc: svc} }

// RegisterRoutes gắn POST /subscribers. mw (rate limit [+ RequireJSON]) bọc route.
func (h *SubscriberHandler) RegisterRoutes(rg gin.IRouter, mw ...gin.HandlerFunc) {
	g := rg.Group("", mw...)
	g.POST("/subscribers", h.subscribe)
}

type subscribeRequest struct {
	Email string `json:"email"`
}

func (h *SubscriberHandler) subscribe(c *gin.Context) {
	var req subscribeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		httperr.Write(c, http.StatusBadRequest, "INVALID_BODY", "invalid request body")
		return
	}
	err := h.svc.Subscribe(c.Request.Context(), req.Email)
	if errors.Is(err, ErrInvalidEmail) {
		httperr.Write(c, http.StatusBadRequest, "INVALID_EMAIL", "invalid email")
		return
	}
	if err != nil {
		httperr.Write(c, http.StatusInternalServerError, "INTERNAL", "could not subscribe")
		return
	}
	// Luôn 201 dù đã tồn tại — không lộ email đã đăng ký (privacy).
	c.Status(http.StatusCreated)
}
```

- [ ] **Step 4: Chạy — pass.**

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/modules/readers/subscriber_handler.go services/core/internal/modules/readers/subscriber_handler_test.go
git commit -m "feat(readers): subscriber handler POST /subscribers (idempotent 201, no leak)"
```

---

## PHASE 7 — rate limit (Redis)

### Task 8: `shared/ratelimit.PerIP`

**Files:**
- Create: `services/core/internal/shared/ratelimit/ratelimit.go`
- Test: `services/core/internal/shared/ratelimit/ratelimit_test.go`

**Interfaces:**
- Consumes: `redis.Cmdable` (go-redis v9), `github.com/alicebob/miniredis/v2` (test dep — thêm vào go.mod).
- Produces: `func PerIP(rdb redis.Cmdable, log *slog.Logger, scope string, limit int, window time.Duration) gin.HandlerFunc`. `rdb == nil` → middleware no-op (passthrough).

- [ ] **Step 1: Thêm dep miniredis (nếu chưa)**

Run (trong `services/core`):
```bash
go get github.com/alicebob/miniredis/v2@latest
```

- [ ] **Step 2: Viết test**

```go
package ratelimit

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newRDB(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()}), mr
}

func serve(rdb redis.Cmdable, limit int) http.Handler {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(PerIP(rdb, slog.Default(), "test", limit, time.Minute))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	return r
}

func hit(h http.Handler) int {
	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.RemoteAddr = "1.2.3.4:5555"
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	return w.Code
}

func TestPerIP_BlocksOverLimit(t *testing.T) {
	rdb, _ := newRDB(t)
	h := serve(rdb, 2)
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusTooManyRequests, hit(h)) // vượt ngưỡng 2
}

func TestPerIP_WindowRollover(t *testing.T) {
	rdb, mr := newRDB(t)
	h := serve(rdb, 1)
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusTooManyRequests, hit(h))
	mr.FastForward(time.Minute + time.Second) // qua window mới
	require.Equal(t, http.StatusOK, hit(h))
}

func TestPerIP_NilRedisFailOpen(t *testing.T) {
	h := serve(nil, 1)
	require.Equal(t, http.StatusOK, hit(h))
	require.Equal(t, http.StatusOK, hit(h)) // no-op, không chặn
}
```

- [ ] **Step 3: Chạy — fail.** Run: `go test ./internal/shared/ratelimit/ -v` → FAIL.

- [ ] **Step 4: Viết `ratelimit.go`**

```go
// Package ratelimit cung cấp middleware giới hạn tần suất theo IP (fixed-window, Redis).
package ratelimit

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/redis/go-redis/v9"

	"github.com/vule96/ultimate-website/services/core/internal/shared/httperr"
)

const opTimeout = 100 * time.Millisecond

// PerIP giới hạn `limit` request mỗi `window` cho mỗi IP trong `scope`.
// rdb nil → no-op. Redis lỗi → fail-open (cho qua, log warn).
func PerIP(rdb redis.Cmdable, log *slog.Logger, scope string, limit int, window time.Duration) gin.HandlerFunc {
	if rdb == nil {
		return func(c *gin.Context) { c.Next() }
	}
	return func(c *gin.Context) {
		ctx, cancel := context.WithTimeout(c.Request.Context(), opTimeout)
		defer cancel()

		bucket := time.Now().Unix() / int64(window.Seconds())
		key := "rl:" + scope + ":" + c.ClientIP() + ":" + strconv.FormatInt(bucket, 10)

		n, err := rdb.Incr(ctx, key).Result()
		if err != nil {
			log.Warn("ratelimit: redis incr failed — fail-open", "scope", scope, "err", err)
			c.Next()
			return
		}
		if n == 1 {
			rdb.Expire(ctx, key, window)
		}
		if n > int64(limit) {
			c.Header("Retry-After", strconv.Itoa(int(window.Seconds())))
			httperr.Write(c, http.StatusTooManyRequests, "RATE_LIMITED", "too many requests")
			c.Abort()
			return
		}
		c.Next()
	}
}
```

> Thêm import `"context"` ở đầu file (đã dùng `context.WithTimeout`).

- [ ] **Step 5: Chạy — pass.** Run: `go test ./internal/shared/ratelimit/ -v` → PASS.

- [ ] **Step 6: Commit**

```bash
git add services/core/internal/shared/ratelimit/ services/core/go.mod services/core/go.sum
git commit -m "feat(shared): ratelimit.PerIP — fixed-window Redis per-IP, fail-open (miniredis test)"
```

---

## PHASE 8 — view dedupe (posts)

### Task 9: `posts.ViewDeduper` + tích hợp handler

**Files:**
- Create: `services/core/internal/modules/posts/dedupe.go`
- Test: `services/core/internal/modules/posts/dedupe_test.go`
- Modify: `services/core/internal/modules/posts/handler.go` (thêm `WithDeduper` + gọi trong `view`)

**Interfaces:**
- Consumes: `redis.Cmdable`.
- Produces:
```go
type ViewDeduper struct{ ... }
func NewViewDeduper(rdb redis.Cmdable, salt string) *ViewDeduper
// FirstToday trả true nếu (identity, slug) chưa xuất hiện hôm nay (SADD==1).
// rdb nil hoặc lỗi → true (fail-open: đếm bình thường).
func (d *ViewDeduper) FirstToday(ctx context.Context, slug, identity string) bool
func (h *Handler) WithDeduper(d *ViewDeduper) *Handler
```

- [ ] **Step 1: Viết test dedupe**

```go
package posts

import (
	"context"
	"testing"
	"time"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
	"github.com/stretchr/testify/require"
)

func newRDB(t *testing.T) (*redis.Client, *miniredis.Miniredis) {
	mr, err := miniredis.Run()
	require.NoError(t, err)
	t.Cleanup(mr.Close)
	return redis.NewClient(&redis.Options{Addr: mr.Addr()}), mr
}

func TestDeduper_FirstThenDup(t *testing.T) {
	rdb, _ := newRDB(t)
	d := NewViewDeduper(rdb, "salt")
	ctx := context.Background()
	require.True(t, d.FirstToday(ctx, "slug-a", "r:1"))  // lần đầu
	require.False(t, d.FirstToday(ctx, "slug-a", "r:1"))  // trùng
	require.True(t, d.FirstToday(ctx, "slug-a", "r:2"))   // reader khác
	require.True(t, d.FirstToday(ctx, "slug-b", "r:1"))   // bài khác
}

func TestDeduper_TTLSet(t *testing.T) {
	rdb, mr := newRDB(t)
	d := NewViewDeduper(rdb, "salt")
	d.FirstToday(context.Background(), "slug-a", "r:1")
	keys := mr.Keys()
	require.NotEmpty(t, keys)
	ttl := mr.TTL(keys[0])
	require.Greater(t, ttl, time.Hour) // ~48h
}

func TestDeduper_NilFailOpen(t *testing.T) {
	d := NewViewDeduper(nil, "salt")
	require.True(t, d.FirstToday(context.Background(), "s", "r:1"))
	require.True(t, d.FirstToday(context.Background(), "s", "r:1")) // vẫn true — đếm hết
}
```

- [ ] **Step 2: Chạy — fail.**

- [ ] **Step 3: Viết `dedupe.go`**

```go
package posts

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

const dedupeTTL = 48 * time.Hour
const dedupeOpTimeout = 100 * time.Millisecond

// ViewDeduper chặn đếm trùng: 1 identity (reader id hoặc IP hash) chỉ tính 1 view
// mỗi bài mỗi ngày. Dùng Redis SET + TTL. nil/redis lỗi → fail-open (đếm bình thường).
type ViewDeduper struct {
	rdb  redis.Cmdable
	salt string
}

func NewViewDeduper(rdb redis.Cmdable, salt string) *ViewDeduper {
	return &ViewDeduper{rdb: rdb, salt: salt}
}

// FirstToday: true nếu (identity, slug) mới trong ngày (nên đếm). SADD trả 1 = mới.
func (d *ViewDeduper) FirstToday(ctx context.Context, slug, identity string) bool {
	if d == nil || d.rdb == nil {
		return true
	}
	ctx, cancel := context.WithTimeout(ctx, dedupeOpTimeout)
	defer cancel()
	key := "views:seen:" + slug + ":" + time.Now().UTC().Format("20060102")
	added, err := d.rdb.SAdd(ctx, key, identity).Result()
	if err != nil {
		return true // fail-open
	}
	if added == 1 {
		d.rdb.Expire(ctx, key, dedupeTTL)
	}
	return added == 1
}
```

> `salt` dùng khi hash IP ở handler (Task tiếp): `identity = "a:" + sha256hex(ip+salt)`. Deduper chỉ nhận identity đã dựng sẵn — giữ deduper thuần Redis, dễ test.

- [ ] **Step 4: Chạy — pass.** Run: `go test ./internal/modules/posts/ -run TestDeduper -v` → PASS.

- [ ] **Step 5: Tích hợp handler — đọc `view` hiện tại**

Đọc `posts/handler.go` hàm `view` (quanh dòng nơi gọi `h.views.Add(...)`). Dựng identity + gọi dedupe **trước** `h.views.Add`. Thêm field + `WithDeduper`:

```go
// Trong struct Handler thêm:
//   deduper *ViewDeduper
//   viewSalt string  // (hoặc để salt trong deduper — đã ở deduper)

// WithDeduper gắn dedupe view (chainable, optional).
func (h *Handler) WithDeduper(d *ViewDeduper) *Handler {
	h.deduper = d
	return h
}
```

Trong `view` (sau khi có `slug` và trước khi `Add`):
```go
// Dedupe: 1 người/1 view/bài/ngày. Reader ưu tiên; ẩn danh dùng hash IP.
identity := "a:" + hashIP(c.ClientIP(), h.viewSalt)
if rid := readerIdentity(c); rid != "" {
	identity = "r:" + rid
}
if h.deduper != nil && !h.deduper.FirstToday(c.Request.Context(), slug, identity) {
	c.Status(http.StatusAccepted) // đã xem hôm nay — không đếm, không lộ
	return
}
```

Thêm helper trong handler.go (hoặc dedupe.go):
```go
func hashIP(ip, salt string) string {
	sum := sha256.Sum256([]byte(ip + salt))
	return hex.EncodeToString(sum[:])
}
```
`readerIdentity(c)`: đọc reader id từ session nếu có. Vì posts không import readers (tránh vòng), dùng cách trung lập: reader middleware `RequireReader` KHÔNG bọc route view (public). Thay vào đó đọc trực tiếp giá trị session key `"reader_id"` qua một checker inject giống `authed`. **Đơn giản nhất**: thêm field `readerID func(ctx) string` vào Handler (giống `authed`), wiring truyền closure đọc `sm.GetString(ctx, "reader_id")`. Cập nhật `NewHandler` hoặc thêm `WithReaderIdentity(fn)`:

```go
// WithReaderIdentity gắn hàm lấy reader id từ session (rỗng nếu chưa login).
func (h *Handler) WithReaderIdentity(fn func(ctx context.Context) string) *Handler {
	h.readerID = fn
	return h
}
```
Và `readerIdentity(c)` = `if h.readerID != nil { return h.readerID(c.Request.Context()) }; return ""`.

Set `h.viewSalt` qua `WithDeduper` param hoặc thêm vào `WithDeduper(d, salt)`. Gọn nhất: `WithDeduper(d *ViewDeduper, salt string)`.

- [ ] **Step 6: Cập nhật test handler view (nếu có)** — đảm bảo view vẫn 202 khi deduper nil. Chạy: `go test ./internal/modules/posts/ -v` → PASS.

- [ ] **Step 7: Commit**

```bash
git add services/core/internal/modules/posts/dedupe.go services/core/internal/modules/posts/dedupe_test.go services/core/internal/modules/posts/handler.go
git commit -m "feat(posts): view dedupe Redis SET+TTL (1 view/người/bài/ngày, fail-open)"
```

---

## PHASE 9 — config + wiring

### Task 10: Config env mới + cache accessor

**Files:**
- Modify: `services/core/internal/platform/cache/redis.go` (accessor)
- Modify: `services/core/internal/platform/config/config.go`
- Modify: `services/core/.env.example`

**Interfaces:**
- Produces: `func (r *Redis) Client() *redis.Client`; `Config` thêm `ReaderRedirectURL, WebBaseURL, ViewDedupSalt string`.

- [ ] **Step 1: Thêm accessor cache**

Trong `cache/redis.go`:
```go
// Client trả *redis.Client thô để tính năng khác (rate limit, view dedupe) dùng chung
// một kết nối Redis. Chỉ gọi khi Redis bật.
func (r *Redis) Client() *redis.Client { return r.client }
```

- [ ] **Step 2: Thêm env vào Config**

Trong struct `Config` (nhóm Auth/OAuth):
```go
	ReaderRedirectURL string // callback OAuth cho reader (khác admin)
	WebBaseURL        string // base URL web công khai (redirect reader sau login)
	ViewDedupSalt     string // salt hash IP cho view dedupe
```
Trong `Load()` (khối gán `cfg := Config{...}`):
```go
		ReaderRedirectURL: getEnv("READER_REDIRECT_URL", "http://localhost:8080/auth/reader/google/callback"),
		WebBaseURL:        getEnv("WEB_BASE_URL", "http://localhost:3000"),
		ViewDedupSalt:     os.Getenv("VIEW_DEDUP_SALT"),
```
Thêm fail-fast (sau check DatabaseURL) — chỉ bắt buộc salt khi Redis bật:
```go
	if cfg.RedisURL != "" && cfg.ViewDedupSalt == "" {
		return Config{}, fmt.Errorf("config: VIEW_DEDUP_SALT is required when REDIS_URL is set")
	}
```
Cập nhật `LogValue` (nếu liệt kê field cụ thể) — thêm 3 field, `ViewDedupSalt` **redact** (chỉ in có/không), 2 URL in bình thường.

- [ ] **Step 3: Cập nhật `.env.example`**

Thêm:
```
# Reader auth (Slice 13) — OAuth người đọc, callback riêng khỏi admin
READER_REDIRECT_URL=http://localhost:8080/auth/reader/google/callback
# Base URL web công khai để redirect reader về sau khi login
WEB_BASE_URL=http://localhost:3000
# Salt hash IP cho view dedupe (bắt buộc khi bật REDIS_URL)
VIEW_DEDUP_SALT=doi-gia-tri-ngau-nhien-dai
# CORS: thêm origin web công khai (ngoài admin) — CSV
# CORS_ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000
```

- [ ] **Step 4: Build check.** Run: `go build ./...` (trong services/core) → không lỗi.

- [ ] **Step 5: Commit**

```bash
git add services/core/internal/platform/cache/redis.go services/core/internal/platform/config/config.go services/core/.env.example
git commit -m "feat(config): env reader auth/dedupe + cache.Redis.Client() accessor"
```

### Task 11: Wiring `cmd/api/main.go`

**Files:**
- Modify: `services/core/cmd/api/main.go`

**Interfaces:**
- Consumes: tất cả handler/middleware trên; `cch.Client()` khi `*cache.Redis`.

- [ ] **Step 1: Lấy raw redis client (nếu Redis bật)**

Ngay sau khối tạo `cch` (cache), thêm:
```go
	// Raw redis client dùng chung cho rate limit + view dedupe (nil nếu tắt).
	var rdb redis.Cmdable
	if rc, ok := cch.(*cache.Redis); ok {
		rdb = rc.Client()
	}
```
Import `"github.com/redis/go-redis/v9"`.

- [ ] **Step 2: Wiring module readers**

Sau wiring auth (dùng lại `sm`), thêm:
```go
	// Wiring module readers (auth người đọc — OAuth riêng, KHÔNG allowlist).
	readerProvider := auth.NewGoogleProvider(cfg.GoogleClientID, cfg.GoogleClientSecret, cfg.ReaderRedirectURL)
	readersRepo := readers.NewGormRepository(db)
	readersSvc := readers.NewService(readersRepo, readerProvider)
	readerAuthHandler := readers.NewAuthHandler(readersSvc, sm, cfg.WebBaseURL)
	bookmarkHandler := readers.NewBookmarkHandler(readersSvc)
	subscriberHandler := readers.NewSubscriberHandler(readersSvc)
```
Import `.../internal/modules/readers` + `.../internal/shared/ratelimit` + `.../internal/shared/redirect` (redirect chỉ dùng trong package readers — không cần ở main).

- [ ] **Step 3: Gắn deduper + reader identity vào postsHandler**

Sửa dòng tạo `postsHandler`:
```go
	deduper := posts.NewViewDeduper(rdb, cfg.ViewDedupSalt)
	postsHandler := posts.NewHandler(postsSvc, auth.IsAuthenticated(sm)).
		WithViewCounter(viewCounter).
		WithDeduper(deduper, cfg.ViewDedupSalt).
		WithReaderIdentity(func(ctx context.Context) string { return sm.GetString(ctx, "reader_id") })
```

- [ ] **Step 4: Đăng ký routes + rate limit**

Reader auth routes ở top-level (như `authHandler.RegisterRoutes(r)`), login bọc rate limit:
```go
	loginRL := ratelimit.PerIP(rdb, log, "auth", 10, time.Minute)
	readerAuthHandler.RegisterRoutes(r, loginRL)
```
Trong nhóm `api := r.Group("/api/v1")`:
```go
	// Bookmark: cần reader session + JSON cho write.
	bookmarkMW := []gin.HandlerFunc{readers.RequireReader(sm)}
	bookmarkWriteMW := []gin.HandlerFunc{readers.RequireReader(sm), jsonmw.RequireJSON()}
	// GET dùng bookmarkMW; PUT/DELETE cần thêm RequireJSON → đăng ký gộp:
	bookmarkHandler.RegisterRoutes(api, readers.RequireReader(sm))
	// Newsletter: public + rate limit + JSON.
	subscribeRL := ratelimit.PerIP(rdb, log, "subscribe", 5, time.Minute)
	subscriberHandler.RegisterRoutes(api, subscribeRL, jsonmw.RequireJSON())
```

> Ghi chú: `RequireJSON` cho PUT/DELETE bookmark — vì DELETE không có body, `RequireJSON` có thể chặn (nó check Content-Type). Kiểm tra `jsonmw.RequireJSON` xử lý request không body thế nào; nếu nó bắt buộc `application/json` cho mọi method, thì với DELETE (không body) FE phải gửi header `Content-Type: application/json` — chấp nhận được (FE set header). Nếu muốn tránh, chỉ bọc RequireJSON cho PUT. Đơn giản: bọc `RequireReader` cho cả nhóm, và để FE luôn gửi `Content-Type: application/json` khi gọi bookmark (CSRF guard vẫn hiệu lực). Giữ như trên.

Rate limit view: thêm middleware vào route `POST /posts/:slug/view`. Route này đăng ký trong `postsHandler.RegisterRoutes`. **Đơn giản nhất**: rate limit view áp ở tầng group không khả thi (route trong RegisterRoutes). Thay vào đó cho `posts.Handler` nhận optional view middleware, HOẶC áp `ratelimit` toàn `/api/v1` cho POST view bằng cách chuyển route view ra ngoài. **Quyết định**: thêm tham số `viewMW ...gin.HandlerFunc` vào `posts.RegisterRoutes` chỉ bọc route view:
```go
// Trong posts handler.go RegisterRoutes signature đổi:
func (h *Handler) RegisterRoutes(rg gin.IRouter, protectedMW ...gin.HandlerFunc) {
    ...
    // view route bọc h.viewMW (set qua WithViewRateLimit)
    viewGroup := rg.Group("", h.viewMW...)
    viewGroup.POST("/posts/:slug/view", h.view)
    ...
}
// thêm WithViewRateLimit(mw ...gin.HandlerFunc) *Handler set h.viewMW
```
Wiring: `postsHandler.WithViewRateLimit(ratelimit.PerIP(rdb, log, "view", 60, time.Minute))`.

- [ ] **Step 5: CORS web origin** — đảm bảo `CORS_ALLOWED_ORIGINS` env (dev) gồm cả `http://localhost:3000`. Không sửa code (corsmw đã đọc CSV); chỉ cập nhật `.env` dev + note README. Verify wiring dùng `cfg.CORSAllowedOrigins`.

- [ ] **Step 6: Build + chạy thử**

Run (services/core): `go build ./...` → OK. Rồi `go vet ./...`.
Khởi động: `docker compose up -d` (Redis+PG) → set `.env` (REDIS_URL, VIEW_DEDUP_SALT, CORS gồm :3000) → `go run ./cmd/api`. Kiểm `GET /auth/reader/me` → 401 (chưa login). `curl -X POST localhost:8080/api/v1/subscribers -H 'content-type: application/json' -d '{"email":"a@b.com"}'` → 201.

- [ ] **Step 7: Chạy toàn bộ test core**

Run: `go test ./...` → PASS.

- [ ] **Step 8: Commit**

```bash
git add services/core/cmd/api/main.go services/core/internal/modules/posts/handler.go
git commit -m "feat(core): wiring readers module + rate limit + view dedupe + reader identity"
```

---

## PHASE 10 — Frontend

### Task 12: Types + API base + service impls (bookmark/newsletter async)

**Files:**
- Modify: `apps/web/src/features/magazine/types.ts`
- Modify: `apps/web/src/features/magazine/services/bookmark-service.ts`
- Modify: `apps/web/src/features/magazine/services/newsletter-service.ts`
- Create/Modify: helper API base (xem `apps/web/src` có sẵn `NEXT_PUBLIC_API_URL` dùng ở ViewTracker/blog fetch — tái dùng).
- Test: `apps/web/src/features/magazine/services/*.test.ts`

**Interfaces:**
- Produces: `Reader` type; `apiBookmarkService`, `apiNewsletterService`. `BookmarkService` interface chuyển async.

- [ ] **Step 1: Đọc cách web gọi API hiện tại** — tìm `NEXT_PUBLIC_API_URL` + fetch pattern (ViewTracker, blog data loader). Ghi nhận base URL + có `credentials` chưa.

- [ ] **Step 2: Đổi type**

Trong `types.ts`: thay `MockUser` bằng
```ts
export interface Reader {
  id: string;
  email: string;
  name: string;
}
```
(Giữ export cũ tên `MockUser = Reader` tạm nếu nhiều nơi import, hoặc đổi hết — grep `MockUser`.)

- [ ] **Step 3: Viết test service (mock fetch)**

`bookmark-service.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiBookmarkService } from "./bookmark-service";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

describe("apiBookmarkService", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("load gọi GET /readers/me/bookmarks với credentials", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, json: async () => ["p1", "p2"],
    });
    vi.stubGlobal("fetch", fetchMock);
    const set = await apiBookmarkService.load();
    expect(set.has("p1")).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/api/v1/readers/me/bookmarks`,
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("add gọi PUT", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", fetchMock);
    await apiBookmarkService.add("p1");
    expect(fetchMock).toHaveBeenCalledWith(
      `${API}/api/v1/readers/me/bookmarks/p1`,
      expect.objectContaining({ method: "PUT", credentials: "include" }),
    );
  });
});
```

`newsletter-service.test.ts`:
```ts
import { describe, it, expect, vi } from "vitest";
import { apiNewsletterService } from "./newsletter-service";

describe("apiNewsletterService", () => {
  it("subscribe gọi POST /subscribers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201 });
    vi.stubGlobal("fetch", fetchMock);
    await apiNewsletterService.subscribe("a@b.com");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/v1/subscribers");
    expect(opts.method).toBe("POST");
    expect(opts.credentials).toBe("include");
    expect(JSON.parse(opts.body).email).toBe("a@b.com");
  });

  it("subscribe ném lỗi khi 400", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 400 }));
    await expect(apiNewsletterService.subscribe("bad")).rejects.toThrow();
  });
});
```

- [ ] **Step 4: Chạy — fail.** Run: `pnpm --filter @ultimate/web test -- bookmark-service newsletter-service` → FAIL.

- [ ] **Step 5: Viết impl**

`bookmark-service.ts` — đổi interface async + thêm API impl (giữ local impl cho fallback/test store nếu cần, nhưng store sẽ dùng API):
```ts
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
const BASE = `${API}/api/v1/readers/me/bookmarks`;

export interface BookmarkService {
  load(): Promise<Set<string>>;
  add(postId: string): Promise<void>;
  remove(postId: string): Promise<void>;
}

export const apiBookmarkService: BookmarkService = {
  async load() {
    const res = await fetch(BASE, { credentials: "include" });
    if (!res.ok) return new Set();
    const ids: string[] = await res.json();
    return new Set(ids);
  },
  async add(postId) {
    const res = await fetch(`${BASE}/${postId}`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`bookmark add failed: ${res.status}`);
  },
  async remove(postId) {
    const res = await fetch(`${BASE}/${postId}`, {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`bookmark remove failed: ${res.status}`);
  },
};
```

`newsletter-service.ts`:
```ts
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

export interface NewsletterService {
  subscribe(email: string): Promise<void>;
}

export const apiNewsletterService: NewsletterService = {
  async subscribe(email) {
    const res = await fetch(`${API}/api/v1/subscribers`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error(`subscribe failed: ${res.status}`);
  },
};
```

- [ ] **Step 6: Chạy — pass.** Run test lại → PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/features/magazine/services/ apps/web/src/features/magazine/types.ts
git commit -m "feat(web): bookmark/newsletter service impl API-backed (credentials include)"
```

### Task 13: Store — hydrate + optimistic bookmark + logout API

**Files:**
- Modify: `apps/web/src/features/magazine/store/magazine-store.ts`
- Modify: `apps/web/src/features/magazine/store/magazine-store.test.ts`

**Interfaces:**
- Consumes: `apiBookmarkService`, `Reader` type.
- Produces: store actions `hydrate()`, `toggleSave` (async optimistic), `logout` (async), `authError` toast.

- [ ] **Step 1: Viết test store** (mock service)

Cập nhật `magazine-store.test.ts`: mock `apiBookmarkService`. Test:
- `hydrate` khi `/me` trả user → set user + load bookmarks.
- `toggleSave` khi có user: optimistic set ngay; nếu `add` reject → rollback + toast lỗi.
- `logout` clear user + saved.

```ts
import { vi, describe, it, expect, beforeEach } from "vitest";
import { useMagazineStore } from "./magazine-store";
import { apiBookmarkService } from "../services/bookmark-service";

vi.mock("../services/bookmark-service", () => ({
  apiBookmarkService: { load: vi.fn(), add: vi.fn(), remove: vi.fn() },
}));

const reset = () =>
  useMagazineStore.setState({ user: null, saved: {}, authOpen: false, toast: null });

describe("magazine-store bookmark thật", () => {
  beforeEach(() => { reset(); vi.clearAllMocks(); });

  it("toggleSave optimistic + rollback khi API lỗi", async () => {
    (apiBookmarkService.add as any).mockRejectedValue(new Error("x"));
    useMagazineStore.setState({ user: { id: "1", email: "a@b.co", name: "A" } });
    await useMagazineStore.getState().toggleSave("p1");
    // rollback: p1 không còn saved
    expect(useMagazineStore.getState().saved["p1"]).toBeUndefined();
    expect(useMagazineStore.getState().toast?.key).toBe("saveError");
  });

  it("toggleSave chưa login mở auth", async () => {
    await useMagazineStore.getState().toggleSave("p1");
    expect(useMagazineStore.getState().authOpen).toBe(true);
    expect(useMagazineStore.getState().toast?.key).toBe("authRequired");
  });
});
```

- [ ] **Step 2: Chạy — fail.**

- [ ] **Step 3: Sửa store**

- `user: Reader | null`. Bỏ `login(MockUser)`; thêm:
```ts
hydrate: async () => {
  try {
    const res = await fetch(`${API}/api/v1/../auth/reader/me`, { credentials: "include" });
    // dùng đúng path: `${API}/auth/reader/me`
    if (!res.ok) return;
    const user: Reader = await res.json();
    const saved = savedRecord(await apiBookmarkService.load());
    set({ user, saved });
  } catch { /* offline — im lặng */ }
},
```
> Path chuẩn: reader auth routes ở top-level (`/auth/reader/me`), KHÔNG dưới `/api/v1`. Dùng `${API}/auth/reader/me`.

- `toggleSave` optimistic:
```ts
toggleSave: async (id) => {
  const { user, saved } = get();
  if (!user) {
    set({ authOpen: true, toast: { key: "authRequired" } });
    return;
  }
  const wasSaved = !!saved[id];
  const next = { ...saved };
  if (wasSaved) delete next[id]; else next[id] = true;
  set({ saved: next, toast: { key: wasSaved ? "unsaved" : "saved" } }); // optimistic
  try {
    if (wasSaved) await apiBookmarkService.remove(id);
    else await apiBookmarkService.add(id);
  } catch {
    set({ saved, toast: { key: "saveError" } }); // rollback về trạng thái cũ
  }
},
```
- `logout`:
```ts
logout: async () => {
  try {
    await fetch(`${API}/auth/reader/logout`, { method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" } });
  } catch { /* vẫn clear local */ }
  set({ user: null, saved: {}, toast: { key: "loggedOut" } });
},
```
- `ToastKey` thêm `"saveError"`. Thêm `API` const đầu file: `const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";`.

- [ ] **Step 4: Gọi `hydrate` khi mount** — trong `MagazineBoard` (hoặc provider client) `useEffect(() => { useMagazineStore.getState().hydrate(); }, [])`. Đảm bảo chỉ chạy client.

- [ ] **Step 5: Chạy — pass.** Run: `pnpm --filter @ultimate/web test` → PASS (sửa các test cũ tham chiếu `login()`/`MockUser`).

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/magazine/store/
git commit -m "feat(web): store hydrate reader + optimistic bookmark (rollback) + logout API"
```

### Task 14: Auth modal — nút "Tiếp tục với Google" + i18n

**Files:**
- Modify: `apps/web/src/features/magazine/components/auth-modal.tsx`
- Modify: `apps/web/messages/vi.json` (+ i18n:gen sinh en/types)
- Test: `apps/web/src/features/magazine/components/auth-modal.test.tsx`

- [ ] **Step 1: Thêm message keys** vào `messages/vi.json` (nhóm `auth`): `googleCta` ("Tiếp tục với Google"), `intro` (mô tả ngắn tại sao đăng nhập), `saveError` (toast "Không lưu được, thử lại"). Chạy: `pnpm --filter @ultimate/web i18n:gen`.

- [ ] **Step 2: Viết test** — modal render anchor có href chứa `/auth/reader/google/login?returnTo=` + pathname hiện tại.

```tsx
import { render, screen } from "@testing-library/react";
// ... provider next-intl như các test component khác
it("hiện nút Google với returnTo", () => {
  // render AuthModal (authOpen=true) tại pathname "/blog/x"
  const link = screen.getByRole("link", { name: /Google/i });
  expect(link).toHaveAttribute("href", expect.stringContaining("/auth/reader/google/login?returnTo="));
});
```

- [ ] **Step 3: Chạy — fail.**

- [ ] **Step 4: Sửa `auth-modal.tsx`** — bỏ form name/email + login/register mode; render:
```tsx
const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";
// pathname từ usePathname() của @/i18n/navigation
const returnTo = encodeURIComponent(pathname || "/");
const href = `${API}/auth/reader/google/login?returnTo=${returnTo}`;
// <a href={href} ...>{t("googleCta")}</a>
```
Giữ overlay/close. Bỏ `authMode` khỏi store nếu không còn dùng (grep).

- [ ] **Step 5: Chạy — pass.** Run: `pnpm --filter @ultimate/web test` → PASS. Guard i18n test xanh.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/features/magazine/components/auth-modal.tsx apps/web/messages/ apps/web/src/**/messages.d.ts
git commit -m "feat(web): auth modal nút Google (BFF redirect + returnTo) + i18n keys"
```

---

## PHASE 11 — Verify E2E + docs + expert review

### Task 15: Verify end-to-end + cập nhật docs + nhận xét chuyên gia

**Files:**
- Modify: `CLAUDE.md` (Trạng thái + 📍 Điểm hiện tại + mục Slice 13)
- Modify: `docs/status-roadmap.html` (HỎI trước khi sửa .html theo quy ước)
- Modify: `docs/reviews/2026-07-11-senior-code-review.md` (note nợ mới nếu có)
- Modify: `services/core/README.md` (reader redirect URI)

- [ ] **Step 1: Build tất cả**

```bash
cd services/core && go build ./... && go test ./...
cd ../.. && pnpm --filter @ultimate/types build && pnpm --filter @ultimate/web build && pnpm --filter @ultimate/web test
```
Expected: tất cả xanh.

- [ ] **Step 2: Chạy stack thật + verify**

Docker (PG+Redis) → migrate `blog` → core (`.env`: REDIS_URL, VIEW_DEDUP_SALT, CORS gồm :3000, READER_REDIRECT_URL) → web (`NEXT_PUBLIC_API_URL=http://localhost:8080`). Google Console: thêm reader redirect URI `http://localhost:8080/auth/reader/google/callback`.

Kiểm (ghi lại kết quả thật, không phỏng đoán):
1. Modal → "Tiếp tục với Google" → đăng nhập Google → về đúng trang (returnTo) → header hiện tên; `GET /auth/reader/me` trả user.
2. Bookmark save/unsave → DB `bookmarks` có/mất row; reload trang → trạng thái giữ (hydrate).
3. Newsletter submit → row `subscribers`; submit lại → vẫn 201, không lộ; email rác → lỗi inline.
4. Rate limit: `for i in {1..7}; do curl -s -o /dev/null -w "%{http_code}\n" -X POST localhost:8080/api/v1/subscribers -H 'content-type: application/json' -d '{"email":"x@y.com"}'; done` → thấy 429 sau ngưỡng 5, kèm `Retry-After`.
5. View dedupe: gọi `POST /posts/<slug>/view` 2 lần cùng session/IP → sau flush batch, `views` chỉ +1; `redis-cli KEYS 'views:seen:*'` thấy key. Tắt Redis → API vẫn 200/202, đếm bình thường (fail-open).
6. Dark mode + `/en`: chrome dịch đủ (googleCta, saveError...).

- [ ] **Step 3: Cập nhật CLAUDE.md** — thêm mục `✅ Slice 13 — DONE` (mô tả 4 mảng), cập nhật "📍 Điểm hiện tại" (Slice 13 xong → tiếp theo CI/CD + deploy VPS), trỏ spec + plan.

- [ ] **Step 4: README core** — mục reader auth: cần thêm reader redirect URI vào Google Console (dev+prod), env `READER_REDIRECT_URL`, `WEB_BASE_URL`, `VIEW_DEDUP_SALT`, CORS thêm web origin.

- [ ] **Step 5: Nhận xét chuyên gia 0.1%** — viết đánh giá cuối slice (thẳng thắn): còn thiếu gì (vd unsubscribe flow, reader profile/GDPR delete, CSRF token cho form, trusted-proxy ClientIP ở production sau Nginx/Cloudflare, rate-limit theo IP dễ bị NAT gộp, dedupe theo ngày UTC lệch múi giờ VN), rủi ro production, ưu tiên. Note nợ mới vào `docs/reviews/2026-07-11-senior-code-review.md` (mã nối tiếp).

- [ ] **Step 6: HỎI trước khi sửa `docs/status-roadmap.html`** (quy ước: .md trước, hỏi trước khi cập nhật .html).

- [ ] **Step 7: Commit + finish branch**

```bash
git add CLAUDE.md services/core/README.md docs/reviews/
git commit -m "docs(slice13): DONE — cập nhật trạng thái + README reader auth + nhận xét chuyên gia"
```
Rồi dùng skill `superpowers:finishing-a-development-branch` để quyết định merge/PR.

---

## Self-Review (đã chạy)

- **Spec coverage:** A(data model)→Task1; B(reader auth)→Task5; C(bookmark)→Task6; D(newsletter)→Task7; E(rate limit)→Task8; F(view dedupe)→Task9; G(wiring)→Task10,11; H(frontend)→Task12,13,14; I(test)→rải trong mọi task; J(verify)→Task15; K(nợ)→Task15 Step5. Đủ.
- **Placeholder scan:** không có TBD/TODO trong code steps; mọi test + impl có code thật. Chỗ "đọc file để khớp pattern" (test DB helper, atlas-loader gom models, view handler body) là hướng dẫn khảo sát có chủ đích — executor đọc file thật để lấy đúng signature, không phải placeholder logic.
- **Type consistency:** `Reader{ID,GoogleSub,Email,Name}` nhất quán; `Repository` interface khớp giữa Task2 định nghĩa và Task3 tiêu thụ; `CtxReaderID` dùng chung Task5/6; `ViewDeduper.FirstToday(ctx,slug,identity)` khớp Task9 impl+wiring; `apiBookmarkService.{load,add,remove}` khớp Task12/13; reader auth path `/auth/reader/*` top-level (không `/api/v1`) nhất quán store+modal+handler.
- **Rủi ro đã nêu:** `jsonmw.RequireJSON` với DELETE không body (Task11 ghi chú), `cch.(*cache.Redis)` type assertion (chỉ đúng khi Redis bật — nil-safe), atlas migration citext/FK chỉnh tay.
