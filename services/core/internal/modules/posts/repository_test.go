package posts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"gorm.io/gorm"
	gormlogger "gorm.io/gorm/logger"
)

var testGormDB *gorm.DB

func TestMain(m *testing.M) {
	if dsn := os.Getenv("TEST_DATABASE_URL"); dsn != "" {
		db, err := database.Open(dsn, false)
		if err != nil {
			fmt.Println("cannot connect TEST_DATABASE_URL:", err)
			os.Exit(1)
		}
		if err := db.AutoMigrate(&gormPost{}, &gormTag{}); err != nil {
			fmt.Println("automigrate failed:", err)
			os.Exit(1)
		}
		db.Logger = gormlogger.Default.LogMode(gormlogger.Silent)
		testGormDB = db
	}
	os.Exit(m.Run())
}

// newRepoTx trả về repository chạy trong 1 transaction sẽ được rollback sau test.
func newRepoTx(t *testing.T) *GormRepository {
	t.Helper()
	if testGormDB == nil {
		t.Skip("set TEST_DATABASE_URL to run repository integration tests")
	}
	tx := testGormDB.Begin()
	t.Cleanup(func() { tx.Rollback() })
	return NewGormRepository(tx)
}

func samplePost(title, slug string, status PostStatus, tags ...string) *Post {
	p := &Post{
		Title:       title,
		Slug:        slug,
		ContentJSON: json.RawMessage(`{"type":"doc"}`),
		ContentHTML: "<p>hi</p>",
		Status:      status,
	}
	for _, tg := range tags {
		p.Tags = append(p.Tags, Tag{Name: tg, Slug: Slugify(tg)})
	}
	return p
}

func TestRepo_CreateAndGetBySlug(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	p := samplePost("Hello", "hello", StatusDraft, "Go", "Backend")
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}
	if p.ID.String() == "00000000-0000-0000-0000-000000000000" {
		t.Fatal("expected ID to be assigned")
	}

	got, err := repo.GetBySlug(ctx, "hello")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Title != "Hello" || got.ContentHTML != "<p>hi</p>" {
		t.Errorf("unexpected post: %+v", got)
	}
	if len(got.Tags) != 2 {
		t.Errorf("expected 2 tags, got %d", len(got.Tags))
	}
}

func TestRepo_CreateDuplicateSlug_ReturnsErrSlugTaken(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	if err := repo.Create(ctx, samplePost("A", "dup", StatusDraft)); err != nil {
		t.Fatalf("first create: %v", err)
	}
	err := repo.Create(ctx, samplePost("B", "dup", StatusDraft))
	if !errors.Is(err, ErrSlugTaken) {
		t.Fatalf("expected ErrSlugTaken, got %v", err)
	}
}

func TestRepo_GetBySlug_NotFound(t *testing.T) {
	repo := newRepoTx(t)
	_, err := repo.GetBySlug(context.Background(), "does-not-exist")
	if !errors.Is(err, ErrPostNotFound) {
		t.Fatalf("expected ErrPostNotFound, got %v", err)
	}
}

func TestRepo_ReusesExistingTagBySlug(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	if err := repo.Create(ctx, samplePost("A", "a", StatusPublished, "Go")); err != nil {
		t.Fatalf("create a: %v", err)
	}
	if err := repo.Create(ctx, samplePost("B", "b", StatusPublished, "Go")); err != nil {
		t.Fatalf("create b: %v", err)
	}
	tags, err := repo.ListTags(ctx)
	if err != nil {
		t.Fatalf("list tags: %v", err)
	}
	count := 0
	for _, tg := range tags {
		if tg.Slug == "go" {
			count++
		}
	}
	if count != 1 {
		t.Errorf("expected tag 'go' to exist once, found %d", count)
	}
}

func TestRepo_List_FilterAndPaginate(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	_ = repo.Create(ctx, samplePost("P1", "p1", StatusPublished, "Go"))
	_ = repo.Create(ctx, samplePost("P2", "p2", StatusPublished, "Rust"))
	_ = repo.Create(ctx, samplePost("P3", "p3", StatusDraft, "Go"))

	// Filter by status=PUBLISHED
	pub, total, err := repo.List(ctx, ListFilter{Status: string(StatusPublished), Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 2 || len(pub) != 2 {
		t.Errorf("published: total=%d len=%d, want 2/2", total, len(pub))
	}

	// Filter by tag=go
	byTag, total, err := repo.List(ctx, ListFilter{Tag: "go", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list tag: %v", err)
	}
	if total != 2 || len(byTag) != 2 {
		t.Errorf("tag go: total=%d len=%d, want 2/2", total, len(byTag))
	}

	// Pagination: page size 1
	page1, total, err := repo.List(ctx, ListFilter{Limit: 1, Offset: 0})
	if err != nil {
		t.Fatalf("list page: %v", err)
	}
	if total != 3 || len(page1) != 1 {
		t.Errorf("page1: total=%d len=%d, want 3/1", total, len(page1))
	}
}

func TestRepo_List_SearchByTitle(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	_ = repo.Create(ctx, samplePost("Học Golang cơ bản", "hoc-golang", StatusPublished))
	_ = repo.Create(ctx, samplePost("Golang nâng cao", "golang-nang-cao", StatusDraft))
	_ = repo.Create(ctx, samplePost("Rust cho người mới", "rust-moi", StatusPublished))

	// Khớp một phần, không phân biệt hoa thường.
	got, total, err := repo.List(ctx, ListFilter{Search: "golang", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list search: %v", err)
	}
	if total != 2 || len(got) != 2 {
		t.Errorf("search 'golang': total=%d len=%d, want 2/2", total, len(got))
	}

	// Khớp tiếng Việt có dấu.
	got, total, err = repo.List(ctx, ListFilter{Search: "người mới", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list search vi: %v", err)
	}
	if total != 1 || len(got) != 1 || got[0].Slug != "rust-moi" {
		t.Errorf("search 'người mới': total=%d len=%d, want 1/1 rust-moi", total, len(got))
	}

	// Search kết hợp status filter.
	_, total, err = repo.List(ctx, ListFilter{Search: "golang", Status: string(StatusDraft), Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list search+status: %v", err)
	}
	if total != 1 {
		t.Errorf("search 'golang' + DRAFT: total=%d, want 1", total)
	}
}

func TestRepo_Stats(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	_ = repo.Create(ctx, samplePost("A", "a", StatusPublished, "Go"))
	_ = repo.Create(ctx, samplePost("B", "b", StatusPublished, "Rust"))
	_ = repo.Create(ctx, samplePost("C", "c", StatusDraft, "Go"))
	_ = repo.Create(ctx, samplePost("D", "d", StatusPendingApproval))

	s, err := repo.Stats(ctx)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if s.Total != 4 {
		t.Errorf("Total = %d, want 4", s.Total)
	}
	if s.Published != 2 {
		t.Errorf("Published = %d, want 2", s.Published)
	}
	if s.Draft != 1 {
		t.Errorf("Draft = %d, want 1", s.Draft)
	}
	if s.Tags != 2 { // Go, Rust (phân biệt)
		t.Errorf("Tags = %d, want 2", s.Tags)
	}
}

func TestRepo_List_SortByTitleAsc(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	_ = repo.Create(ctx, samplePost("Banana", "s-b", StatusPublished))
	_ = repo.Create(ctx, samplePost("Apple", "s-a", StatusPublished))
	_ = repo.Create(ctx, samplePost("Cherry", "s-c", StatusPublished))

	got, _, err := repo.List(ctx, ListFilter{Sort: "title", Order: "asc", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	titles := []string{got[0].Title, got[1].Title, got[2].Title}
	if titles[0] != "Apple" || titles[1] != "Banana" || titles[2] != "Cherry" {
		t.Errorf("title asc order = %v, want [Apple Banana Cherry]", titles)
	}
}

func TestRepo_List_SortFallbackOnInvalid(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	_ = repo.Create(ctx, samplePost("Old", "f-old", StatusPublished))
	_ = repo.Create(ctx, samplePost("New", "f-new", StatusPublished))

	// Field/order ngoài whitelist → fallback an toàn (không injection, không lỗi), trả đủ rows.
	got, total, err := repo.List(ctx, ListFilter{Sort: "id; DROP TABLE posts", Order: "sideways", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list with invalid sort should not error: %v", err)
	}
	if total != 2 || len(got) != 2 {
		t.Errorf("fallback: total=%d len=%d, want 2/2", total, len(got))
	}
}

func TestRepo_List_SortByTitleDesc(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	_ = repo.Create(ctx, samplePost("Apple", "d-a", StatusPublished))
	_ = repo.Create(ctx, samplePost("Cherry", "d-c", StatusPublished))
	_ = repo.Create(ctx, samplePost("Banana", "d-b", StatusPublished))

	got, _, err := repo.List(ctx, ListFilter{Sort: "title", Order: "desc", Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if got[0].Title != "Cherry" || got[1].Title != "Banana" || got[2].Title != "Apple" {
		t.Errorf("title desc = [%s %s %s], want [Cherry Banana Apple]", got[0].Title, got[1].Title, got[2].Title)
	}
}

func TestRepo_CountByMonth(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	// Tạo 2 bài trong tháng hiện tại (created_at mặc định = now).
	_ = repo.Create(ctx, samplePost("A", "cbm-a", StatusPublished))
	_ = repo.Create(ctx, samplePost("B", "cbm-b", StatusDraft))

	since := time.Now().UTC().AddDate(0, -1, 0)
	counts, err := repo.CountByMonth(ctx, since)
	if err != nil {
		t.Fatalf("count by month: %v", err)
	}
	thisMonth := time.Now().UTC().Format("2006-01")
	if counts[thisMonth] != 2 {
		t.Errorf("counts[%s] = %d, want 2", thisMonth, counts[thisMonth])
	}
}

func TestRepo_Update_ReplacesTags(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	p := samplePost("Orig", "orig", StatusDraft, "Go", "Old")
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}

	p.Title = "Updated"
	p.Tags = []Tag{{Name: "New", Slug: "new"}}
	if err := repo.Update(ctx, p); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, err := repo.GetBySlug(ctx, "orig")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.Title != "Updated" {
		t.Errorf("title = %q, want Updated", got.Title)
	}
	if len(got.Tags) != 1 || got.Tags[0].Slug != "new" {
		t.Errorf("tags = %+v, want single 'new'", got.Tags)
	}
}

func TestRepo_Update_PreservesCreatedAt(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	p := samplePost("Orig", "keep-created", StatusDraft)
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}
	created := p.CreatedAt
	if created.IsZero() {
		t.Fatal("created_at should be set after create")
	}

	p.Title = "Changed"
	if err := repo.Update(ctx, p); err != nil {
		t.Fatalf("update: %v", err)
	}

	got, err := repo.GetBySlug(ctx, "keep-created")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	if got.CreatedAt.IsZero() {
		t.Errorf("created_at was wiped on update")
	}
	if !got.CreatedAt.Equal(created) {
		t.Errorf("created_at changed on update: got %v, want %v", got.CreatedAt, created)
	}
}

func TestRepo_Delete(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()

	p := samplePost("Del", "del", StatusDraft, "Go")
	if err := repo.Create(ctx, p); err != nil {
		t.Fatalf("create: %v", err)
	}
	if err := repo.Delete(ctx, p.ID); err != nil {
		t.Fatalf("delete: %v", err)
	}
	if _, err := repo.GetBySlug(ctx, "del"); !errors.Is(err, ErrPostNotFound) {
		t.Errorf("expected ErrPostNotFound after delete, got %v", err)
	}
	// Deleting again → ErrPostNotFound
	if err := repo.Delete(ctx, p.ID); !errors.Is(err, ErrPostNotFound) {
		t.Errorf("expected ErrPostNotFound on second delete, got %v", err)
	}
}
