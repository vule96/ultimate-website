package readers

import (
	"net/http"
	"net/http/httptest"
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
