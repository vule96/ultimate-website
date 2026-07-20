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

func postSub(t *testing.T, r http.Handler, body string) int {
	req := httptest.NewRequest(http.MethodPost, "/subscribers", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestSubscribe_HandlerValidIdempotent(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewSubscriberHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)
	require.Equal(t, http.StatusCreated, postSub(t, r, `{"email":"a@b.com"}`))
	require.Equal(t, http.StatusCreated, postSub(t, r, `{"email":"a@b.com"}`)) // không leak
}

func TestSubscribe_HandlerInvalid400(t *testing.T) {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	NewSubscriberHandler(NewService(newFakeRepo(), fakeProvider{})).RegisterRoutes(r)
	require.Equal(t, http.StatusBadRequest, postSub(t, r, `{"email":"nope"}`))
}

func postUnsub(t *testing.T, r http.Handler, body string) int {
	req := httptest.NewRequest(http.MethodPost, "/subscribers/unsubscribe", strings.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	return w.Code
}

func TestUnsubscribe_Handler(t *testing.T) {
	gin.SetMode(gin.TestMode)
	repo := newFakeRepo()
	repo.unsubToken = uuid.New()
	r := gin.New()
	NewSubscriberHandler(NewService(repo, fakeProvider{})).RegisterRoutes(r)

	require.Equal(t, http.StatusNoContent, postUnsub(t, r, `{"token":"`+repo.unsubToken.String()+`"}`))
	require.Equal(t, http.StatusNotFound, postUnsub(t, r, `{"token":"`+uuid.NewString()+`"}`))
	require.Equal(t, http.StatusBadRequest, postUnsub(t, r, `{"token":"not-a-uuid"}`))
}
