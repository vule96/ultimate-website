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

// countCache lưu đếm tạm (TTL ngắn) để tránh COUNT(*) mỗi request list admin.
// nil-safe: default noopCountCache luôn miss + không set → luôn đếm thẳng repo.
type countCache interface {
	Get(ctx context.Context, key string) (int64, bool)
	Set(ctx context.Context, key string, v int64)
}

type noopCountCache struct{}

func (noopCountCache) Get(context.Context, string) (int64, bool) { return 0, false }
func (noopCountCache) Set(context.Context, string, int64)        {}

// Service business logic reader: OAuth (không allowlist), bookmark, newsletter.
type Service struct {
	repo     Repository
	provider auth.OAuthProvider
	cc       countCache
}

func NewService(repo Repository, provider auth.OAuthProvider) *Service {
	return &Service{repo: repo, provider: provider, cc: noopCountCache{}}
}

// WithCountCache bật cache đếm cho list admin (fail-open — cache lỗi vẫn đếm thẳng).
func (s *Service) WithCountCache(cc countCache) *Service {
	if cc != nil {
		s.cc = cc
	}
	return s
}

// cachedCount đọc count từ cache; miss → repo count + set. Lỗi count trả nguyên (không cache).
func (s *Service) cachedCount(ctx context.Context, key string, count func() (int64, error)) (int64, error) {
	if v, ok := s.cc.Get(ctx, key); ok {
		return v, nil
	}
	n, err := count()
	if err != nil {
		return 0, err
	}
	s.cc.Set(ctx, key, n)
	return n, nil
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
// mail.ParseAddress chấp nhận cả dạng "Name <a@b.com>" / "<a@b.com>" / "a@b.com (comment)",
// nên LƯU addr.Address (địa chỉ trần đã chuẩn hoá) thay vì raw input — tránh parser
// differential (lưu rác display-name/angle-bracket) và giữ dedup citext đúng.
func (s *Service) Subscribe(ctx context.Context, email string) error {
	addr, err := mail.ParseAddress(strings.TrimSpace(strings.ToLower(email)))
	if err != nil {
		return ErrInvalidEmail
	}
	return s.repo.UpsertSubscriber(ctx, addr.Address)
}

// --- Admin (list/quản lý — sau RequireAuth) ---

func normPage(page, pageSize int) (offset, limit int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 20
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return (page - 1) * pageSize, pageSize
}

func (s *Service) ListSubscribers(ctx context.Context, status string, page, pageSize int) ([]Subscriber, int64, error) {
	offset, limit := normPage(page, pageSize)
	rows, err := s.repo.ListSubscribers(ctx, status, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.cachedCount(ctx, "subscribers:count:"+status, func() (int64, error) {
		return s.repo.CountSubscribers(ctx, status)
	})
	if err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *Service) DeleteSubscriber(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteSubscriber(ctx, id)
}

// Unsubscribe huỷ đăng ký theo token (từ link email/footer). Token sai → ErrSubscriberNotFound.
func (s *Service) Unsubscribe(ctx context.Context, token uuid.UUID) error {
	return s.repo.UnsubscribeByToken(ctx, token)
}

// DeleteReader xoá tài khoản người đọc (GDPR) + bookmark liên quan.
func (s *Service) DeleteReader(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteReader(ctx, id)
}

func (s *Service) ListReaders(ctx context.Context, page, pageSize int) ([]ReaderWithCount, int64, error) {
	offset, limit := normPage(page, pageSize)
	rows, err := s.repo.ListReaders(ctx, offset, limit)
	if err != nil {
		return nil, 0, err
	}
	total, err := s.cachedCount(ctx, "readers:count", s.wrapCountReaders(ctx))
	if err != nil {
		return nil, 0, err
	}
	return rows, total, nil
}

func (s *Service) wrapCountReaders(ctx context.Context) func() (int64, error) {
	return func() (int64, error) { return s.repo.CountReaders(ctx) }
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
