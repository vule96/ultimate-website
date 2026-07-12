package posts

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/vule96/ultimate-website/services/core/internal/platform/database"
	"github.com/vule96/ultimate-website/services/core/internal/platform/outbox"
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
		if err := db.AutoMigrate(&gormPost{}, &gormTag{}, &outbox.Event{}); err != nil {
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
	tags, err := repo.ListTags(ctx, false)
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
	tok := uuid.NewString()[:8]
	tagGo := "go-" + tok
	tagRust := "rust-" + tok

	_ = repo.Create(ctx, samplePost("P1 "+tok, "p1-"+tok, StatusPublished, tagGo))
	_ = repo.Create(ctx, samplePost("P2 "+tok, "p2-"+tok, StatusPublished, tagRust))
	_ = repo.Create(ctx, samplePost("P3 "+tok, "p3-"+tok, StatusDraft, tagGo))

	// Filter by status=PUBLISHED
	pub, total, err := repo.List(ctx, ListFilter{Status: string(StatusPublished), Search: tok, Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if total != 2 || len(pub) != 2 {
		t.Errorf("published: total=%d len=%d, want 2/2", total, len(pub))
	}

	// Filter by tag
	byTag, total, err := repo.List(ctx, ListFilter{Tag: Slugify(tagGo), Search: tok, Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list tag: %v", err)
	}
	if total != 2 || len(byTag) != 2 {
		t.Errorf("tag go: total=%d len=%d, want 2/2", total, len(byTag))
	}

	// Pagination: page size 1
	page1, total, err := repo.List(ctx, ListFilter{Search: tok, Limit: 1, Offset: 0})
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
	tok := uuid.NewString()[:8]

	// tok đặt ngay sau cụm từ tìm kiếm (liên tục) để khớp ILIKE substring
	// "<cụm> "+tok — cô lập khỏi dữ liệu khác trong DB (bẩn hoặc sạch).
	_ = repo.Create(ctx, samplePost("Học Golang "+tok+" cơ bản", "hoc-golang-"+tok, StatusPublished))
	_ = repo.Create(ctx, samplePost("Golang "+tok+" nâng cao", "golang-nang-cao-"+tok, StatusDraft))
	_ = repo.Create(ctx, samplePost("Rust cho người mới "+tok, "rust-moi-"+tok, StatusPublished))

	// Khớp một phần, không phân biệt hoa thường.
	got, total, err := repo.List(ctx, ListFilter{Search: "golang " + tok, Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list search: %v", err)
	}
	if total != 2 || len(got) != 2 {
		t.Errorf("search 'golang': total=%d len=%d, want 2/2", total, len(got))
	}

	// Khớp tiếng Việt có dấu.
	got, total, err = repo.List(ctx, ListFilter{Search: "người mới " + tok, Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list search vi: %v", err)
	}
	if total != 1 || len(got) != 1 || got[0].Slug != "rust-moi-"+tok {
		t.Errorf("search 'người mới': total=%d len=%d, want 1/1 rust-moi-%s", total, len(got), tok)
	}

	// Search kết hợp status filter.
	_, total, err = repo.List(ctx, ListFilter{Search: "golang " + tok, Status: string(StatusDraft), Limit: 10, Offset: 0})
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

	before, err := repo.Stats(ctx)
	if err != nil {
		t.Fatalf("stats before: %v", err)
	}

	tagGo := "go-" + uuid.NewString()[:8]
	tagRust := "rust-" + uuid.NewString()[:8]
	_ = repo.Create(ctx, samplePost("A", "a-"+uuid.NewString()[:8], StatusPublished, tagGo))
	_ = repo.Create(ctx, samplePost("B", "b-"+uuid.NewString()[:8], StatusPublished, tagRust))
	_ = repo.Create(ctx, samplePost("C", "c-"+uuid.NewString()[:8], StatusDraft, tagGo))
	_ = repo.Create(ctx, samplePost("D", "d-"+uuid.NewString()[:8], StatusPendingApproval))

	s, err := repo.Stats(ctx)
	if err != nil {
		t.Fatalf("stats: %v", err)
	}
	if got := s.Total - before.Total; got != 4 {
		t.Errorf("Total delta = %d, want 4", got)
	}
	if got := s.Published - before.Published; got != 2 {
		t.Errorf("Published delta = %d, want 2", got)
	}
	if got := s.Draft - before.Draft; got != 1 {
		t.Errorf("Draft delta = %d, want 1", got)
	}
	if got := s.Tags - before.Tags; got != 2 { // tagGo, tagRust (phân biệt, unique)
		t.Errorf("Tags delta = %d, want 2", got)
	}
}

func TestRepo_List_SortByTitleAsc(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	tok := uuid.NewString()[:8]
	_ = repo.Create(ctx, samplePost("Banana "+tok, "s-b-"+tok, StatusPublished))
	_ = repo.Create(ctx, samplePost("Apple "+tok, "s-a-"+tok, StatusPublished))
	_ = repo.Create(ctx, samplePost("Cherry "+tok, "s-c-"+tok, StatusPublished))

	got, _, err := repo.List(ctx, ListFilter{Sort: "title", Order: "asc", Search: tok, Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	titles := []string{got[0].Title, got[1].Title, got[2].Title}
	if titles[0] != "Apple "+tok || titles[1] != "Banana "+tok || titles[2] != "Cherry "+tok {
		t.Errorf("title asc order = %v, want [Apple Banana Cherry] (tok=%s)", titles, tok)
	}
}

func TestRepo_List_SortFallbackOnInvalid(t *testing.T) {
	repo := newRepoTx(t)
	ctx := context.Background()
	tok := uuid.NewString()[:8]
	_ = repo.Create(ctx, samplePost("Old "+tok, "f-old-"+tok, StatusPublished))
	_ = repo.Create(ctx, samplePost("New "+tok, "f-new-"+tok, StatusPublished))

	// Field/order ngoài whitelist → fallback an toàn (không injection, không lỗi), trả đủ rows.
	got, total, err := repo.List(ctx, ListFilter{Sort: "id; DROP TABLE posts", Order: "sideways", Search: tok, Limit: 10, Offset: 0})
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
	tok := uuid.NewString()[:8]
	_ = repo.Create(ctx, samplePost("Apple "+tok, "d-a-"+tok, StatusPublished))
	_ = repo.Create(ctx, samplePost("Cherry "+tok, "d-c-"+tok, StatusPublished))
	_ = repo.Create(ctx, samplePost("Banana "+tok, "d-b-"+tok, StatusPublished))

	got, _, err := repo.List(ctx, ListFilter{Sort: "title", Order: "desc", Search: tok, Limit: 10, Offset: 0})
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if got[0].Title != "Cherry "+tok || got[1].Title != "Banana "+tok || got[2].Title != "Apple "+tok {
		t.Errorf("title desc = [%s %s %s], want [Cherry Banana Apple] (tok=%s)", got[0].Title, got[1].Title, got[2].Title, tok)
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
