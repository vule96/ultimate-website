package reqlog

import (
	"bytes"
	"context"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

func TestMiddleware_SetsRequestIDHeaderAndLogsCompletion(t *testing.T) {
	var buf bytes.Buffer
	base := slog.New(slog.NewTextHandler(&buf, nil))

	r := gin.New()
	r.Use(Middleware(base))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/x", nil))

	if w.Header().Get("X-Request-ID") == "" {
		t.Error("response phải có header X-Request-ID")
	}
	logged := buf.String()
	if !strings.Contains(logged, "request_id=") {
		t.Errorf("completion log phải kèm request_id, got: %s", logged)
	}
	if !strings.Contains(logged, "status=200") {
		t.Errorf("completion log phải kèm status, got: %s", logged)
	}
}

func TestMiddleware_HonorsIncomingRequestID(t *testing.T) {
	r := gin.New()
	r.Use(Middleware(slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil))))
	r.GET("/x", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest(http.MethodGet, "/x", nil)
	req.Header.Set("X-Request-ID", "abc-123")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if got := w.Header().Get("X-Request-ID"); got != "abc-123" {
		t.Errorf("X-Request-ID = %q, want abc-123 (giữ giá trị client gửi)", got)
	}
}

func TestFrom_FallbackNonNil(t *testing.T) {
	if From(context.Background()) == nil {
		t.Error("From ctx trống phải trả logger non-nil (fallback slog.Default)")
	}
}

func TestMiddleware_LogsProductionFields(t *testing.T) {
	var buf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&buf, nil))
	r := gin.New()
	r.Use(Middleware(log))
	r.GET("/x/:id", func(c *gin.Context) { c.String(http.StatusOK, "hello") })

	req := httptest.NewRequest(http.MethodGet, "/x/42", nil)
	req.Header.Set("User-Agent", "test-agent")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	out := buf.String()
	for _, want := range []string{`"route":"/x/:id"`, `"user_agent":"test-agent"`, `"bytes_out":5`, `"status":200`, `"ip"`} {
		if !strings.Contains(out, want) {
			t.Errorf("log thiếu %s trong: %s", want, out)
		}
	}
}

func TestMiddleware_Logs5xxAsErrorWithErrors(t *testing.T) {
	var buf bytes.Buffer
	log := slog.New(slog.NewJSONHandler(&buf, nil))
	r := gin.New()
	r.Use(Middleware(log))
	r.GET("/boom", func(c *gin.Context) {
		_ = c.Error(errors.New("db exploded"))
		c.Status(http.StatusInternalServerError)
	})

	w := httptest.NewRecorder()
	r.ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/boom", nil))

	out := buf.String()
	if !strings.Contains(out, `"level":"ERROR"`) {
		t.Errorf("5xx phải log level ERROR: %s", out)
	}
	if !strings.Contains(out, "db exploded") {
		t.Errorf("log thiếu errors: %s", out)
	}
}
