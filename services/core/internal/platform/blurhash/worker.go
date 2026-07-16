package blurhash

import (
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"github.com/google/uuid"

	"github.com/vule96/ultimate-website/services/core/internal/platform/metrics"
)

// Job là một yêu cầu tính blurhash cho cover của 1 post.
type Job struct {
	PostID uuid.UUID
	URL    string
}

// Store lưu kết quả — impl bởi posts.GormRepository.SetBlurhash.
type Store interface {
	SetBlurhash(ctx context.Context, id uuid.UUID, hash string) error
}

// Fetcher tải bytes ảnh — interface để test không cần mạng.
type Fetcher interface {
	Fetch(ctx context.Context, url string) ([]byte, error)
}

// HTTPFetcher tải ảnh qua HTTP với timeout + giới hạn size (chống ảnh khổng lồ
// hoặc server treo làm nghẽn worker).
type HTTPFetcher struct {
	Client   *http.Client
	MaxBytes int64
}

// NewHTTPFetcher tạo fetcher với timeout + cap size.
func NewHTTPFetcher(timeout time.Duration, maxBytes int64) *HTTPFetcher {
	return &HTTPFetcher{Client: &http.Client{Timeout: timeout}, MaxBytes: maxBytes}
}

// Fetch tải URL, trả lỗi khi status ≠ 200 hoặc body vượt MaxBytes.
func (f *HTTPFetcher) Fetch(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := f.Client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("blurhash: fetch %s: status %d", url, resp.StatusCode)
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, f.MaxBytes+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > f.MaxBytes {
		return nil, fmt.Errorf("blurhash: image exceeds %d bytes", f.MaxBytes)
	}
	return data, nil
}

// Worker là worker pool: jobs vào buffered channel, N goroutine xử lý.
// Request path chỉ Enqueue (non-blocking) — không bao giờ chờ tải ảnh.
type Worker struct {
	jobs    chan Job
	store   Store
	fetcher Fetcher
	m       *metrics.Metrics
	log     *slog.Logger
	workers int
	wg      sync.WaitGroup
	once    sync.Once
}

// NewWorker tạo worker pool (chưa chạy — gọi Start).
func NewWorker(store Store, fetcher Fetcher, m *metrics.Metrics, log *slog.Logger, workers, queue int) *Worker {
	return &Worker{
		jobs:    make(chan Job, queue),
		store:   store,
		fetcher: fetcher,
		m:       m,
		log:     log,
		workers: workers,
	}
}

// Start chạy N goroutine worker. Mỗi worker nhận job từ channel tới khi
// channel đóng (Close) hoặc ctx huỷ.
func (w *Worker) Start(ctx context.Context) {
	for i := 0; i < w.workers; i++ {
		w.wg.Add(1)
		go func() {
			defer w.wg.Done()
			for {
				select {
				case <-ctx.Done():
					return
				case job, ok := <-w.jobs:
					if !ok {
						return
					}
					w.process(ctx, job)
				}
			}
		}()
	}
}

// Enqueue đẩy job vào queue KHÔNG blocking: queue đầy → drop + metric
// (blurhash là dữ liệu trang trí, có thể backfill lại — không đáng chặn request).
func (w *Worker) Enqueue(j Job) bool {
	select {
	case w.jobs <- j:
		return true
	default:
		w.m.BlurhashJob("dropped")
		w.log.Warn("blurhash: queue full, drop job", "post_id", j.PostID)
		return false
	}
}

// Close đóng queue và chờ worker drain nốt job còn lại, tối đa timeout.
// Gắn vào graceful shutdown của main.
func (w *Worker) Close(timeout time.Duration) {
	w.once.Do(func() { close(w.jobs) })
	done := make(chan struct{})
	go func() { w.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(timeout):
		w.log.Warn("blurhash: shutdown timeout — bỏ job còn lại")
	}
}

func (w *Worker) process(ctx context.Context, j Job) {
	data, err := w.fetcher.Fetch(ctx, j.URL)
	if err != nil {
		w.m.BlurhashJob("fetch_error")
		w.log.Warn("blurhash: fetch failed", "post_id", j.PostID, "url", j.URL, "err", err)
		return
	}
	hash, err := Encode(data)
	if err != nil {
		w.m.BlurhashJob("encode_error")
		w.log.Warn("blurhash: encode failed", "post_id", j.PostID, "err", err)
		return
	}
	if err := w.store.SetBlurhash(ctx, j.PostID, hash); err != nil {
		w.m.BlurhashJob("store_error")
		w.log.Warn("blurhash: store failed", "post_id", j.PostID, "err", err)
		return
	}
	w.m.BlurhashJob("ok")
	w.log.Debug("blurhash: done", "post_id", j.PostID, "hash", hash)
}
