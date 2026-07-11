package jsonmw

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func newServer() *gin.Engine {
	r := gin.New()
	r.Use(RequireJSON())
	ok := func(c *gin.Context) { c.Status(http.StatusOK) }
	r.POST("/x", ok)
	r.PUT("/x", ok)
	r.DELETE("/x", ok)
	r.GET("/x", ok)
	return r
}

func do(r *gin.Engine, method, contentType string) int {
	req := httptest.NewRequest(method, "/x", strings.NewReader(`{}`))
	if contentType != "" {
		req.Header.Set("Content-Type", contentType)
	}
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestRequireJSON_RejectsNonJSONWrites(t *testing.T) {
	r := newServer()
	for _, ct := range []string{"text/plain", "application/x-www-form-urlencoded", "multipart/form-data", ""} {
		if code := do(r, http.MethodPost, ct); code != http.StatusUnsupportedMediaType {
			t.Errorf("POST %q: code = %d, want 415", ct, code)
		}
		if code := do(r, http.MethodPut, ct); code != http.StatusUnsupportedMediaType {
			t.Errorf("PUT %q: code = %d, want 415", ct, code)
		}
	}
}

func TestRequireJSON_AllowsJSON(t *testing.T) {
	r := newServer()
	for _, ct := range []string{"application/json", "application/json; charset=utf-8"} {
		if code := do(r, http.MethodPost, ct); code != http.StatusOK {
			t.Errorf("POST %q: code = %d, want 200", ct, code)
		}
	}
}

func TestRequireJSON_IgnoresGetAndDelete(t *testing.T) {
	r := newServer()
	if code := do(r, http.MethodGet, "text/plain"); code != http.StatusOK {
		t.Errorf("GET: code = %d, want 200", code)
	}
	if code := do(r, http.MethodDelete, ""); code != http.StatusOK {
		t.Errorf("DELETE: code = %d, want 200", code)
	}
}
