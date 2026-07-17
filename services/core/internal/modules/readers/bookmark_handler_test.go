package readers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func TestBookmark_PutInvalidUUID400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rid := uuid.New()
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set(CtxReaderID, rid); c.Next() })
	NewBookmarkHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)

	req := httptest.NewRequest(http.MethodPut, "/readers/me/bookmarks/not-a-uuid", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	require.Equal(t, http.StatusBadRequest, w.Code)
}

// TestBookmark_GetEmptyReturnsArray đảm bảo reader không có bookmark nào nhận về
// JSON "[]" chứ không phải "null" (nil-guard trong list handler).
func TestBookmark_GetEmptyReturnsArray(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rid := uuid.New()
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set(CtxReaderID, rid); c.Next() })
	NewBookmarkHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)

	req := httptest.NewRequest(http.MethodGet, "/readers/me/bookmarks", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	require.Equal(t, http.StatusOK, w.Code)
	require.Equal(t, "[]", strings.TrimSpace(w.Body.String()))
}

func TestBookmark_PutDeleteOK(t *testing.T) {
	gin.SetMode(gin.TestMode)
	rid := uuid.New()
	r := gin.New()
	r.Use(func(c *gin.Context) { c.Set(CtxReaderID, rid); c.Next() })
	NewBookmarkHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)

	pid := uuid.New().String()
	for _, m := range []string{http.MethodPut, http.MethodDelete} {
		req := httptest.NewRequest(m, "/readers/me/bookmarks/"+pid, nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		require.Equal(t, http.StatusNoContent, w.Code)
	}
}
