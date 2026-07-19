package readers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/stretchr/testify/require"
)

func newAdminRouter(repo *fakeRepo) http.Handler {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewAdminHandler(NewService(repo, fakeProvider{})).RegisterRoutes(r)
	return r
}

func TestAdmin_ListSubscribers(t *testing.T) {
	repo := newFakeRepo()
	repo.subsList = []Subscriber{
		{ID: uuid.New(), Email: "a@b.com", Status: "active", CreatedAt: time.Now()},
		{ID: uuid.New(), Email: "c@d.com", Status: "active", CreatedAt: time.Now()},
	}
	w := httptest.NewRecorder()
	newAdminRouter(repo).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/subscribers?page=1&page_size=20", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var body struct {
		Data     []map[string]any `json:"data"`
		Total    int64            `json:"total"`
		Page     int              `json:"page"`
		PageSize int              `json:"page_size"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Len(t, body.Data, 2)
	require.Equal(t, int64(2), body.Total)
	require.Equal(t, "a@b.com", body.Data[0]["email"])
}

func TestAdmin_DeleteSubscriber_NotFound(t *testing.T) {
	repo := newFakeRepo()
	repo.deleteErr = ErrSubscriberNotFound
	w := httptest.NewRecorder()
	newAdminRouter(repo).ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/subscribers/"+uuid.NewString(), nil))
	require.Equal(t, http.StatusNotFound, w.Code)
}

func TestAdmin_DeleteSubscriber_InvalidID(t *testing.T) {
	w := httptest.NewRecorder()
	newAdminRouter(newFakeRepo()).ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/subscribers/not-a-uuid", nil))
	require.Equal(t, http.StatusBadRequest, w.Code)
}

func TestAdmin_DeleteSubscriber_OK(t *testing.T) {
	w := httptest.NewRecorder()
	newAdminRouter(newFakeRepo()).ServeHTTP(w, httptest.NewRequest(http.MethodDelete, "/subscribers/"+uuid.NewString(), nil))
	require.Equal(t, http.StatusNoContent, w.Code)
}

func TestAdmin_ListReaders(t *testing.T) {
	repo := newFakeRepo()
	repo.readersList = []ReaderWithCount{
		{ID: uuid.New(), Email: "r@b.com", Name: "R", CreatedAt: time.Now(), BookmarkCount: 3},
	}
	w := httptest.NewRecorder()
	newAdminRouter(repo).ServeHTTP(w, httptest.NewRequest(http.MethodGet, "/readers", nil))
	require.Equal(t, http.StatusOK, w.Code)

	var body struct {
		Data []struct {
			Email         string `json:"email"`
			BookmarkCount int64  `json:"bookmark_count"`
		} `json:"data"`
		Total int64 `json:"total"`
	}
	require.NoError(t, json.Unmarshal(w.Body.Bytes(), &body))
	require.Equal(t, int64(1), body.Total)
	require.Equal(t, "r@b.com", body.Data[0].Email)
	require.Equal(t, int64(3), body.Data[0].BookmarkCount)
}
