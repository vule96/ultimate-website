package posts

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() { gin.SetMode(gin.TestMode) }

// newServerWithAuth dựng engine với authed checker cố định (true = như đã login).
func newServerWithAuth(t *testing.T, authed bool) *gin.Engine {
	t.Helper()
	repo := newRepoTx(t) // t.Skip nếu không có TEST_DATABASE_URL
	svc := NewService(repo)
	r := gin.New()
	NewHandler(svc, func(context.Context) bool { return authed }).RegisterRoutes(r.Group("/api/v1"))
	return r
}

// newTestServer: server "đã đăng nhập" — giữ hành vi cũ cho các test CRUD sẵn có.
func newTestServer(t *testing.T) *gin.Engine { return newServerWithAuth(t, true) }

// newAnonTestServer: server ẩn danh — cho các test visibility công khai.
func newAnonTestServer(t *testing.T) *gin.Engine { return newServerWithAuth(t, false) }

func doJSON(t *testing.T, r *gin.Engine, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatalf("encode body: %v", err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w
}

func decode(t *testing.T, w *httptest.ResponseRecorder) map[string]any {
	t.Helper()
	var m map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &m); err != nil {
		t.Fatalf("decode response %q: %v", w.Body.String(), err)
	}
	return m
}

func TestHandler_CreatePost(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{
		"title": "Lập trình Go",
		"tags":  []string{"Go", "Backend"},
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("status = %d, want 201; body=%s", w.Code, w.Body.String())
	}
	body := decode(t, w)
	if body["slug"] != "lap-trinh-go" {
		t.Errorf("slug = %v, want lap-trinh-go", body["slug"])
	}
	if body["id"] == nil || body["id"] == "" {
		t.Errorf("expected id in response")
	}
}

func TestHandler_CreatePost_EmptyTitle400(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "   "})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400; body=%s", w.Code, w.Body.String())
	}
	body := decode(t, w)
	if body["error"] == nil {
		t.Errorf("expected error envelope, got %s", w.Body.String())
	}
}

func TestHandler_GetBySlug(t *testing.T) {
	r := newTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "My Post"})

	w := doJSON(t, r, http.MethodGet, "/api/v1/posts/my-post", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	if decode(t, w)["title"] != "My Post" {
		t.Errorf("unexpected body: %s", w.Body.String())
	}
}

func TestHandler_GetBySlug_404(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodGet, "/api/v1/posts/nope", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", w.Code)
	}
}

func TestHandler_ListPosts(t *testing.T) {
	r := newTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "One"})
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Two"})

	w := doJSON(t, r, http.MethodGet, "/api/v1/posts?page=1&page_size=10", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	body := decode(t, w)
	if body["total"].(float64) != 2 {
		t.Errorf("total = %v, want 2", body["total"])
	}
	if data, ok := body["data"].([]any); !ok || len(data) != 2 {
		t.Errorf("data len = %v, want 2", body["data"])
	}
}

func TestHandler_UpdatePost(t *testing.T) {
	r := newTestServer(t)
	cw := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Orig"})
	id := decode(t, cw)["id"].(string)

	w := doJSON(t, r, http.MethodPut, "/api/v1/posts/"+id, map[string]any{
		"title":   "Changed",
		"status":  "PUBLISHED",
		"version": 1,
	})
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	body := decode(t, w)
	if body["title"] != "Changed" {
		t.Errorf("title = %v, want Changed", body["title"])
	}
	if body["published_at"] == nil {
		t.Errorf("expected published_at to be set")
	}
}

func TestHandler_DeletePost(t *testing.T) {
	r := newTestServer(t)
	cw := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Del Me"})
	id := decode(t, cw)["id"].(string)

	w := doJSON(t, r, http.MethodDelete, "/api/v1/posts/"+id, nil)
	if w.Code != http.StatusNoContent {
		t.Fatalf("status = %d, want 204", w.Code)
	}
	gw := doJSON(t, r, http.MethodGet, "/api/v1/posts/del-me", nil)
	if gw.Code != http.StatusNotFound {
		t.Errorf("after delete status = %d, want 404", gw.Code)
	}
}

func TestHandler_CreateDuplicateSlug_409(t *testing.T) {
	r := newTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Dup", "slug": "dup"})
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Dup2", "slug": "dup"})
	if w.Code != http.StatusConflict {
		t.Fatalf("status = %d, want 409; body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_ListTags(t *testing.T) {
	r := newTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "T", "tags": []string{"Go"}})
	w := doJSON(t, r, http.MethodGet, "/api/v1/tags", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
}

func TestHandler_AnonymousListOnlyPublished(t *testing.T) {
	r := newAnonTestServer(t)
	// Fixtures: 1 DRAFT (mặc định) + 1 PUBLISHED. Write route trong test không bọc auth.
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Bản nháp"})
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Công khai", "status": "PUBLISHED"})

	// Anonymous xin thẳng DRAFT → vẫn chỉ thấy PUBLISHED.
	w := doJSON(t, r, http.MethodGet, "/api/v1/posts?status=DRAFT", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	body := decode(t, w)
	if body["total"].(float64) != 1 {
		t.Fatalf("total = %v, want 1 (chỉ bài PUBLISHED); body=%s", body["total"], w.Body.String())
	}
	data := body["data"].([]any)
	first := data[0].(map[string]any)
	if first["slug"] != "cong-khai" {
		t.Errorf("slug = %v, want cong-khai", first["slug"])
	}
}

func TestHandler_AnonymousGetDraft404(t *testing.T) {
	r := newAnonTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Bản nháp"})

	w := doJSON(t, r, http.MethodGet, "/api/v1/posts/ban-nhap", nil)
	if w.Code != http.StatusNotFound {
		t.Fatalf("anonymous GET draft: status = %d, want 404; body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_AuthedGetDraftOK(t *testing.T) {
	r := newTestServer(t)
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Bản nháp"})

	w := doJSON(t, r, http.MethodGet, "/api/v1/posts/ban-nhap", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("authed GET draft: status = %d, want 200", w.Code)
	}
}

func TestHandler_StatsBehindProtectedMW(t *testing.T) {
	repo := newRepoTx(t)
	svc := NewService(repo)
	r := gin.New()
	deny := func(c *gin.Context) {
		c.AbortWithStatus(http.StatusUnauthorized)
	}
	NewHandler(svc, func(context.Context) bool { return false }).RegisterRoutes(r.Group("/api/v1"), deny)

	for _, path := range []string{"/api/v1/stats/posts", "/api/v1/stats/posts/timeseries"} {
		w := doJSON(t, r, http.MethodGet, path, nil)
		if w.Code != http.StatusUnauthorized {
			t.Errorf("%s: status = %d, want 401 (stats phải nằm sau protectedMW)", path, w.Code)
		}
	}
	// List công khai vẫn đi qua bình thường.
	if w := doJSON(t, r, http.MethodGet, "/api/v1/posts", nil); w.Code != http.StatusOK {
		t.Errorf("GET /posts: status = %d, want 200", w.Code)
	}
}

func TestHandler_AnonymousTagsOnlyFromPublished(t *testing.T) {
	r := newAnonTestServer(t)
	// Tag "secret-draft" chỉ thuộc bài DRAFT; "go" thuộc bài PUBLISHED.
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Nháp bí mật", "tags": []string{"Secret Draft"}})
	_ = doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "Công khai", "status": "PUBLISHED", "tags": []string{"Go"}})

	w := doJSON(t, r, http.MethodGet, "/api/v1/tags", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", w.Code)
	}
	body := decode(t, w)
	data, _ := body["data"].([]any)
	for _, it := range data {
		tag := it.(map[string]any)
		if tag["slug"] == "secret-draft" {
			t.Errorf("anonymous /tags lộ tag của bài DRAFT: %v", tag)
		}
	}
}

func TestHandler_StatsNewRoute(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodGet, "/api/v1/stats/posts", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /stats/posts = %d, want 200; body=%s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodGet, "/api/v1/stats/posts/timeseries?months=3", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /stats/posts/timeseries = %d, want 200; body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_UpdateRequiresVersion(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "V Post"})
	id := decode(t, w)["id"].(string)

	// Thiếu version → 400.
	w = doJSON(t, r, http.MethodPut, "/api/v1/posts/"+id, map[string]any{"title": "V Post 2"})
	if w.Code != http.StatusBadRequest {
		t.Fatalf("update thiếu version = %d, want 400; body=%s", w.Code, w.Body.String())
	}
}

func TestHandler_UpdateVersionConflict409(t *testing.T) {
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{"title": "C Post"})
	body := decode(t, w)
	id := body["id"].(string)
	if body["version"].(float64) != 1 {
		t.Fatalf("version sau create = %v, want 1", body["version"])
	}

	// Lần 1 với version 1 → OK, version thành 2.
	w = doJSON(t, r, http.MethodPut, "/api/v1/posts/"+id, map[string]any{"title": "C Post x", "version": 1})
	if w.Code != http.StatusOK {
		t.Fatalf("update 1 = %d; body=%s", w.Code, w.Body.String())
	}
	if decode(t, w)["version"].(float64) != 2 {
		t.Errorf("version sau update = %v, want 2", decode(t, w)["version"])
	}

	// Lần 2 vẫn gửi version 1 (stale) → 409 VERSION_CONFLICT.
	w = doJSON(t, r, http.MethodPut, "/api/v1/posts/"+id, map[string]any{"title": "C Post y", "version": 1})
	if w.Code != http.StatusConflict {
		t.Fatalf("stale update = %d, want 409; body=%s", w.Code, w.Body.String())
	}
	errObj := decode(t, w)["error"].(map[string]any)
	if errObj["code"] != "VERSION_CONFLICT" {
		t.Errorf("code = %v, want VERSION_CONFLICT", errObj["code"])
	}
}

func TestHandler_PostSlugStatsNotShadowed(t *testing.T) {
	// M3: bài viết slug "stats" phải xem được qua /posts/stats (không bị route tĩnh che).
	r := newTestServer(t)
	w := doJSON(t, r, http.MethodPost, "/api/v1/posts", map[string]any{
		"title": "Stats", "slug": "stats", "status": "PUBLISHED",
	})
	if w.Code != http.StatusCreated {
		t.Fatalf("create = %d; body=%s", w.Code, w.Body.String())
	}
	w = doJSON(t, r, http.MethodGet, "/api/v1/posts/stats", nil)
	if w.Code != http.StatusOK {
		t.Fatalf("GET /posts/stats = %d, want 200 (bài viết); body=%s", w.Code, w.Body.String())
	}
	if decode(t, w)["title"] != "Stats" {
		t.Errorf("expected bài viết 'Stats', got %s", w.Body.String())
	}
}
