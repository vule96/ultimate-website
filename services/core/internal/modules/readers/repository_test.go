package readers

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
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

	page1, err := repo.ListSubscribers(ctx, "", 0, 2)
	require.NoError(t, err)
	total, err := repo.CountSubscribers(ctx, "")
	require.NoError(t, err)
	require.Equal(t, int64(3), total)
	require.Len(t, page1, 2)

	page2, err := repo.ListSubscribers(ctx, "", 2, 2)
	require.NoError(t, err)
	require.Len(t, page2, 1)
}

func TestDeleteSubscriber_SoftDelete(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	require.NoError(t, repo.UpsertSubscriber(ctx, uuid.NewString()+"@example.com"))
	subs, err := repo.ListSubscribers(ctx, "", 0, 10)
	require.NoError(t, err)
	require.Len(t, subs, 1)

	require.NoError(t, repo.DeleteSubscriber(ctx, subs[0].ID))
	// Soft-delete: row còn nhưng biến khỏi list + count.
	after, err := repo.ListSubscribers(ctx, "", 0, 10)
	require.NoError(t, err)
	require.Empty(t, after)
	total, err := repo.CountSubscribers(ctx, "")
	require.NoError(t, err)
	require.Equal(t, int64(0), total)
	// Xoá lại row đã soft-delete → NotFound.
	require.ErrorIs(t, repo.DeleteSubscriber(ctx, subs[0].ID), ErrSubscriberNotFound)
	require.ErrorIs(t, repo.DeleteSubscriber(ctx, uuid.New()), ErrSubscriberNotFound)
}

func TestUnsubscribeByToken(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	email := uuid.NewString() + "@example.com"
	require.NoError(t, repo.UpsertSubscriber(ctx, email))

	token := subscriberToken(t, db, email)
	require.NotEqual(t, uuid.Nil, token)

	require.NoError(t, repo.UnsubscribeByToken(ctx, token))
	// status đổi sang unsubscribed nhưng row còn trong list (chưa soft-delete).
	subs, err := repo.ListSubscribers(ctx, "", 0, 10)
	require.NoError(t, err)
	require.Len(t, subs, 1)
	require.Equal(t, "unsubscribed", subs[0].Status)
	// Filter status.
	active, err := repo.ListSubscribers(ctx, "active", 0, 10)
	require.NoError(t, err)
	require.Empty(t, active)
	unsub, err := repo.ListSubscribers(ctx, "unsubscribed", 0, 10)
	require.NoError(t, err)
	require.Len(t, unsub, 1)
	// Token sai → NotFound.
	require.ErrorIs(t, repo.UnsubscribeByToken(ctx, uuid.New()), ErrSubscriberNotFound)
}

// Consent: re-subscribe (public POST) KHÔNG được reactivate người đã unsubscribe.
func TestUpsertSubscriber_DoesNotReactivateUnsubscribed(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	email := uuid.NewString() + "@example.com"
	require.NoError(t, repo.UpsertSubscriber(ctx, email))
	token := subscriberToken(t, db, email)
	require.NoError(t, repo.UnsubscribeByToken(ctx, token))

	// Public re-subscribe cùng email → phải GIỮ unsubscribed (honor opt-out), không lỗi.
	require.NoError(t, repo.UpsertSubscriber(ctx, email))
	active, err := repo.ListSubscribers(ctx, "active", 0, 10)
	require.NoError(t, err)
	require.Empty(t, active, "không được reactivate người đã huỷ")
	unsub, err := repo.ListSubscribers(ctx, "unsubscribed", 0, 10)
	require.NoError(t, err)
	require.Len(t, unsub, 1)
	require.Equal(t, "unsubscribed", unsub[0].Status)
}

// Row admin soft-delete (chưa opt-out) thì người dùng tự đăng ký lại được hồi sinh active, giữ token.
func TestUpsertSubscriber_RevivesSoftDeleted(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	email := uuid.NewString() + "@example.com"
	require.NoError(t, repo.UpsertSubscriber(ctx, email))
	token := subscriberToken(t, db, email)
	subs, err := repo.ListSubscribers(ctx, "", 0, 10)
	require.NoError(t, err)
	require.NoError(t, repo.DeleteSubscriber(ctx, subs[0].ID)) // soft-delete

	require.NoError(t, repo.UpsertSubscriber(ctx, email)) // đăng ký lại
	active, err := repo.ListSubscribers(ctx, "active", 0, 10)
	require.NoError(t, err)
	require.Len(t, active, 1)
	require.Equal(t, "active", active[0].Status)
	require.Equal(t, token, subscriberToken(t, db, email), "token không đổi khi hồi sinh")
}

// subscriberToken đọc unsubscribe_token của email (scan string rồi parse — tránh scan
// thẳng vào uuid.UUID vì driver trả string).
func subscriberToken(t *testing.T, db *gorm.DB, email string) uuid.UUID {
	t.Helper()
	var s string
	require.NoError(t, db.Table("subscribers").Where("email = ?", email).Select("unsubscribe_token").Scan(&s).Error)
	return uuid.MustParse(s)
}

func TestDeleteReader_CascadesBookmarks(t *testing.T) {
	db := newTestDB(t)
	repo := NewGormRepository(db)
	ctx := context.Background()
	r, _ := repo.UpsertReader(ctx, "sub-"+uuid.NewString(), "del@example.com", "Del")
	require.NoError(t, repo.AddBookmark(ctx, r.ID, seedPost(t, db)))

	require.NoError(t, repo.DeleteReader(ctx, r.ID))
	// Reader biến mất.
	_, err := repo.GetReader(ctx, r.ID)
	require.ErrorIs(t, err, ErrReaderNotFound)
	// Bookmark của reader cũng xoá.
	ids, err := repo.ListBookmarks(ctx, r.ID)
	require.NoError(t, err)
	require.Empty(t, ids)
	// Xoá lại → NotFound.
	require.ErrorIs(t, repo.DeleteReader(ctx, r.ID), ErrReaderNotFound)
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

	list, err := repo.ListReaders(ctx, 0, 10)
	require.NoError(t, err)
	total, err := repo.CountReaders(ctx)
	require.NoError(t, err)
	require.Equal(t, int64(2), total)
	byEmail := map[string]int64{}
	for _, x := range list {
		byEmail[x.Email] = x.BookmarkCount
	}
	require.Equal(t, int64(2), byEmail["reader@example.com"])
	require.Equal(t, int64(0), byEmail["reader2@example.com"])
}
