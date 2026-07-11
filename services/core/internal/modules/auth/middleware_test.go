package auth

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/alexedwards/scs/v2"
	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// newMiddlewareTestServer dựng server có route login giả (đặt email vào session) và
// route protected sau RequireAuth với allowlist cho trước.
func newMiddlewareTestServer(allowlistCSV, loginEmail string) http.Handler {
	sm := scs.New() // MemStore mặc định — đủ cho test middleware
	r := gin.New()
	r.POST("/fake-login", func(c *gin.Context) {
		sm.Put(c.Request.Context(), sessionKeyAdminEmail, loginEmail)
		c.Status(http.StatusNoContent)
	})
	protected := r.Group("", RequireAuth(sm, NewAllowlist(allowlistCSV)))
	protected.GET("/secret", func(c *gin.Context) { c.Status(http.StatusOK) })
	return sm.LoadAndSave(r)
}

// loginAndGetSecret login lấy cookie rồi GET /secret bằng cookie đó, trả response.
func loginAndGetSecret(t *testing.T, h http.Handler) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/fake-login", nil))
	cookie := rec.Header().Get("Set-Cookie")
	if cookie == "" {
		t.Fatal("expected session cookie from fake-login")
	}
	req := httptest.NewRequest(http.MethodGet, "/secret", nil)
	req.Header.Set("Cookie", cookie)
	rec2 := httptest.NewRecorder()
	h.ServeHTTP(rec2, req)
	return rec2
}

func TestRequireAuth_AllowedEmailPasses(t *testing.T) {
	h := newMiddlewareTestServer("admin@example.com", "admin@example.com")
	if w := loginAndGetSecret(t, h); w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestRequireAuth_RemovedEmail401AndDestroysSession(t *testing.T) {
	// Email có session sống nhưng KHÔNG còn trong allowlist → 401 (M2).
	h := newMiddlewareTestServer("still@example.com", "gone@example.com")
	if w := loginAndGetSecret(t, h); w.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401; body=%s", w.Code, w.Body.String())
	}
}

func TestRequireAuth_NoSession401(t *testing.T) {
	h := newMiddlewareTestServer("admin@example.com", "admin@example.com")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/secret", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", rec.Code)
	}
}
