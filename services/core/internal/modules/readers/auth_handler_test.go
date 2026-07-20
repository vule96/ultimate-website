package readers

import (
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"testing"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/require"

	"github.com/vule96/ultimate-website/services/core/internal/modules/auth"
)

func init() { gin.SetMode(gin.TestMode) }

const webBaseURL = "http://localhost:3000"

// newTestSM tạo scs.SessionManager dùng memstore in-test (không cần Postgres),
// độc lập với helper của package auth.
func newTestSM(t *testing.T) *scs.SessionManager {
	t.Helper()
	sm := scs.New()
	sm.Cookie.Secure = false
	return sm
}

func newClient(t *testing.T) *http.Client {
	t.Helper()
	jar, _ := cookiejar.New(nil)
	return &http.Client{
		Jar:           jar,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
	}
}

func TestReaderMe_Unauthenticated401(t *testing.T) {
	sm := newTestSM(t)
	h := NewAuthHandler(NewService(newFakeRepo(), fakeProvider{}), sm, webBaseURL)
	r := gin.New()
	h.RegisterRoutes(r)
	srv := sm.LoadAndSave(r)

	req := httptest.NewRequest(http.MethodGet, "/auth/reader/me", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

func TestRequireReader_BlocksAnon(t *testing.T) {
	sm := newTestSM(t)
	r := gin.New()
	g := r.Group("", RequireReader(sm))
	g.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })
	srv := sm.LoadAndSave(r)

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	w := httptest.NewRecorder()
	srv.ServeHTTP(w, req)
	require.Equal(t, http.StatusUnauthorized, w.Code)
}

// newReaderTestServer dựng httptest server đầy đủ để đi qua flow login -> callback -> me/logout.
func newReaderTestServer(t *testing.T, fp fakeProvider) (*httptest.Server, *scs.SessionManager) {
	t.Helper()
	sm := newTestSM(t)
	svc := NewService(newFakeRepo(), fp)
	h := NewAuthHandler(svc, sm, webBaseURL)
	r := gin.New()
	h.RegisterRoutes(r)
	srv := httptest.NewServer(sm.LoadAndSave(r))
	t.Cleanup(srv.Close)
	return srv, sm
}

func verifiedProvider() fakeProvider {
	return fakeProvider{id: auth.Identity{Email: "reader@x.com", EmailVerified: true, Sub: "reader-1", Name: "Reader"}}
}

func TestReaderAuth_FullLoginFlow_MeAndLogout(t *testing.T) {
	srv, _ := newReaderTestServer(t, verifiedProvider())
	c := newClient(t)

	loginResp, err := c.Get(srv.URL + "/auth/reader/google/login")
	require.NoError(t, err)
	loginResp.Body.Close()
	require.Equal(t, http.StatusFound, loginResp.StatusCode)
	loc := loginResp.Header.Get("Location")
	u, err := url.Parse(loc)
	require.NoError(t, err)
	state := u.Query().Get("state")

	cbResp, err := c.Get(srv.URL + "/auth/reader/google/callback?code=abc&state=" + state)
	require.NoError(t, err)
	cbResp.Body.Close()
	require.Equal(t, http.StatusFound, cbResp.StatusCode)
	require.Equal(t, webBaseURL, cbResp.Header.Get("Location"))

	meResp, err := c.Get(srv.URL + "/auth/reader/me")
	require.NoError(t, err)
	defer meResp.Body.Close()
	require.Equal(t, http.StatusOK, meResp.StatusCode)

	logoutReq, _ := http.NewRequest(http.MethodPost, srv.URL+"/auth/reader/logout", nil)
	logoutReq.Header.Set("Content-Type", "application/json")
	logoutResp, err := c.Do(logoutReq)
	require.NoError(t, err)
	logoutResp.Body.Close()
	require.Equal(t, http.StatusNoContent, logoutResp.StatusCode)

	meAfter, err := c.Get(srv.URL + "/auth/reader/me")
	require.NoError(t, err)
	meAfter.Body.Close()
	require.Equal(t, http.StatusUnauthorized, meAfter.StatusCode)
}

// TestReaderAuth_DeleteMe: login → DELETE /auth/reader/me → 204 + session gỡ (me sau đó 401).
func TestReaderAuth_DeleteMe(t *testing.T) {
	srv, _ := newReaderTestServer(t, verifiedProvider())
	c := newClient(t)

	loginResp, err := c.Get(srv.URL + "/auth/reader/google/login")
	require.NoError(t, err)
	loginResp.Body.Close()
	u, _ := url.Parse(loginResp.Header.Get("Location"))
	state := u.Query().Get("state")
	cbResp, err := c.Get(srv.URL + "/auth/reader/google/callback?code=abc&state=" + state)
	require.NoError(t, err)
	cbResp.Body.Close()

	delReq, _ := http.NewRequest(http.MethodDelete, srv.URL+"/auth/reader/me", nil)
	delResp, err := c.Do(delReq)
	require.NoError(t, err)
	delResp.Body.Close()
	require.Equal(t, http.StatusNoContent, delResp.StatusCode)

	meAfter, err := c.Get(srv.URL + "/auth/reader/me")
	require.NoError(t, err)
	meAfter.Body.Close()
	require.Equal(t, http.StatusUnauthorized, meAfter.StatusCode)
}

// TestReaderAuth_DeleteMe_Unauth: không session → 401 (RequireReader chặn).
func TestReaderAuth_DeleteMe_Unauth(t *testing.T) {
	srv, _ := newReaderTestServer(t, verifiedProvider())
	c := newClient(t)
	delReq, _ := http.NewRequest(http.MethodDelete, srv.URL+"/auth/reader/me", nil)
	delResp, err := c.Do(delReq)
	require.NoError(t, err)
	delResp.Body.Close()
	require.Equal(t, http.StatusUnauthorized, delResp.StatusCode)
}

func TestReaderAuth_CallbackStateMismatch(t *testing.T) {
	srv, _ := newReaderTestServer(t, verifiedProvider())
	c := newClient(t)

	r, err := c.Get(srv.URL + "/auth/reader/google/login")
	require.NoError(t, err)
	r.Body.Close()

	cb, err := c.Get(srv.URL + "/auth/reader/google/callback?code=abc&state=WRONG")
	require.NoError(t, err)
	cb.Body.Close()
	require.Equal(t, http.StatusUnauthorized, cb.StatusCode)
}

// TestReaderAuth_CallbackReturnTo_OpenRedirectGuard: returnTo với path an toàn phải
// nối vào sau webBaseURL; giá trị nguy hiểm (không qua SafePath) bị bỏ, fallback về webBaseURL.
func TestReaderAuth_CallbackReturnTo_OpenRedirectGuard(t *testing.T) {
	srv, _ := newReaderTestServer(t, verifiedProvider())
	c := newClient(t)

	r, err := c.Get(srv.URL + "/auth/reader/google/login?returnTo=%2Fblog%2Fabc")
	require.NoError(t, err)
	r.Body.Close()
	loc := r.Header.Get("Location")
	u, err := url.Parse(loc)
	require.NoError(t, err)
	state := u.Query().Get("state")

	cb, err := c.Get(srv.URL + "/auth/reader/google/callback?code=abc&state=" + state)
	require.NoError(t, err)
	cb.Body.Close()
	require.Equal(t, webBaseURL+"/blog/abc", cb.Header.Get("Location"))
}

func TestReaderAuth_CallbackReturnTo_UnsafeFallsBackToBase(t *testing.T) {
	srv, _ := newReaderTestServer(t, verifiedProvider())
	c := newClient(t)

	r, err := c.Get(srv.URL + "/auth/reader/google/login?returnTo=" + url.QueryEscape("//evil.com"))
	require.NoError(t, err)
	r.Body.Close()
	loc := r.Header.Get("Location")
	u, err := url.Parse(loc)
	require.NoError(t, err)
	state := u.Query().Get("state")

	cb, err := c.Get(srv.URL + "/auth/reader/google/callback?code=abc&state=" + state)
	require.NoError(t, err)
	cb.Body.Close()
	require.Equal(t, webBaseURL, cb.Header.Get("Location"))
}
