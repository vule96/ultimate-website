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

func (s *Service) ListSubscribers(ctx context.Context, page, pageSize int) ([]Subscriber, int64, error) {
	offset, limit := normPage(page, pageSize)
	return s.repo.ListSubscribers(ctx, offset, limit)
}

func (s *Service) DeleteSubscriber(ctx context.Context, id uuid.UUID) error {
	return s.repo.DeleteSubscriber(ctx, id)
}

func (s *Service) ListReaders(ctx context.Context, page, pageSize int) ([]ReaderWithCount, int64, error) {
	offset, limit := normPage(page, pageSize)
	return s.repo.ListReaders(ctx, offset, limit)
}

func randomToken() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}
