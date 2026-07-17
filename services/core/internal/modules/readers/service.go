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
