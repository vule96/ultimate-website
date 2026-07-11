package auth

import (
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

const appDone = "http://app.local/done"

// newAuthServer dựng httptest server: scs memstore + fake provider + route bảo vệ.
func newAuthServer(t *testing.T, fp OAuthProvider, allow string) (*httptest.Server, *scs.SessionManager) {
	t.Helper()
	sm := scs.New() // mặc định memstore
	sm.Cookie.Secure = false

	svc := NewService(fp, NewAllowlist(allow))
	eng := gin.New()
	NewHandler(svc, sm, appDone).RegisterRoutes(eng)
	eng.GET("/protected", RequireAuth(sm), func(c *gin.Context) { c.String(http.StatusOK, "ok") })

	srv := httptest.NewServer(sm.LoadAndSave(eng))
	t.Cleanup(srv.Close)
	return srv, sm
}

func newClient(t *testing.T) *http.Client {
	t.Helper()
	jar, _ := cookiejar.New(nil)
	return &http.Client{
		Jar:           jar,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func allowedProvider() *fakeProvider {
	return &fakeProvider{id: Identity{Email: "admin@x.com", EmailVerified: true, Sub: "1"}}
}

// mustGet thực hiện GET và fail test nếu có lỗi truyền tải.
func mustGet(t *testing.T, c *http.Client, url string) *http.Response {
	t.Helper()
	resp, err := c.Get(url)
	if err != nil {
		t.Fatal(err)
	}
	return resp
}

func TestHandler_LoginRedirectsToProvider(t *testing.T) {
	srv, _ := newAuthServer(t, allowedProvider(), "admin@x.com")
	c := newClient(t)

	resp, err := c.Get(srv.URL + "/auth/google/login")
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusFound {
		t.Fatalf("status = %d, want 302", resp.StatusCode)
	}
	loc := resp.Header.Get("Location")
	if !strings.Contains(loc, "accounts.google.com") || !strings.Contains(loc, "state=") {
		t.Errorf("Location missing provider/state: %s", loc)
	}
}

// fullLogin thực hiện login → callback, trả client đã đăng nhập.
func fullLogin(t *testing.T, srv *httptest.Server) *http.Client {
	t.Helper()
	c := newClient(t)
	resp, err := c.Get(srv.URL + "/auth/google/login")
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	loc := resp.Header.Get("Location")
	u, _ := url.Parse(loc)
	state := u.Query().Get("state")

	cb, err := c.Get(srv.URL + "/auth/google/callback?code=abc&state=" + state)
	if err != nil {
		t.Fatal(err)
	}
	cb.Body.Close()
	if cb.StatusCode != http.StatusFound {
		t.Fatalf("callback status = %d, want 302; ", cb.StatusCode)
	}
	if cb.Header.Get("Location") != appDone {
		t.Fatalf("callback redirect = %q, want %q", cb.Header.Get("Location"), appDone)
	}
	return c
}

func TestHandler_FullLoginFlow_MeAndProtected(t *testing.T) {
	srv, _ := newAuthServer(t, allowedProvider(), "admin@x.com")
	c := fullLogin(t, srv)

	// /auth/me trả email
	me := mustGet(t, c, srv.URL+"/auth/me")
	defer me.Body.Close()
	if me.StatusCode != http.StatusOK {
		t.Fatalf("me status = %d, want 200", me.StatusCode)
	}

	// route bảo vệ cho qua
	p := mustGet(t, c, srv.URL+"/protected")
	defer p.Body.Close()
	if p.StatusCode != http.StatusOK {
		t.Errorf("protected status = %d, want 200", p.StatusCode)
	}
}

func TestHandler_Logout(t *testing.T) {
	srv, _ := newAuthServer(t, allowedProvider(), "admin@x.com")
	c := fullLogin(t, srv)

	req, _ := http.NewRequest(http.MethodPost, srv.URL+"/auth/logout", nil)
	lo, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	lo.Body.Close()
	if lo.StatusCode != http.StatusNoContent {
		t.Fatalf("logout status = %d, want 204", lo.StatusCode)
	}

	me := mustGet(t, c, srv.URL+"/auth/me")
	me.Body.Close()
	if me.StatusCode != http.StatusUnauthorized {
		t.Errorf("me after logout = %d, want 401", me.StatusCode)
	}
}

func TestHandler_CallbackStateMismatch(t *testing.T) {
	srv, _ := newAuthServer(t, allowedProvider(), "admin@x.com")
	c := newClient(t)
	// login để có session state
	r := mustGet(t, c, srv.URL+"/auth/google/login")
	r.Body.Close()
	// callback với state sai
	cb := mustGet(t, c, srv.URL+"/auth/google/callback?code=abc&state=WRONG")
	cb.Body.Close()
	if cb.StatusCode != http.StatusUnauthorized {
		t.Errorf("state mismatch status = %d, want 401", cb.StatusCode)
	}
}

func TestHandler_CallbackNotAllowed(t *testing.T) {
	fp := &fakeProvider{id: Identity{Email: "stranger@evil.com", EmailVerified: true}}
	srv, _ := newAuthServer(t, fp, "admin@x.com")
	c := newClient(t)
	r := mustGet(t, c, srv.URL+"/auth/google/login")
	r.Body.Close()
	loc := r.Header.Get("Location")
	u, _ := url.Parse(loc)
	cb := mustGet(t, c, srv.URL+"/auth/google/callback?code=abc&state="+u.Query().Get("state"))
	cb.Body.Close()
	if cb.StatusCode != http.StatusForbidden {
		t.Errorf("not-allowed status = %d, want 403", cb.StatusCode)
	}
}

func TestMiddleware_RejectsWithoutSession(t *testing.T) {
	srv, _ := newAuthServer(t, allowedProvider(), "admin@x.com")
	c := newClient(t)
	p := mustGet(t, c, srv.URL+"/protected")
	p.Body.Close()
	if p.StatusCode != http.StatusUnauthorized {
		t.Errorf("protected without session = %d, want 401", p.StatusCode)
	}
}

func TestHandler_MeWithoutSession(t *testing.T) {
	srv, _ := newAuthServer(t, allowedProvider(), "admin@x.com")
	c := newClient(t)
	me := mustGet(t, c, srv.URL+"/auth/me")
	me.Body.Close()
	if me.StatusCode != http.StatusUnauthorized {
		t.Errorf("me without session = %d, want 401", me.StatusCode)
	}
}

func TestIsAuthenticated(t *testing.T) {
	sm := scs.New() // MemStore mặc định

	var got bool
	h := sm.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got = IsAuthenticated(sm)(r.Context())
		if r.URL.Query().Get("login") == "1" {
			sm.Put(r.Context(), sessionKeyAdminEmail, "admin@example.com")
		}
	}))

	// Request 1: chưa có session → false (đồng thời login để lấy cookie).
	w1 := httptest.NewRecorder()
	h.ServeHTTP(w1, httptest.NewRequest(http.MethodGet, "/?login=1", nil))
	if got {
		t.Error("request chưa đăng nhập: IsAuthenticated phải trả false")
	}

	// Request 2: kèm cookie session → true.
	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	for _, c := range w1.Result().Cookies() {
		req2.AddCookie(c)
	}
	h.ServeHTTP(httptest.NewRecorder(), req2)
	if !got {
		t.Error("request có session admin_email: IsAuthenticated phải trả true")
	}
}
