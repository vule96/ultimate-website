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

// AuthCodeURL nhúng state vào query để test callback lấy lại được (giống fixture package auth).
func (f fakeProvider) AuthCodeURL(state, verifier string) string {
	base := f.authURL
	if base == "" {
		base = "https://accounts.google.com/o/oauth2/auth"
	}
	return base + "?state=" + state
}
func (f fakeProvider) Exchange(ctx context.Context, code, verifier string) (auth.Identity, error) {
	return f.id, f.err
}

type fakeRepo struct {
	readers       map[string]Reader // key google_sub
	subs          map[string]bool
	subsList      []Subscriber      // cho admin handler test
	readersList   []ReaderWithCount // cho admin handler test
	deleteErr     error             // cho admin handler test
	unsubToken    uuid.UUID         // token khớp cho UnsubscribeByToken
	unsubbed      bool              // đã gọi unsubscribe đúng token
	deletedID     uuid.UUID         // reader vừa DeleteReader
	countSubCalls int               // đếm số lần CountSubscribers (test count-cache)
	lastSubStatus string            // status filter nhận được lần cuối
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
func (r *fakeRepo) UpsertSubscriber(_ context.Context, email string) error {
	r.subs[email] = true
	return nil
}
func (r *fakeRepo) UnsubscribeByToken(_ context.Context, token uuid.UUID) error {
	if token == r.unsubToken && r.unsubToken != uuid.Nil {
		r.unsubbed = true
		return nil
	}
	return ErrSubscriberNotFound
}
func (r *fakeRepo) DeleteReader(_ context.Context, id uuid.UUID) error {
	r.deletedID = id
	return r.deleteErr
}
func (r *fakeRepo) ListSubscribers(_ context.Context, status string, _, _ int) ([]Subscriber, error) {
	r.lastSubStatus = status
	return r.subsList, nil
}
func (r *fakeRepo) CountSubscribers(_ context.Context, _ string) (int64, error) {
	r.countSubCalls++
	return int64(len(r.subsList)), nil
}
func (r *fakeRepo) DeleteSubscriber(context.Context, uuid.UUID) error { return r.deleteErr }
func (r *fakeRepo) ListReaders(context.Context, int, int) ([]ReaderWithCount, error) {
	return r.readersList, nil
}
func (r *fakeRepo) CountReaders(context.Context) (int64, error) {
	return int64(len(r.readersList)), nil
}

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

// TestSubscribe_NormalizesDisplayName: input dạng "Name <A@B.com>" phải lưu địa chỉ
// trần đã chuẩn hoá (a@b.com), KHÔNG lưu raw display-name (parser differential).
func TestSubscribe_NormalizesDisplayName(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, fakeProvider{})
	require.NoError(t, svc.Subscribe(context.Background(), "Foo Bar <Normalize@Example.com>"))
	require.True(t, repo.subs["normalize@example.com"], "phải lưu địa chỉ trần đã chuẩn hoá")
	require.False(t, repo.subs["foo bar <normalize@example.com>"], "không được lưu dạng display-name")
	require.Len(t, repo.subs, 1)
}

func TestUnsubscribe_TokenMatch(t *testing.T) {
	repo := newFakeRepo()
	repo.unsubToken = uuid.New()
	svc := NewService(repo, fakeProvider{})
	require.NoError(t, svc.Unsubscribe(context.Background(), repo.unsubToken))
	require.True(t, repo.unsubbed)
	require.ErrorIs(t, svc.Unsubscribe(context.Background(), uuid.New()), ErrSubscriberNotFound)
}

func TestDeleteReader_Delegates(t *testing.T) {
	repo := newFakeRepo()
	svc := NewService(repo, fakeProvider{})
	id := uuid.New()
	require.NoError(t, svc.DeleteReader(context.Background(), id))
	require.Equal(t, id, repo.deletedID)
}

// fakeCountCache: hit trả sẵn value; ghi lại Set.
type fakeCountCache struct {
	store map[string]int64
	sets  int
}

func (c *fakeCountCache) Get(_ context.Context, k string) (int64, bool) {
	v, ok := c.store[k]
	return v, ok
}
func (c *fakeCountCache) Set(_ context.Context, k string, v int64) { c.store[k] = v; c.sets++ }

func TestListSubscribers_CountCache_MissThenHit(t *testing.T) {
	repo := newFakeRepo()
	repo.subsList = []Subscriber{{ID: uuid.New(), Email: "a@b.com"}}
	cc := &fakeCountCache{store: map[string]int64{}}
	svc := NewService(repo, fakeProvider{}).WithCountCache(cc)
	ctx := context.Background()

	_, total, err := svc.ListSubscribers(ctx, "", 1, 20)
	require.NoError(t, err)
	require.Equal(t, int64(1), total)
	require.Equal(t, 1, repo.countSubCalls, "miss → đếm repo 1 lần")
	require.Equal(t, 1, cc.sets)

	// Lần 2: cache hit → không đếm repo thêm.
	_, _, err = svc.ListSubscribers(ctx, "", 1, 20)
	require.NoError(t, err)
	require.Equal(t, 1, repo.countSubCalls, "hit → không đếm repo lại")
}

var _ = errors.Is // giữ import errors nếu cần
