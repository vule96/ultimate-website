package bodylimit

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// newServer dựng engine có limit nhỏ; handler bind JSON và map lỗi như handler thật.
func newServer(limit int64) *gin.Engine {
	r := gin.New()
	r.Use(Middleware(limit))
	r.POST("/x", func(c *gin.Context) {
		var v map[string]any
		if err := c.ShouldBindJSON(&v); err != nil {
			if IsTooLarge(err) {
				c.JSON(http.StatusRequestEntityTooLarge, gin.H{"code": "PAYLOAD_TOO_LARGE"})
				return
			}
			c.JSON(http.StatusBadRequest, gin.H{"code": "INVALID_BODY"})
			return
		}
		c.Status(http.StatusOK)
	})
	return r
}

func do(r *gin.Engine, body string) *httptest.ResponseRecorder {
	req := httptest.NewRequest(http.MethodPost, "/x", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func TestMiddleware_OverLimit413(t *testing.T) {
	r := newServer(16)
	w := do(r, `{"k":"`+strings.Repeat("a", 100)+`"}`)
	if w.Code != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413; body=%s", w.Code, w.Body.String())
	}
}

func TestMiddleware_UnderLimitOK(t *testing.T) {
	r := newServer(1024)
	w := do(r, `{"k":"v"}`)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}
