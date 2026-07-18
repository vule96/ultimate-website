package blurhash_test

import (
	"bytes"
	"context"
	"encoding/binary"
	"hash/crc32"
	"image"
	"image/color"
	"image/png"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/platform/blurhash"
	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

// png4x4 sinh PNG 4x4 hợp lệ trong test — không cần file/mạng.
func png4x4(t *testing.T) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, 4, 4))
	for x := 0; x < 4; x++ {
		for y := 0; y < 4; y++ {
			img.Set(x, y, color.RGBA{R: uint8(x * 60), G: uint8(y * 60), B: 128, A: 255})
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

type fakeFetcher struct{ data []byte }

func (f fakeFetcher) Fetch(context.Context, string) ([]byte, error) { return f.data, nil }

type fakeStore struct {
	mu   sync.Mutex
	got  map[uuid.UUID]string
	done chan struct{}
}

func newFakeStore() *fakeStore {
	return &fakeStore{got: map[uuid.UUID]string{}, done: make(chan struct{}, 8)}
}

func (s *fakeStore) SetBlurhash(_ context.Context, id uuid.UUID, hash string) error {
	s.mu.Lock()
	s.got[id] = hash
	s.mu.Unlock()
	s.done <- struct{}{}
	return nil
}

func (s *fakeStore) get(id uuid.UUID) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.got[id]
}

func TestWorkerProcessesJob(t *testing.T) {
	store := newFakeStore()
	w := blurhash.NewWorker(store, fakeFetcher{png4x4(t)}, metrics.New(), slog.Default(), 2, 4)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	w.Start(ctx)

	id := uuid.New()
	if !w.Enqueue(blurhash.Job{PostID: id, URL: "http://x/a.png"}) {
		t.Fatal("enqueue phải thành công khi queue trống")
	}
	select {
	case <-store.done:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout chờ worker xử lý job")
	}
	if store.get(id) == "" {
		t.Error("blurhash phải được lưu")
	}
}

func TestEnqueueFullDropsNotBlocks(t *testing.T) {
	// Worker CHƯA Start → queue size 1: job 2 phải bị drop ngay, không block.
	w := blurhash.NewWorker(newFakeStore(), fakeFetcher{nil}, metrics.New(), slog.Default(), 1, 1)
	if !w.Enqueue(blurhash.Job{PostID: uuid.New()}) {
		t.Fatal("job 1 phải vào queue")
	}
	doneCh := make(chan bool, 1)
	go func() { doneCh <- w.Enqueue(blurhash.Job{PostID: uuid.New()}) }()
	select {
	case ok := <-doneCh:
		if ok {
			t.Error("job 2 phải bị drop (queue đầy)")
		}
	case <-time.After(time.Second):
		t.Fatal("Enqueue bị block — phải non-blocking")
	}
}

func TestCloseDrainsRemainingJobs(t *testing.T) {
	store := newFakeStore()
	w := blurhash.NewWorker(store, fakeFetcher{png4x4(t)}, metrics.New(), slog.Default(), 1, 4)
	ctx := context.Background()
	w.Start(ctx)
	id := uuid.New()
	w.Enqueue(blurhash.Job{PostID: id, URL: "x"})
	w.Close(2 * time.Second)
	if store.get(id) == "" {
		t.Error("Close phải drain job còn lại trước khi thoát")
	}
}

func TestEncodeRejectsNonImage(t *testing.T) {
	if _, err := blurhash.Encode([]byte("not an image")); err == nil {
		t.Fatal("Encode dữ liệu rác phải trả lỗi")
	}
}

// bigPNGHeader dựng PNG chỉ có IHDR khai báo kích thước khổng lồ —
// DecodeConfig đọc được header, nhưng Encode phải chặn trước khi decode pixel.
func bigPNGHeader(w, h uint32) []byte {
	var buf bytes.Buffer
	buf.Write([]byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'})
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:4], w)
	binary.BigEndian.PutUint32(ihdr[4:8], h)
	ihdr[8] = 8 // bit depth
	ihdr[9] = 6 // color type RGBA
	var length [4]byte
	binary.BigEndian.PutUint32(length[:], 13)
	buf.Write(length[:])
	chunk := append([]byte("IHDR"), ihdr...)
	buf.Write(chunk)
	var crc [4]byte
	binary.BigEndian.PutUint32(crc[:], crc32.ChecksumIEEE(chunk))
	buf.Write(crc[:])
	return buf.Bytes()
}

func TestEncodeRejectsDecompressionBomb(t *testing.T) {
	if _, err := blurhash.Encode(bigPNGHeader(40000, 40000)); err == nil {
		t.Fatal("ảnh 40000x40000 phải bị chặn trước khi decode (decompression bomb)")
	}
}

func TestFetcherBlocksPrivateIPWhenNotAllowlisted(t *testing.T) {
	f := blurhash.NewHTTPFetcher(time.Second, 1<<20, nil)
	if _, err := f.Fetch(context.Background(), "http://127.0.0.1:1/x.png"); err == nil {
		t.Fatal("host loopback không allowlist phải bị chặn (SSRF guard)")
	}
	if _, err := f.Fetch(context.Background(), "file:///etc/passwd"); err == nil {
		t.Fatal("scheme file:// phải bị chặn")
	}
}

func TestFetcherAllowsAllowlistedHost(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("img"))
	}))
	defer srv.Close()

	u, _ := url.Parse(srv.URL)
	f := blurhash.NewHTTPFetcher(time.Second, 1<<20, []string{u.Hostname()})
	data, err := f.Fetch(context.Background(), srv.URL+"/x.png")
	if err != nil {
		t.Fatalf("host trong allowlist phải fetch được: %v", err)
	}
	if string(data) != "img" {
		t.Errorf("data = %q", data)
	}
}

type fakeContentStore struct {
	mu   sync.Mutex
	got  map[uuid.UUID]map[string]blurhash.Meta
	done chan struct{}
}

func newFakeContentStore() *fakeContentStore {
	return &fakeContentStore{got: map[uuid.UUID]map[string]blurhash.Meta{}, done: make(chan struct{}, 4)}
}

func (s *fakeContentStore) SetContentImageMeta(_ context.Context, id uuid.UUID, meta map[string]blurhash.Meta) error {
	s.mu.Lock()
	s.got[id] = meta
	s.mu.Unlock()
	s.done <- struct{}{}
	return nil
}

func TestWorkerProcessesContentJob(t *testing.T) {
	store := newFakeStore()
	cs := newFakeContentStore()
	bumped := make(chan struct{}, 1)
	w := blurhash.NewWorker(store, fakeFetcher{png4x4(t)}, metrics.New(), slog.Default(), 1, 4).
		WithContentStore(cs, func(context.Context) { bumped <- struct{}{} })
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	w.Start(ctx)

	id := uuid.New()
	html := `<img src="https://a/1.png"><img src="https://a/2.png">`
	if !w.Enqueue(blurhash.Job{PostID: id, ContentHTML: html}) {
		t.Fatal("enqueue content job phải OK")
	}
	select {
	case <-cs.done:
	case <-time.After(2 * time.Second):
		t.Fatal("timeout chờ content meta")
	}
	cs.mu.Lock()
	meta := cs.got[id]
	cs.mu.Unlock()
	if len(meta) != 2 {
		t.Fatalf("meta có %d entry, want 2", len(meta))
	}
	m := meta["https://a/1.png"]
	if m.W != 4 || m.H != 4 || m.PlaceholderPNG == "" {
		t.Errorf("meta sai: %+v", m)
	}
	select {
	case <-bumped:
	case <-time.After(time.Second):
		t.Error("afterContentSet (bump cache) phải được gọi")
	}
}
