package readers

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

// TestFK_ReaderDeleteCascadesBookmarks chứng minh FK ON DELETE CASCADE (khớp migration
// add_readers) chứ KHÔNG dựa vào repo.DeleteReader — dùng raw DELETE trực tiếp trên readers,
// bookmark phải tự biến mất do ràng buộc DB. Bổ khuyết cho gap "AutoMigrate không tạo FK".
func TestFK_ReaderDeleteCascadesBookmarks(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	r, _ := repo.UpsertReader(ctx, "sub-"+uuid.NewString(), "fk@example.com", "FK")
	require.NoError(t, repo.AddBookmark(ctx, r.ID, seedPost(t, db)))

	// Raw DELETE (không qua repo.DeleteReader) → cascade phải do FK DB thực hiện.
	require.NoError(t, db.Exec("DELETE FROM readers WHERE id = ?", r.ID).Error)

	var cnt int64
	require.NoError(t, db.Table("bookmarks").Where("reader_id = ?", r.ID).Count(&cnt).Error)
	require.Equal(t, int64(0), cnt, "bookmark phải bị cascade khi xoá reader")
}

// TestFK_PostDeleteCascadesBookmarks: xoá post cũng cascade bookmark (FK post_id).
func TestFK_PostDeleteCascadesBookmarks(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	r, _ := repo.UpsertReader(ctx, "sub-"+uuid.NewString(), "fk2@example.com", "FK2")
	post := seedPost(t, db)
	require.NoError(t, repo.AddBookmark(ctx, r.ID, post))

	require.NoError(t, db.Exec("DELETE FROM posts WHERE id = ?", post).Error)

	var cnt int64
	require.NoError(t, db.Table("bookmarks").Where("post_id = ?", post).Count(&cnt).Error)
	require.Equal(t, int64(0), cnt, "bookmark phải bị cascade khi xoá post")
}
