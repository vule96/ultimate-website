package readers

import (
	"context"
	"strings"
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
	require.NoError(t, repo.UpsertSubscriber(ctx, email)) // trùng đúng literal → no-op

	// citext case-insensitive dedup: cùng địa chỉ nhưng khác hoa/thường phải
	// KHÔNG tạo thêm dòng mới — vẫn phải còn đúng 1 dòng cho địa chỉ này.
	require.NoError(t, repo.UpsertSubscriber(ctx, strings.ToUpper(email)))

	var count int64
	require.NoError(t, db.Table("subscribers").Where("email = ?", email).Count(&count).Error)
	require.Equal(t, int64(1), count)
}

func TestGetReader_NotFound(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	_, err := repo.GetReader(context.Background(), uuid.New())
	require.ErrorIs(t, err, ErrReaderNotFound)
}

func TestListSubscribers_Paging(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	for range 3 {
		require.NoError(t, repo.UpsertSubscriber(ctx, uuid.NewString()+"@example.com"))
	}

	page1, total, err := repo.ListSubscribers(ctx, 0, 2)
	require.NoError(t, err)
	require.Equal(t, int64(3), total)
	require.Len(t, page1, 2)

	page2, _, err := repo.ListSubscribers(ctx, 2, 2)
	require.NoError(t, err)
	require.Len(t, page2, 1)
}

func TestDeleteSubscriber(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	require.NoError(t, repo.UpsertSubscriber(ctx, uuid.NewString()+"@example.com"))
	subs, _, err := repo.ListSubscribers(ctx, 0, 10)
	require.NoError(t, err)
	require.Len(t, subs, 1)

	require.NoError(t, repo.DeleteSubscriber(ctx, subs[0].ID))
	require.ErrorIs(t, repo.DeleteSubscriber(ctx, subs[0].ID), ErrSubscriberNotFound)
	require.ErrorIs(t, repo.DeleteSubscriber(ctx, uuid.New()), ErrSubscriberNotFound)
}

func TestListReaders_WithBookmarkCount(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	r, _ := repo.UpsertReader(ctx, "sub-"+uuid.NewString(), "reader@example.com", "Reader")
	require.NoError(t, repo.AddBookmark(ctx, r.ID, seedPost(t, db)))
	require.NoError(t, repo.AddBookmark(ctx, r.ID, seedPost(t, db)))
	// reader thứ 2 không bookmark
	repo.UpsertReader(ctx, "sub-"+uuid.NewString(), "reader2@example.com", "Reader2")

	list, total, err := repo.ListReaders(ctx, 0, 10)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	byEmail := map[string]int64{}
	for _, x := range list {
		byEmail[x.Email] = x.BookmarkCount
	}
	require.Equal(t, int64(2), byEmail["reader@example.com"])
	require.Equal(t, int64(0), byEmail["reader2@example.com"])
}
