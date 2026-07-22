package media

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"
)

// fakeStorage là Storage giả cho unit test service (không cần MinIO).
type fakeStorage struct {
	lastKey         string
	lastContentType string
	lastSize        int64
}

func (f *fakeStorage) PresignPut(_ context.Context, key, contentType string, size int64) (string, time.Duration, error) {
	f.lastKey = key
	f.lastContentType = contentType
	f.lastSize = size
	return "https://storage.test/" + key + "?sig=x", 15 * time.Minute, nil
}
func (f *fakeStorage) PublicURL(key string) string { return "https://cdn.test/" + key }

func newTestService(st Storage) *Service {
	s := NewService(st)
	s.now = func() time.Time { return time.Date(2026, 7, 5, 9, 0, 0, 0, time.UTC) }
	s.newID = func() string { return "fixed-id" }
	return s
}

func TestPresign_ValidPNG(t *testing.T) {
	st := &fakeStorage{}
	svc := newTestService(st)

	res, err := svc.Presign(context.Background(), PresignInput{
		ContentType: "image/png",
		Size:        1024,
	})
	if err != nil {
		t.Fatalf("presign: %v", err)
	}
	if res.Key != "uploads/2026/07/fixed-id.png" {
		t.Errorf("key = %q, want uploads/2026/07/fixed-id.png", res.Key)
	}
	if res.PublicURL != "https://cdn.test/uploads/2026/07/fixed-id.png" {
		t.Errorf("public_url = %q", res.PublicURL)
	}
	if !strings.HasPrefix(res.UploadURL, "https://storage.test/") {
		t.Errorf("upload_url = %q", res.UploadURL)
	}
	if res.ExpiresIn != 15*time.Minute {
		t.Errorf("expires = %v", res.ExpiresIn)
	}
	if st.lastSize != 1024 {
		t.Errorf("storage nhận size = %d, want 1024 (size phải được truyền xuống để ký)", st.lastSize)
	}
}

func TestPresign_ContentTypeExtensions(t *testing.T) {
	cases := map[string]string{
		"image/jpeg": "jpg",
		"image/webp": "webp",
		"image/gif":  "gif",
	}
	for ct, ext := range cases {
		st := &fakeStorage{}
		svc := newTestService(st)
		res, err := svc.Presign(context.Background(), PresignInput{ContentType: ct, Size: 10})
		if err != nil {
			t.Fatalf("%s: %v", ct, err)
		}
		if !strings.HasSuffix(res.Key, "."+ext) {
			t.Errorf("%s → key %q, want suffix .%s", ct, res.Key, ext)
		}
	}
}

func TestPresign_RejectsBadContentType(t *testing.T) {
	svc := newTestService(&fakeStorage{})
	_, err := svc.Presign(context.Background(), PresignInput{ContentType: "application/pdf", Size: 10})
	if !errors.Is(err, ErrValidation) {
		t.Fatalf("want ErrValidation, got %v", err)
	}
}

func TestPresign_RejectsBadSize(t *testing.T) {
	svc := newTestService(&fakeStorage{})
	for _, size := range []int64{0, -1, MaxUploadSize + 1} {
		_, err := svc.Presign(context.Background(), PresignInput{ContentType: "image/png", Size: size})
		if !errors.Is(err, ErrValidation) {
			t.Errorf("size %d: want ErrValidation, got %v", size, err)
		}
	}
}
