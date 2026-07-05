package auth

import (
	"context"
	"errors"
	"strings"
	"testing"
)

// fakeProvider là OAuthProvider giả cho unit test service.
type fakeProvider struct {
	id          Identity
	exchangeErr error
	gotCode     string
	gotVerifier string
}

func (f *fakeProvider) AuthCodeURL(state, verifier string) string {
	return "https://accounts.google.com/o/oauth2/auth?state=" + state
}

func (f *fakeProvider) Exchange(_ context.Context, code, verifier string) (Identity, error) {
	f.gotCode, f.gotVerifier = code, verifier
	return f.id, f.exchangeErr
}

func newService(provider OAuthProvider, allow string) *Service {
	return NewService(provider, NewAllowlist(allow))
}

func TestService_StartLogin(t *testing.T) {
	svc := newService(&fakeProvider{}, "a@x.com")

	s1, v1, url1, err := svc.StartLogin()
	if err != nil {
		t.Fatalf("StartLogin: %v", err)
	}
	if s1 == "" || v1 == "" {
		t.Fatal("state and verifier must be non-empty")
	}
	if !strings.Contains(url1, "state="+s1) {
		t.Errorf("url must embed state: %s", url1)
	}

	s2, _, _, _ := svc.StartLogin()
	if s1 == s2 {
		t.Error("state must differ between calls")
	}
}

func TestService_CompleteLogin_StateMismatch(t *testing.T) {
	fp := &fakeProvider{id: Identity{Email: "a@x.com", EmailVerified: true}}
	svc := newService(fp, "a@x.com")

	_, err := svc.CompleteLogin(context.Background(), "code", "got", "want", "verifier")
	if !errors.Is(err, ErrStateMismatch) {
		t.Fatalf("expected ErrStateMismatch, got %v", err)
	}
	if fp.gotCode != "" {
		t.Error("provider.Exchange must not be called on state mismatch")
	}
}

func TestService_CompleteLogin_EmailNotVerified(t *testing.T) {
	fp := &fakeProvider{id: Identity{Email: "a@x.com", EmailVerified: false}}
	svc := newService(fp, "a@x.com")

	_, err := svc.CompleteLogin(context.Background(), "code", "s", "s", "v")
	if !errors.Is(err, ErrEmailNotVerified) {
		t.Fatalf("expected ErrEmailNotVerified, got %v", err)
	}
}

func TestService_CompleteLogin_NotAllowed(t *testing.T) {
	fp := &fakeProvider{id: Identity{Email: "stranger@evil.com", EmailVerified: true}}
	svc := newService(fp, "a@x.com")

	_, err := svc.CompleteLogin(context.Background(), "code", "s", "s", "v")
	if !errors.Is(err, ErrNotAllowed) {
		t.Fatalf("expected ErrNotAllowed, got %v", err)
	}
}

func TestService_CompleteLogin_Success(t *testing.T) {
	fp := &fakeProvider{id: Identity{Email: "A@X.com", EmailVerified: true, Sub: "123"}}
	svc := newService(fp, "a@x.com")

	id, err := svc.CompleteLogin(context.Background(), "code", "s", "s", "verifier")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if id.Email != "A@X.com" {
		t.Errorf("email = %q", id.Email)
	}
	if fp.gotCode != "code" || fp.gotVerifier != "verifier" {
		t.Errorf("Exchange got code=%q verifier=%q", fp.gotCode, fp.gotVerifier)
	}
}
