package media

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"os"
	"testing"
)

// Integration test: presign PUT → upload → public GET, chạy với MinIO thật.
// Bật bằng: STORAGE_TEST_ENDPOINT=http://localhost:9000 (xem docker-compose).
func TestS3Storage_PresignPutRoundTrip(t *testing.T) {
	endpoint := os.Getenv("STORAGE_TEST_ENDPOINT")
	if endpoint == "" {
		t.Skip("set STORAGE_TEST_ENDPOINT to run MinIO integration test")
	}

	st := NewS3Storage(S3Config{
		Endpoint:     endpoint,
		Region:       "auto",
		AccessKey:    getenv("STORAGE_TEST_ACCESS_KEY", "minioadmin"),
		SecretKey:    getenv("STORAGE_TEST_SECRET_KEY", "minioadmin"),
		Bucket:       getenv("STORAGE_TEST_BUCKET", "blog-media"),
		PublicURL:    endpoint + "/" + getenv("STORAGE_TEST_BUCKET", "blog-media"),
		UsePathStyle: true,
	})

	ctx := context.Background()
	key := "uploads/2026/07/roundtrip-test.png"
	content := []byte("\x89PNG\r\n\x1a\n-fake-image-bytes")

	url, _, err := st.PresignPut(ctx, key, "image/png")
	if err != nil {
		t.Fatalf("presign: %v", err)
	}

	// PUT ảnh trực tiếp lên storage bằng presigned URL.
	req, _ := http.NewRequestWithContext(ctx, http.MethodPut, url, bytes.NewReader(content))
	req.Header.Set("Content-Type", "image/png")
	putResp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("put: %v", err)
	}
	defer putResp.Body.Close()
	if putResp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(putResp.Body)
		t.Fatalf("put status = %d, body = %s", putResp.StatusCode, body)
	}

	// GET công khai (bucket policy download) và so khớp bytes.
	getResp, err := http.Get(st.PublicURL(key))
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	defer getResp.Body.Close()
	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("public get status = %d", getResp.StatusCode)
	}
	got, _ := io.ReadAll(getResp.Body)
	if !bytes.Equal(got, content) {
		t.Errorf("public content mismatch: got %d bytes, want %d", len(got), len(content))
	}
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
